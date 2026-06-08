import { query } from "../db/pool.js";
import { canPostToMonthStatus } from "../services/monthGuard.js";
import { badRequest, conflict, forbidden, notFound } from "../utils/httpError.js";

export function requireUnlockedMonthFromBody(field = "cycleMonthId") {
  return async (req, res, next) => {
    try {
      const cycleMonthId = req.body?.[field];
      if (!cycleMonthId) return next();

      const { rows } = await query("SELECT id, status FROM cycle_months WHERE id = $1", [cycleMonthId]);
      const month = rows[0];
      if (!month) throw notFound("Cycle month not found");
      if (!canPostToMonthStatus(month.status)) {
        throw conflict("This month is locked. Use a reversal or authorized override workflow.");
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireConsistentCycleReferences({
  cycleField = "cycleId",
  cycleMonthField = "cycleMonthId",
  cycleMemberField = "cycleMemberId",
} = {}) {
  return async (req, res, next) => {
    try {
      const cycleId = req.body?.[cycleField];
      const cycleMonthId = req.body?.[cycleMonthField];
      const cycleMemberId = cycleMemberField ? req.body?.[cycleMemberField] : null;
      if (!cycleId) return next();

      if (cycleMonthId) {
        const month = await query("SELECT id, cycle_id FROM cycle_months WHERE id = $1", [cycleMonthId]);
        if (!month.rows[0]) throw notFound("Cycle month not found");
        if (String(month.rows[0].cycle_id) !== String(cycleId)) {
          throw badRequest("Cycle month does not belong to the provided cycle");
        }
      }

      if (cycleMemberId) {
        const member = await query("SELECT id, cycle_id FROM cycle_members WHERE id = $1", [cycleMemberId]);
        if (!member.rows[0]) throw notFound("Cycle member not found");
        if (String(member.rows[0].cycle_id) !== String(cycleId)) {
          throw badRequest("Cycle member does not belong to the provided cycle");
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireUnlockedMonthForPenaltyParam(param = "id") {
  return async (req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT cm.status
         FROM penalties p
         JOIN cycle_months cm ON cm.id = p.cycle_month_id
         WHERE p.id = $1`,
        [req.params[param]]
      );
      const month = rows[0];
      if (!month) throw notFound("Penalty not found");
      if (!canPostToMonthStatus(month.status)) {
        throw conflict("This month is locked. Use a reversal or authorized override workflow.");
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireUnlockedMonthForDeclarationParam(param = "id") {
  return async (req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT cm.status
         FROM declarations d
         JOIN cycle_months cm ON cm.id = d.cycle_month_id
         WHERE d.id = $1`,
        [req.params[param]]
      );
      const month = rows[0];
      if (!month) throw notFound("Declaration not found");
      if (!canPostToMonthStatus(month.status)) {
        throw conflict("This month is locked. Use a reversal or authorized override workflow.");
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireCycleMemberAccessFromBody(field = "cycleMemberId") {
  return async (req, res, next) => {
    try {
      if (["ADMIN", "AUDITOR"].includes(req.user.role)) return next();
      const cycleMemberId = req.body?.[field];
      if (!cycleMemberId) return next();

      const { rows } = await query(
        `SELECT cm.id
         FROM cycle_members cm
         JOIN members m ON m.id = cm.member_id
         WHERE cm.id = $1 AND m.user_id = $2`,
        [cycleMemberId, req.user.id]
      );
      if (!rows[0]) throw forbidden("You can only access your own cycle records");
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireCycleMemberAccessFromParam(param = "cycleMemberId") {
  return async (req, res, next) => {
    try {
      if (["ADMIN", "AUDITOR"].includes(req.user.role)) return next();
      const cycleMemberId = req.params?.[param];
      if (!cycleMemberId) return next();

      const { rows } = await query(
        `SELECT cm.id
         FROM cycle_members cm
         JOIN members m ON m.id = cm.member_id
         WHERE cm.id = $1 AND m.user_id = $2`,
        [cycleMemberId, req.user.id]
      );
      if (!rows[0]) throw forbidden("You can only access your own cycle records");
      next();
    } catch (error) {
      next(error);
    }
  };
}
