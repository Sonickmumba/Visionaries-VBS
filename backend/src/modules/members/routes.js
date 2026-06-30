import express from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { z } from "zod";
import { query, withTransaction } from "../../db/pool.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { sendAccountInvitation } from "../../services/emailVerificationService.js";
import { badRequest, forbidden, notFound } from "../../utils/httpError.js";
import { getPagination, paginationMeta } from "../../utils/pagination.js";

export const membersRouter = express.Router();
membersRouter.use(requireAuth);

const memberSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  memberCode: z.string().optional().nullable(),
  nationalId: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

membersRouter.get("/", requireRole("ADMIN", "AUDITOR"), async (req, res, next) => {
  try {
    const search = `%${req.query.search || ""}%`;
    const status = req.query.status ? String(req.query.status).toUpperCase() : null;
    const pagination = getPagination(req.query);
    const params = [search];
    let statusFilter = "";
    if (status === "ACTIVE" || status === "INACTIVE") {
      params.push(status === "ACTIVE");
      statusFilter = ` AND m.is_active = $${params.length}`;
    }
    const total = await query(
      `SELECT COUNT(DISTINCT m.id)::int AS total
       FROM members m
       WHERE (m.first_name ILIKE $1 OR m.last_name ILIKE $1 OR m.member_code ILIKE $1)${statusFilter}`,
      params
    );
    const listParams = [...params, pagination.limit, pagination.offset];
    const { rows } = await query(
      `SELECT m.*, u.email,
        COALESCE(SUM(CASE WHEN lt.transaction_type IN ('SAVINGS_DEPOSIT') AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS savings_principal,
        COALESCE(SUM(CASE WHEN lt.transaction_type IN ('LOAN_DISBURSEMENT','LOAN_TOP_UP','CONVERTED_PENALTY_LOAN') AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS cumulative_borrowed,
        COALESCE(declaration_counts.approved_declarations,0)::int AS approved_declarations,
        current_declaration.status AS current_declaration_status,
        current_declaration.submitted_at AS current_declaration_submitted_at
       FROM members m
       LEFT JOIN users u ON u.id = m.user_id
       LEFT JOIN cycle_members cm ON cm.member_id = m.id
       LEFT JOIN ledger_transactions lt ON lt.cycle_member_id = cm.id AND lt.is_reversal = FALSE
       LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id
       LEFT JOIN LATERAL (
         SELECT COUNT(*) FILTER (WHERE d.status = 'APPROVED') AS approved_declarations
         FROM declarations d
         JOIN cycle_members dcm ON dcm.id = d.cycle_member_id
         WHERE dcm.member_id = m.id
       ) declaration_counts ON TRUE
       LEFT JOIN LATERAL (
         SELECT d.status, d.submitted_at
         FROM declarations d
         JOIN cycle_members dcm ON dcm.id = d.cycle_member_id
         JOIN cycle_months month ON month.id = d.cycle_month_id
         JOIN cycles c ON c.id = d.cycle_id
         WHERE dcm.member_id = m.id
           AND c.status = 'ACTIVE'
         ORDER BY
           CASE month.status
             WHEN 'DECLARATION_PERIOD' THEN 1
             WHEN 'OPEN' THEN 2
             ELSE 3
           END,
           month.month_number
         LIMIT 1
       ) current_declaration ON TRUE
       WHERE (m.first_name ILIKE $1 OR m.last_name ILIKE $1 OR m.member_code ILIKE $1)${statusFilter}
       GROUP BY m.id, u.email, declaration_counts.approved_declarations, current_declaration.status, current_declaration.submitted_at
       ORDER BY m.created_at DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );
    res.json({ data: rows, pagination: paginationMeta({ ...pagination, total: total.rows[0].total }) });
  } catch (error) {
    next(error);
  }
});

membersRouter.post("/", requireRole("ADMIN"), validate(memberSchema), async (req, res, next) => {
  try {
    const member = await withTransaction(async (client) => {
      let userId = null;
      let invitationDelivery = null;
      if (req.body.email) {
        const existingUser = await client.query("SELECT id FROM users WHERE email = $1", [req.body.email.toLowerCase()]);
        if (existingUser.rows[0]) {
          const linkedMember = await client.query("SELECT id FROM members WHERE user_id = $1", [existingUser.rows[0].id]);
          if (linkedMember.rows[0]) throw badRequest("Email is already linked to another member");
          userId = existingUser.rows[0].id;
        } else {
          const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("base64url"), 10);
          const user = await client.query(
            `INSERT INTO users (email, password_hash, role, is_active, invited_by, invited_at)
             VALUES ($1,$2,'MEMBER',FALSE,$3,now())
             RETURNING id, email, role, is_active, email_verified_at`,
            [req.body.email.toLowerCase(), passwordHash, req.user.id]
          );
          userId = user.rows[0].id;
          const invitation = await sendAccountInvitation(client, {
            user: user.rows[0],
            role: "MEMBER",
            invitedBy: req.user.id,
            req,
          });
          invitationDelivery = invitation.delivery;
        }
      }

      const { rows } = await client.query(
        `INSERT INTO members (user_id, first_name, last_name, phone, member_code, national_id, address)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [userId, req.body.firstName, req.body.lastName, req.body.phone || null, req.body.memberCode || null, req.body.nationalId || null, req.body.address || null]
      );
      return { ...rows[0], invitationDelivery };
    });
    res.status(201).json({ data: member });
  } catch (error) {
    next(error);
  }
});

