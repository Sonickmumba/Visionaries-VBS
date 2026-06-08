import { badRequest } from "../utils/httpError.js";

export const OVERRIDABLE_FIELDS = {
  common_interest_allocations: new Set(["final_charge"]),
  member_monthly_snapshots: new Set([
    "savings_interest",
    "accumulated_savings_carried_forward",
    "loan_interest_assessed",
    "loan_carried_forward",
    "common_interest_charge",
    "penalties_assessed",
  ]),
  cycle_month_summaries: new Set([
    "total_savings_interest",
    "total_accumulated_savings",
    "total_loan_interest_assessed",
    "total_outstanding_loans",
    "total_common_interest_charged",
    "total_penalties_assessed",
  ]),
};

export function normalizeOverrideInput({ targetTable, fieldName, reason }) {
  const normalizedTable = String(targetTable || "").trim().toLowerCase();
  const normalizedField = String(fieldName || "").trim().toLowerCase();
  const normalizedReason = String(reason || "").trim();

  if (!normalizedReason) {
    throw badRequest("Override reason is required");
  }
  if (!OVERRIDABLE_FIELDS[normalizedTable]) {
    throw badRequest("Target table cannot be overridden");
  }
  if (!OVERRIDABLE_FIELDS[normalizedTable].has(normalizedField)) {
    throw badRequest("Target field cannot be overridden");
  }

  return {
    targetTable: normalizedTable,
    fieldName: normalizedField,
    reason: normalizedReason,
  };
}

export function cycleReferenceColumns(targetTable) {
  if (targetTable === "common_interest_allocations") {
    return { cycleIdColumn: "cycle_id", cycleMonthIdColumn: "cycle_month_id" };
  }
  if (targetTable === "member_monthly_snapshots") {
    return { cycleIdColumn: "cycle_id", cycleMonthIdColumn: "cycle_month_id" };
  }
  return { cycleIdColumn: "cycle_id", cycleMonthIdColumn: "cycle_month_id" };
}
