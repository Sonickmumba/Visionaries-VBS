import express from "express";
import { z } from "zod";
import { query, withTransaction } from "../../db/pool.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { audit } from "../../services/auditService.js";
import {
  buildShareoutPreview,
  calculateGroupSurplusSchedule,
  getShareout,
  postShareout,
} from "../../services/shareoutService.js";
import { forbidden, notFound } from "../../utils/httpError.js";

export const shareoutRouter = express.Router();
shareoutRouter.use(requireAuth);

function isPrivileged(user) {
  return ["ADMIN", "AUDITOR"].includes(user.role);
}

async function ensureMemberCanReadCycle(req, cycleId) {
  if (isPrivileged(req.user)) return null;
  const result = await query(
    `SELECT cm.id AS cycle_member_id
     FROM cycle_members cm
     JOIN members m ON m.id = cm.member_id
     WHERE cm.cycle_id = $1 AND m.user_id = $2
     LIMIT 1`,
    [cycleId, req.user.id]
  );
  if (!result.rows[0]) throw forbidden("You can only access shareout records for your own cycle");
  return result.rows[0].cycle_member_id;
}

async function resolveCycleId(req) {
  if (req.query.cycleId) return req.query.cycleId;
  const cycle = await query(
    `SELECT c.id
     FROM cycles c
     ORDER BY CASE c.status WHEN 'ACTIVE' THEN 1 WHEN 'CLOSED' THEN 2 ELSE 3 END, c.created_at DESC
     LIMIT 1`
  );
  return cycle.rows[0]?.id || null;
}

shareoutRouter.get("/surplus", async (req, res, next) => {
  try {
    const cycleId = await resolveCycleId(req);
    if (!cycleId) return res.json({ data: { cycle: null, rows: [], totals: {} } });
    await ensureMemberCanReadCycle(req, cycleId);
    const data = await calculateGroupSurplusSchedule(query, { cycleId, persist: false });
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

shareoutRouter.get("/", async (req, res, next) => {
  try {
    const cycleId = await resolveCycleId(req);
    if (!cycleId) return res.json({ data: null });
    const cycleMemberId = await ensureMemberCanReadCycle(req, cycleId);
    const data = await getShareout(query, {
      cycleId,
      cycleMemberId: isPrivileged(req.user) ? req.query.cycleMemberId || null : cycleMemberId,
    });
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

shareoutRouter.post("/preview", requireRole("ADMIN"), validate(z.object({
  cycleId: z.string().uuid(),
})), async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const preview = await buildShareoutPreview(client, {
        cycleId: req.body.cycleId,
        generatedBy: req.user.id,
        persist: true,
      });
      await audit(client, {
        actorUserId: req.user.id,
        action: "CREATE",
        entityTable: "cycle_shareouts",
        entityId: preview.shareout?.id,
        afterData: preview.shareout,
        reason: "Shareout preview generated",
        req,
      });
      return preview;
    });
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

shareoutRouter.post("/post", requireRole("ADMIN"), validate(z.object({
  cycleId: z.string().uuid(),
  notes: z.string().optional().nullable(),
})), async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => postShareout(client, {
      cycleId: req.body.cycleId,
      postedBy: req.user.id,
      notes: req.body.notes || null,
      req,
      auditFn: audit,
    }));
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

shareoutRouter.get("/:shareoutId/members/:cycleMemberId", async (req, res, next) => {
  try {
    const shareout = await query("SELECT * FROM cycle_shareouts WHERE id = $1", [req.params.shareoutId]);
    if (!shareout.rows[0]) throw notFound("Shareout not found");
    const allowedCycleMemberId = await ensureMemberCanReadCycle(req, shareout.rows[0].cycle_id);
    if (!isPrivileged(req.user) && allowedCycleMemberId !== req.params.cycleMemberId) {
      throw forbidden("You can only access your own shareout detail");
    }
    const data = await getShareout(query, {
      shareoutId: req.params.shareoutId,
      cycleMemberId: req.params.cycleMemberId,
    });
    res.json({ data: data?.members?.[0] || null });
  } catch (error) {
    next(error);
  }
});
