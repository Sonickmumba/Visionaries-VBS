import { describe, expect, it } from "vitest";
import { buildCommonInterestPreview } from "../src/services/commonInterestService.js";

describe("common interest service", () => {
  it("uses carried-forward unborrowed pool balance through the selected month", async () => {
    const queries = [];
    const client = {
      async query(sql, params = []) {
        queries.push({ sql, params });
        if (sql.includes("SELECT * FROM cycles WHERE id = $1")) {
          return {
            rows: [{
              id: "cycle-1",
              common_interest_rate: "0.15",
              minimum_borrowing_amount: "20000",
              rounding_scale: 2,
              rounding_mode: "HALF_UP",
            }],
          };
        }
        if (sql.includes("SELECT * FROM cycle_months WHERE id = $1")) {
          return { rows: [{ id: "month-2", cycle_id: "cycle-1", month_number: 2 }] };
        }
        if (sql.includes("AS contributions")) {
          return { rows: [{ contributions: "15000", loans: "5000" }] };
        }
        if (sql.includes("AS borrowed")) {
          return {
            rows: [
              { cycle_member_id: "cm-1", first_name: "Mary", last_name: "Phiri", member_code: "M001", borrowed: "5000" },
              { cycle_member_id: "cm-2", first_name: "Agnes", last_name: "Banda", member_code: "M002", borrowed: "0" },
            ],
          };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    };

    const preview = await buildCommonInterestPreview(client, {
      cycleId: "cycle-1",
      cycleMonthId: "month-2",
      allocationMethod: "NON_BORROWERS_AND_BELOW_MINIMUM_PROPORTIONAL",
    });

    expect(preview.totalPoolContributions).toBe(15000);
    expect(preview.totalLoansIssued).toBe(5000);
    expect(preview.unborrowedMoney).toBe(10000);
    expect(preview.commonInterestPool).toBe(1500);
    expect(preview.allocations.map((item) => item.cycle_member_id)).toEqual(["cm-1", "cm-2"]);
    expect(queries.find((item) => item.sql.includes("AS contributions")).sql).toContain("cmn.month_number <= (SELECT month_number FROM selected_month)");
    expect(queries.find((item) => item.sql.includes("AS borrowed")).sql).toContain("cmn.month_number <= (SELECT month_number FROM selected_month)");
  });
});
