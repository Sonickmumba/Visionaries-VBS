import express from "express";
import { z } from "zod";
import { query, withTransaction } from "../../db/pool.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { audit } from "../../services/auditService.js";
import { cycleReferenceColumns, normalizeOverrideInput } from "../../services/overrideService.js";
import { notFound } from "../../utils/httpError.js";
import { validate } from "../../middleware/validate.js";

export const overridesRouter = express.Router();
overridesRouter.use(requireAuth);

const createOverrideSchema = z.object({
  targetTable: z.string().min(1),
  targetId: z.string().uuid(),
  fieldName: z.string().min(1),
  overriddenValue: z.number().nonnegative(),
  reason: z.string().min(1),
});

overridesRouter.get("/", requireRole("ADMIN", "AUDITOR"), async (req, res, next) => {
  try {
    const params = [];
    const where = [];
    if (req.query.cycleId) {
      params.push(req.query.cycleId);
      where.push(`o.cycle_id = $${params.length}`);
    }
    if (req.query.cycleMonthId) {
      params.push(req.query.cycleMonthId);
      where.push(`o.cycle_month_id = $${params.length}`);
    }
    if (req.query.targetTable) {
      params.push(String(req.query.targetTable).toLowerCase());
      where.push(`o.target_table = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const { rows } = await query(
      `SELECT o.*, u.email AS approved_by_email,
        c.name AS cycle_name,
        cm.month_number
       FROM overrides o
       LEFT JOIN users u ON u.id = o.approved_by
       LEFT JOIN cycles c ON c.id = o.cycle_id
       LEFT JOIN cycle_months cm ON cm.id = o.cycle_month_id
       ${whereSql}
       ORDER BY o.created_at DESC
       LIMIT 250`,
      params
    );
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
});

overridesRouter.post("/", requireRole("ADMIN"), validate(createOverrideSchema), async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const { targetTable, fieldName, reason } = normalizeOverrideInput(req.body);
      const { cycleIdColumn, cycleMonthIdColumn } = cycleReferenceColumns(targetTable);

      const target = (await client.query(
        `SELECT id, ${cycleIdColumn} AS cycle_id, ${cycleMonthIdColumn} AS cycle_month_id, ${fieldName} AS original_value
         FROM ${targetTable}
         WHERE id = $1
         FOR UPDATE`,
        [req.body.targetId]
      )).rows[0];
      if (!target) throw notFound("Override target not found");

      const override = (await client.query(
        `INSERT INTO overrides
          (cycle_id, cycle_month_id, target_table, target_id, field_name,
           original_value, overridden_value, reason, approved_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [
          target.cycle_id,
          target.cycle_month_id,
          targetTable,
          req.body.targetId,
          fieldName,
          target.original_value,
          req.body.overriddenValue,
          reason,
          req.user.id,
        ]
      )).rows[0];

      await client.query(
        `UPDATE ${targetTable}
         SET ${fieldName} = $2
         WHERE id = $1`,
        [req.body.targetId, req.body.overriddenValue]
      );

      if (targetTable === "common_interest_allocations") {
        await client.query("UPDATE common_interest_allocations SET override_id = $2 WHERE id = $1", [req.body.targetId, override.id]);
      }

      await audit(client, {
        actorUserId: req.user.id,
        action: "OVERRIDE",
        entityTable: targetTable,
        entityId: req.body.targetId,
        beforeData: { [fieldName]: target.original_value },
        afterData: { [fieldName]: req.body.overriddenValue, overrideId: override.id },
        reason,
        req,
      });

      return override;
    });
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});
