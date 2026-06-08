export async function audit(client, {
  actorUserId,
  action,
  entityTable,
  entityId = null,
  beforeData = null,
  afterData = null,
  reason = null,
  req = null,
}) {
  await client.query(
    `INSERT INTO audit_logs
      (actor_user_id, action, entity_table, entity_id, before_data, after_data, reason, ip_address, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      actorUserId || null,
      action,
      entityTable,
      entityId,
      beforeData ? JSON.stringify(beforeData) : null,
      afterData ? JSON.stringify(afterData) : null,
      reason,
      req?.ip || null,
      req?.headers?.["user-agent"] || null,
    ]
  );
}
