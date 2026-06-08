import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/db/pool.js", () => ({
  query: vi.fn(),
}));

import { query } from "../src/db/pool.js";
import { requireConsistentCycleReferences, requireCycleMemberAccessFromParam } from "../src/middleware/domainGuards.js";

function runMiddleware(middleware, req) {
  return new Promise((resolve) => {
    middleware(req, {}, (error) => resolve(error || null));
  });
}

describe("cycle member access guard", () => {
  beforeEach(() => {
    query.mockReset();
  });

  it("allows admins without ownership lookup", async () => {
    const error = await runMiddleware(requireCycleMemberAccessFromParam(), {
      user: { id: "admin-1", role: "ADMIN" },
      params: { cycleMemberId: "cycle-member-1" },
    });

    expect(error).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it("allows a member to access their own cycle member record", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: "cycle-member-1" }] });

    const error = await runMiddleware(requireCycleMemberAccessFromParam(), {
      user: { id: "member-user-1", role: "MEMBER" },
      params: { cycleMemberId: "cycle-member-1" },
    });

    expect(error).toBeNull();
    expect(query).toHaveBeenCalledWith(expect.stringContaining("WHERE cm.id = $1 AND m.user_id = $2"), ["cycle-member-1", "member-user-1"]);
  });

  it("blocks a member from accessing another member's cycle record", async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const error = await runMiddleware(requireCycleMemberAccessFromParam(), {
      user: { id: "member-user-1", role: "MEMBER" },
      params: { cycleMemberId: "cycle-member-2" },
    });

    expect(error).toMatchObject({ status: 403 });
  });
});

describe("cycle reference consistency guard", () => {
  beforeEach(() => {
    query.mockReset();
  });

  it("allows matching cycle, month, and member references", async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: "month-1", cycle_id: "cycle-1" }] })
      .mockResolvedValueOnce({ rows: [{ id: "cycle-member-1", cycle_id: "cycle-1" }] });

    const error = await runMiddleware(requireConsistentCycleReferences(), {
      body: { cycleId: "cycle-1", cycleMonthId: "month-1", cycleMemberId: "cycle-member-1" },
    });

    expect(error).toBeNull();
  });

  it("blocks a month from another cycle", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: "month-1", cycle_id: "cycle-2" }] });

    const error = await runMiddleware(requireConsistentCycleReferences(), {
      body: { cycleId: "cycle-1", cycleMonthId: "month-1", cycleMemberId: "cycle-member-1" },
    });

    expect(error).toMatchObject({ status: 400 });
    expect(error.message).toBe("Cycle month does not belong to the provided cycle");
  });

  it("blocks a member from another cycle", async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: "month-1", cycle_id: "cycle-1" }] })
      .mockResolvedValueOnce({ rows: [{ id: "cycle-member-1", cycle_id: "cycle-2" }] });

    const error = await runMiddleware(requireConsistentCycleReferences(), {
      body: { cycleId: "cycle-1", cycleMonthId: "month-1", cycleMemberId: "cycle-member-1" },
    });

    expect(error).toMatchObject({ status: 400 });
    expect(error.message).toBe("Cycle member does not belong to the provided cycle");
  });
});