membersRouter.get("/:memberId", async (req, res, next) => {
  try {
    const member = await query("SELECT m.*, u.email FROM members m LEFT JOIN users u ON u.id = m.user_id WHERE m.id = $1", [req.params.memberId]);
    if (!member.rows[0]) throw notFound("Member not found");
    if (!["ADMIN", "AUDITOR"].includes(req.user.role) && String(member.rows[0].user_id) !== String(req.user.id)) {
      throw forbidden("You can only access your own member profile");
    }
    const cycleMemberships = await query(
      `SELECT cm.*, c.name AS cycle_name, c.minimum_borrowing_amount
       FROM cycle_members cm JOIN cycles c ON c.id = cm.cycle_id
       WHERE cm.member_id = $1`,
      [req.params.memberId]
    );
    const cycleMemberIds = cycleMemberships.rows.map((row) => row.id);
    const transactions = cycleMemberIds.length
      ? await query("SELECT * FROM ledger_transactions WHERE cycle_member_id = ANY($1::uuid[]) ORDER BY posted_at DESC LIMIT 100", [cycleMemberIds])
      : { rows: [] };
    const declarations = cycleMemberIds.length
      ? await query(
          `SELECT d.*, c.name AS cycle_name, cmn.month_number
           FROM declarations d
           JOIN cycles c ON c.id = d.cycle_id
           JOIN cycle_months cmn ON cmn.id = d.cycle_month_id
           WHERE d.cycle_member_id = ANY($1::uuid[])
           ORDER BY d.submitted_at DESC`,
          [cycleMemberIds]
        )
      : { rows: [] };
    const declarationStats = {
      total: declarations.rows.length,
      approved: declarations.rows.filter((row) => row.status === "APPROVED").length,
      missed: declarations.rows.filter((row) => row.status === "MISSED").length,
      awaitingReview: declarations.rows.filter((row) => ["SUBMITTED", "LATE"].includes(row.status)).length,
    };
    res.json({
      data: member.rows[0],
      cycleMemberships: cycleMemberships.rows,
      transactions: transactions.rows,
      declarations: declarations.rows,
      declarationStats,
    });
  } catch (error) {
    next(error);
  }
});

membersRouter.patch("/:memberId", requireRole("ADMIN"), validate(memberSchema.partial()), async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE members SET
        first_name = COALESCE($2, first_name),
        last_name = COALESCE($3, last_name),
        phone = COALESCE($4, phone),
        member_code = COALESCE($5, member_code),
        national_id = COALESCE($6, national_id),
        address = COALESCE($7, address),
        updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.memberId, req.body.firstName, req.body.lastName, req.body.phone, req.body.memberCode, req.body.nationalId, req.body.address]
    );
    if (!rows[0]) throw notFound("Member not found");
    res.json({ data: rows[0] });
  } catch (error) {
    next(error);
  }
});

membersRouter.post("/:memberId/activate", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const { rows } = await query("UPDATE members SET is_active = TRUE, updated_at = now() WHERE id = $1 RETURNING *", [req.params.memberId]);
    if (!rows[0]) throw notFound("Member not found");
    res.json({ data: rows[0] });
  } catch (error) {
    next(error);
  }
});

membersRouter.post("/:memberId/deactivate", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const { rows } = await query("UPDATE members SET is_active = FALSE, updated_at = now() WHERE id = $1 RETURNING *", [req.params.memberId]);
    if (!rows[0]) throw notFound("Member not found");
    res.json({ data: rows[0] });
  } catch (error) {
    next(error);
  }
});

membersRouter.post("/enroll", requireRole("ADMIN"), validate(z.object({
  cycleId: z.string().uuid(),
  memberId: z.string().uuid(),
})), async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const cycle = (await client.query("SELECT id FROM cycles WHERE id = $1", [req.body.cycleId])).rows[0];
      if (!cycle) throw notFound("Cycle not found");
      const member = (await client.query("SELECT id FROM members WHERE id = $1", [req.body.memberId])).rows[0];
      if (!member) throw notFound("Member not found");
      const before = (await client.query(
        "SELECT * FROM cycle_members WHERE cycle_id = $1 AND member_id = $2",
        [req.body.cycleId, req.body.memberId]
      )).rows[0] || null;
      const { rows } = await client.query(
        `INSERT INTO cycle_members (cycle_id, member_id, status)
         VALUES ($1,$2,'ACTIVE')
         ON CONFLICT (cycle_id, member_id) DO UPDATE SET status = 'ACTIVE', left_at = NULL, updated_at = now()
         RETURNING *`,
        [req.body.cycleId, req.body.memberId]
      );
      await audit(client, {
        actorUserId: req.user.id,
        action: before ? "UPDATE" : "CREATE",
        entityTable: "cycle_members",
        entityId: rows[0].id,
        beforeData: before,
        afterData: rows[0],
        reason: before ? "Cycle member reactivated" : "Member enrolled into cycle",
        req,
      });
      return rows[0];
    });
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});
