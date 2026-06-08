import express from "express";
import { query } from "../../db/pool.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

export const auditRouter = express.Router();
auditRouter.use(requireAuth, requireRole("ADMIN", "AUDITOR"));

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const normalized = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${normalized.replaceAll("\"", "\"\"")}"`;
}

function sendCsv(res, { filename, rows }) {
  const columns = Object.keys(rows[0] || {});
  const csv = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
  ].join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
  return res.send(csv);
}

function pagination(queryParams) {
  const page = Math.max(1, Number.parseInt(queryParams.page || "1", 10) || 1);
  const limit = Math.min(250, Math.max(1, Number.parseInt(queryParams.limit || "250", 10) || 250));
  return { page, limit, offset: (page - 1) * limit };
}

auditRouter.get("/", async (req, res, next) => {
  try {
    const { page, limit, offset } = pagination(req.query);
    const params = [];
    const where = [];
    if (req.query.action) {
      params.push(req.query.action);
      where.push(`al.action = $${params.length}`);
    }
    if (req.query.entityTable) {
      params.push(req.query.entityTable);
      where.push(`al.entity_table = $${params.length}`);
    }
    if (req.query.entityId) {
      params.push(req.query.entityId);
      where.push(`al.entity_id = $${params.length}`);
    }
    if (req.query.actorUserId) {
      params.push(req.query.actorUserId);
      where.push(`al.actor_user_id = $${params.length}`);
    }
    if (req.query.actorEmail) {
      params.push(`%${String(req.query.actorEmail).toLowerCase()}%`);
      where.push(`LOWER(u.email) LIKE $${params.length}`);
    }
    if (req.query.reason) {
      params.push(`%${String(req.query.reason).toLowerCase()}%`);
      where.push(`LOWER(COALESCE(al.reason,'')) LIKE $${params.length}`);
    }
    if (req.query.search) {
      params.push(`%${String(req.query.search).toLowerCase()}%`);
      where.push(`(
        LOWER(COALESCE(al.reason,'')) LIKE $${params.length}
        OR LOWER(COALESCE(al.entity_table,'')) LIKE $${params.length}
        OR LOWER(COALESCE(u.email,'')) LIKE $${params.length}
      )`);
    }
    if (req.query.dateFrom) {
      params.push(req.query.dateFrom);
      where.push(`al.created_at::date >= $${params.length}`);
    }
    if (req.query.dateTo) {
      params.push(req.query.dateTo);
      where.push(`al.created_at::date <= $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countResult = await query(
      `SELECT COUNT(*)::int AS count
       FROM audit_logs al LEFT JOIN users u ON u.id = al.actor_user_id
       ${whereSql}`,
      params
    );
    const logParams = [...params, limit, offset];
    const { rows } = await query(
      `SELECT al.*, u.email AS actor_email, u.role AS actor_role
       FROM audit_logs al LEFT JOIN users u ON u.id = al.actor_user_id
       ${whereSql}
       ORDER BY al.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      logParams
    );
    const overrideWhere = [];
    const overrideParams = [];
    if (req.query.entityTable) {
      overrideParams.push(String(req.query.entityTable).toLowerCase());
      overrideWhere.push(`o.target_table = $${overrideParams.length}`);
    }
    if (req.query.entityId) {
      overrideParams.push(req.query.entityId);
      overrideWhere.push(`o.target_id = $${overrideParams.length}`);
    }
    if (req.query.actorUserId) {
      overrideParams.push(req.query.actorUserId);
      overrideWhere.push(`o.approved_by = $${overrideParams.length}`);
    }
    if (req.query.reason) {
      overrideParams.push(`%${String(req.query.reason).toLowerCase()}%`);
      overrideWhere.push(`LOWER(o.reason) LIKE $${overrideParams.length}`);
    }
    if (req.query.dateFrom) {
      overrideParams.push(req.query.dateFrom);
      overrideWhere.push(`o.created_at::date >= $${overrideParams.length}`);
    }
    if (req.query.dateTo) {
      overrideParams.push(req.query.dateTo);
      overrideWhere.push(`o.created_at::date <= $${overrideParams.length}`);
    }
    const overrideWhereSql = overrideWhere.length ? `WHERE ${overrideWhere.join(" AND ")}` : "";
    const overrides = await query(
      `SELECT o.*, u.email AS approved_by_email,
        c.name AS cycle_name,
        cm.month_number
       FROM overrides o
       LEFT JOIN users u ON u.id = o.approved_by
       LEFT JOIN cycles c ON c.id = o.cycle_id
       LEFT JOIN cycle_months cm ON cm.id = o.cycle_month_id
       ${overrideWhereSql}
       ORDER BY o.created_at DESC LIMIT 100`,
      overrideParams
    );
    const reversalWhere = [];
    const reversalParams = [];
    if (req.query.entityId) {
      reversalParams.push(req.query.entityId);
      reversalWhere.push(`(lt.id = $${reversalParams.length} OR lt.reversed_transaction_id = $${reversalParams.length})`);
    }
    if (req.query.actorUserId) {
      reversalParams.push(req.query.actorUserId);
      reversalWhere.push(`lt.posted_by = $${reversalParams.length}`);
    }
    if (req.query.dateFrom) {
      reversalParams.push(req.query.dateFrom);
      reversalWhere.push(`lt.posted_at::date >= $${reversalParams.length}`);
    }
    if (req.query.dateTo) {
      reversalParams.push(req.query.dateTo);
      reversalWhere.push(`lt.posted_at::date <= $${reversalParams.length}`);
    }
    const reversalWhereSql = reversalWhere.length ? `AND ${reversalWhere.join(" AND ")}` : "";
    const reversals = await query(
      `SELECT lt.*, u.email AS posted_by_email,
        c.name AS cycle_name,
        cmn.month_number,
        m.member_code, m.first_name, m.last_name
       FROM ledger_transactions lt
       LEFT JOIN users u ON u.id = lt.posted_by
       LEFT JOIN cycles c ON c.id = lt.cycle_id
       LEFT JOIN cycle_months cmn ON cmn.id = lt.cycle_month_id
       LEFT JOIN cycle_members cm ON cm.id = lt.cycle_member_id
       LEFT JOIN members m ON m.id = cm.member_id
       WHERE (lt.is_reversal = TRUE OR lt.reversed_transaction_id IS NOT NULL OR lt.reversal_reason IS NOT NULL)
       ${reversalWhereSql}
       ORDER BY lt.posted_at DESC LIMIT 100`
      ,
      reversalParams
    );
    const totals = {
      logs: rows.length,
      overrides: overrides.rows.length,
      reversals: reversals.rows.length,
      logins: rows.filter((row) => row.action === "LOGIN").length,
    };
    const section = String(req.query.section || "logs").toLowerCase();
    if (String(req.query.format || "").toLowerCase() === "csv") {
      const exportRows = section === "overrides" ? overrides.rows : section === "reversals" ? reversals.rows : rows;
      return sendCsv(res, { filename: `audit-${section}`, rows: exportRows });
    }
    res.json({
      data: rows,
      overrides: overrides.rows,
      reversals: reversals.rows,
      totals,
      pagination: {
        page,
        limit,
        total: countResult.rows[0]?.count || 0,
        totalPages: Math.ceil((countResult.rows[0]?.count || 0) / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});
