import { query } from "../db/pool.js";

export async function recordSecurityEvent({ req, action, reason, metadata = {} }) {
  try {
    await query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_table, entity_id, after_data, reason, ip_address, user_agent)
       VALUES ($1,$2,'security_events',$3,$4,$5,$6,$7)`,
      [
        req.user?.id || null,
        action,
        req.requestId || null,
        JSON.stringify({
          path: req.originalUrl || req.url,
          method: req.method,
          ...metadata,
        }),
        reason,
        req.ip || null,
        req.headers?.["user-agent"] || null,
      ]
    );
  } catch {
    // Security event logging must not make the request path unavailable.
  }
}
