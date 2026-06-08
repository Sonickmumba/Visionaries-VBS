import { createHash } from "node:crypto";
import { conflict } from "../utils/httpError.js";

export function idempotencyKeyFromRequest(req) {
  return req.headers?.["idempotency-key"] || req.headers?.["x-idempotency-key"] || null;
}

export function requestHash(body = {}) {
  return createHash("sha256").update(JSON.stringify(sortObject(body))).digest("hex");
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = sortObject(value[key]);
      return acc;
    }, {});
  }
  return value;
}

export async function runIdempotent(client, req, route, work) {
  const key = idempotencyKeyFromRequest(req);
  if (!key) return work();

  const actorUserId = req.user?.id || null;
  const hash = requestHash(req.body || {});
  const existing = await client.query(
    `SELECT response_status, response_body, request_hash
     FROM idempotency_keys
     WHERE actor_user_id IS NOT DISTINCT FROM $1 AND route = $2 AND key = $3
     LIMIT 1`,
    [actorUserId, route, key]
  );
  if (existing.rows[0]) {
    if (existing.rows[0].request_hash !== hash) {
      throw conflict("Idempotency key has already been used with a different request body");
    }
    return {
      status: existing.rows[0].response_status,
      body: existing.rows[0].response_body,
      replayed: true,
    };
  }

  const result = await work();
  const status = result.status || 201;
  const body = result.body || result;
  await client.query(
    `INSERT INTO idempotency_keys (key, actor_user_id, route, request_hash, response_status, response_body)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [key, actorUserId, route, hash, status, JSON.stringify(body)]
  );
  return { status, body, replayed: false };
}
