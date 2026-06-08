import { describe, expect, it, vi } from "vitest";
import { requestHash, runIdempotent } from "../src/services/idempotencyService.js";
import { getPagination, paginationMeta } from "../src/utils/pagination.js";

describe("pagination utilities", () => {
  it("normalizes page and limit with a maximum", () => {
    expect(getPagination({ page: "3", limit: "999" }, { defaultLimit: 25, maxLimit: 100 })).toEqual({
      page: 3,
      limit: 100,
      offset: 200,
    });
  });

  it("builds pagination metadata", () => {
    expect(paginationMeta({ page: 2, limit: 10, total: 35 })).toEqual({
      page: 2,
      limit: 10,
      total: 35,
      totalPages: 4,
    });
  });
});

describe("idempotency service", () => {
  it("hashes equivalent object bodies consistently", () => {
    expect(requestHash({ b: 2, a: 1 })).toBe(requestHash({ a: 1, b: 2 }));
  });

  it("replays a stored response for the same key and body", async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({
          rows: [{
            response_status: 201,
            response_body: { data: { id: "existing" } },
            request_hash: requestHash({ amount: 100 }),
          }],
        }),
    };

    const result = await runIdempotent(client, {
      user: { id: "user-1" },
      headers: { "idempotency-key": "abc" },
      body: { amount: 100 },
    }, "POST /test", async () => ({ status: 201, body: { data: { id: "new" } } }));

    expect(result).toEqual({
      status: 201,
      body: { data: { id: "existing" } },
      replayed: true,
    });
  });

  it("stores a response for first-time idempotent requests", async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
    };

    const result = await runIdempotent(client, {
      user: { id: "user-1" },
      headers: { "idempotency-key": "abc" },
      body: { amount: 100 },
    }, "POST /test", async () => ({ status: 201, body: { data: { id: "new" } } }));

    expect(result.replayed).toBe(false);
    expect(result.body.data.id).toBe("new");
    expect(client.query).toHaveBeenCalledTimes(2);
  });
});
