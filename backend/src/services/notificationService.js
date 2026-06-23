import { env } from "../config/env.js";
import { getRedisPublisherConnection, getRedisSubscriberConnection, redisEnabled } from "./redisService.js";

const MAX_EVENTS = 200;
const FANOUT_CHANNEL = "visionaries:notifications:fanout";
const clients = new Map();
let events = [];
let nextId = 1;
let subscriberStarted = false;

function toCamelEvent(row = {}) {
  return {
    id: String(row.id),
    type: row.type,
    title: row.title,
    message: row.message,
    audience: row.audience,
    severity: row.severity,
    cycleId: row.cycle_id || null,
    cycleMonthId: row.cycle_month_id || null,
    cycleMemberId: row.cycle_member_id || null,
    sourceTable: row.source_table || null,
    sourceId: row.source_id || null,
    actionUrl: row.action_url || null,
    actionTarget: row.action_target || null,
    metadata: row.metadata || {},
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    readAt: row.read_at || null,
  };
}

function normalizeEvent(input = {}) {
  const id = input.id ? String(input.id) : String(nextId++);
  return {
    id,
    type: input.type || "SYSTEM_EVENT",
    title: input.title || "Activity update",
    message: input.message || "A new activity was recorded.",
    audience: input.audience || "ALL",
    severity: input.severity || "INFO",
    cycleId: input.cycleId || null,
    cycleMonthId: input.cycleMonthId || null,
    cycleMemberId: input.cycleMemberId || null,
    sourceTable: input.sourceTable || null,
    sourceId: input.sourceId || null,
    actionUrl: input.actionUrl || null,
    actionTarget: input.actionTarget || null,
    recipientUserIds: input.recipientUserIds || [],
    expiresAt: input.expiresAt || null,
    metadata: input.metadata || {},
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

function money(value) {
  const amount = Number(value || 0);
  return `K${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function memberLabel(context = {}) {
  return context.memberName || [context.first_name, context.last_name].filter(Boolean).join(" ") || context.member_code || "A member";
}

function monthLabel(context = {}) {
  return context.month_number ? `Month ${context.month_number}` : "the selected month";
}

function joinParts(parts) {
  const clean = parts.filter(Boolean);
  if (clean.length <= 1) return clean[0] || "submitted a declaration";
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")}, and ${clean.at(-1)}`;
}

function declarationParts(metadata = {}) {
  return [
    Number(metadata.savingsAmount || 0) > 0 ? `declared ${money(metadata.savingsAmount)} savings` : "",
    Number(metadata.loanRequestAmount || 0) > 0 ? `requested a ${money(metadata.loanRequestAmount)} loan` : "",
    Number(metadata.loanTopUpAmount || 0) > 0 ? `requested a ${money(metadata.loanTopUpAmount)} loan top-up` : "",
    Number(metadata.principalRepaymentAmount || 0) > 0 ? `declared ${money(metadata.principalRepaymentAmount)} loan principal repayment` : "",
    Number(metadata.loanInterestRepaymentAmount || 0) > 0 ? `declared ${money(metadata.loanInterestRepaymentAmount)} loan interest payment` : "",
    Number(metadata.commonInterestPaymentAmount || 0) > 0 ? `declared ${money(metadata.commonInterestPaymentAmount)} common-interest payment` : "",
  ];
}

function targetFor(type) {
  if (String(type).startsWith("DECLARATION")) {
    return { adminPage: "declarations", memberPage: "my-reports", report: "declarations" };
  }
  if (String(type).startsWith("LOAN")) {
    return { adminPage: "loans", memberPage: "my-reports", report: "loans" };
  }
  if (String(type).startsWith("COMMON_INTEREST")) {
    return { adminPage: "common-interest", memberPage: "my-reports", report: "common-interest" };
  }
  if (type === "PENALTY_CONVERTED_TO_LOAN") {
    return { adminPage: "penalties", memberPage: "my-reports", report: "converted-penalties" };
  }
  if (String(type).startsWith("PENALTY")) {
    return { adminPage: "penalties", memberPage: "my-reports", report: "penalties" };
  }
  if (String(type).startsWith("MONTHLY_CLOSING")) {
    return { adminPage: "reports", memberPage: "my-reports", report: "cycle-closing" };
  }
  return { adminPage: "reports", memberPage: "my-reports", report: "cycle-summary" };
}

function messageFor(input, context = {}) {
  const name = memberLabel(context);
  const month = monthLabel(context);
  const metadata = input.metadata || {};
  switch (input.type) {
    case "DECLARATION_DRAFT_SAVED":
      return {
        title: `${name} saved a declaration draft`,
        message: `${name} saved a declaration draft for ${month}.`,
      };
    case "DECLARATION_SUBMITTED":
      return {
        title: `${name} submitted a declaration`,
        message: `${name} ${joinParts(declarationParts(metadata))} for ${month}.`,
      };
    case "DECLARATION_MARKED_MISSED":
      return {
        title: `${name} missed declaration`,
        message: Number(metadata.penaltyAmount || 0) > 0
          ? `${name} was marked missed for ${month} and assessed a ${money(metadata.penaltyAmount)} penalty.`
          : `${name} was marked missed for ${month}.`,
      };
    case "DECLARATION_APPROVED":
      return {
        title: `${name} declaration approved`,
        message: `${name}'s declaration for ${month} was approved: ${joinParts(declarationParts(metadata))}.`,
      };
    case "LOAN_REQUEST_CREATED":
    case "LOAN_REQUEST_SUBMITTED":
      return {
        title: `${name} requested a loan`,
        message: `${name} requested a ${money(metadata.requestedAmount)} ${metadata.originType === "TOP_UP" ? "loan top-up" : "loan"} for ${month}.`,
      };
    case "LOAN_REQUEST_APPROVED":
      return {
        title: `${name} loan request approved`,
        message: `${name}'s ${money(metadata.approvedAmount || metadata.requestedAmount)} loan request was approved for ${month}.`,
      };
    case "LOAN_REQUEST_REJECTED":
      return {
        title: `${name} loan request rejected`,
        message: `${name}'s ${money(metadata.requestedAmount)} loan request for ${month} was rejected.`,
      };
    case "LOAN_DISBURSED":
      return {
        title: `${name} loan disbursed`,
        message: `${name}'s ${money(metadata.amount)} ${metadata.originType === "TOP_UP" ? "loan top-up" : "loan"} was disbursed for ${month}.`,
      };
    case "LOAN_REPAYMENT_POSTED": {
      const parts = [
        Number(metadata.principalAmount || 0) > 0 ? `${money(metadata.principalAmount)} loan principal` : "",
        Number(metadata.interestAmount || 0) > 0 ? `${money(metadata.interestAmount)} loan interest` : "",
      ];
      return {
        title: `${name} loan repayment posted`,
        message: `${name} paid ${joinParts(parts)} for ${month}.`,
      };
    }
    case "PENALTY_ASSESSED":
      return {
        title: `${name} penalty assessed`,
        message: `${name} was assessed a ${money(metadata.amount)} penalty for ${month}.`,
      };
    case "PENALTY_PAYMENT_POSTED":
      return {
        title: `${name} penalty payment posted`,
        message: `${name}'s penalty payment was posted for ${month}.`,
      };
    case "PENALTY_CONVERTED_TO_LOAN":
      return {
        title: `${name} penalty converted to loan`,
        message: `${name}'s ${money(Number(metadata.amountAssessed || 0) - Number(metadata.amountPaid || 0))} penalty was converted to a loan for ${month}.`,
      };
    case "COMMON_INTEREST_POSTED":
      return {
        title: `Common interest posted for ${month}`,
        message: `Common interest for ${month} has been posted: ${money(metadata.commonInterestPool)} shared across ${metadata.allocations || 0} allocation${Number(metadata.allocations || 0) === 1 ? "" : "s"}.`,
      };
    case "MONTHLY_CLOSING_COMPLETED":
      return {
        title: `${month} closing completed`,
        message: `${month} closing has been completed${metadata.locked ? " and locked" : ""}.`,
      };
    default:
      return { title: input.title, message: input.message };
  }
}

async function contextFor(db, input = {}) {
  const runQuery = typeof db === "function" ? db : db?.query;
  if (!runQuery || (!input.cycleMemberId && !input.cycleMonthId && !input.cycleId)) return {};
  const { rows } = await runQuery(
    `SELECT m.first_name, m.last_name, m.member_code, cmn.month_number, c.name AS cycle_name
     FROM (SELECT $1::uuid AS cycle_member_id, $2::uuid AS cycle_month_id, $3::uuid AS cycle_id) input
     LEFT JOIN cycle_members cycle_member ON cycle_member.id = input.cycle_member_id
     LEFT JOIN members m ON m.id = cycle_member.member_id
     LEFT JOIN cycle_months cmn ON cmn.id = input.cycle_month_id
     LEFT JOIN cycles c ON c.id = COALESCE(cmn.cycle_id, cycle_member.cycle_id, input.cycle_id)
     LIMIT 1`,
    [input.cycleMemberId || null, input.cycleMonthId || null, input.cycleId || null]
  );
  return rows[0] || {};
}

function writeEvent(res, eventName, data) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function audienceMatches(event, user = {}) {
  const directRecipients = event.recipientUserIds || [];
  if (directRecipients.length) return directRecipients.includes(user.id);
  return !event.audience || event.audience === "ALL" || event.audience === user.role;
}

async function persistNotification(db, event) {
  const runQuery = typeof db === "function" ? db : db?.query;
  if (!runQuery) return event;
  const { rows } = await runQuery(
    `INSERT INTO notifications
      (type, title, message, audience, severity, cycle_id, cycle_month_id, cycle_member_id,
       source_table, source_id, action_url, action_target, metadata, recipient_mode, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [
      event.type,
      event.title,
      event.message,
      event.audience,
      event.severity,
      event.cycleId,
      event.cycleMonthId,
      event.cycleMemberId,
      event.sourceTable,
      event.sourceId,
      event.actionUrl,
      event.actionTarget ? JSON.stringify(event.actionTarget) : null,
      JSON.stringify(event.metadata || {}),
      event.recipientUserIds?.length ? "USERS" : "AUDIENCE",
      event.expiresAt || null,
    ]
  );
  const saved = rows[0]?.id ? toCamelEvent(rows[0]) : event;
  const recipientUserIds = Array.from(new Set((event.recipientUserIds || []).filter(Boolean)));
  if (saved.id && recipientUserIds.length) {
    await runQuery(
      `INSERT INTO notification_recipients (notification_id, user_id)
       SELECT $1, unnest($2::uuid[])
       ON CONFLICT (notification_id, user_id) DO NOTHING`,
      [saved.id, recipientUserIds]
    );
  }
  return recipientUserIds.length ? { ...saved, recipientUserIds } : saved;
}

function broadcastNotification(event) {
  for (const [clientId, client] of clients.entries()) {
    try {
      if (!audienceMatches(event, client.user)) continue;
      writeEvent(client.res, "notification", event);
    } catch {
      clients.delete(clientId);
    }
  }
}

async function publishFanout(event) {
  if (!env.notificationsRedisFanoutEnabled || !redisEnabled()) {
    broadcastNotification(event);
    return;
  }
  const publisher = getRedisPublisherConnection();
  try {
    await publisher.connect().catch((error) => {
      if (error.message?.includes("already connecting") || error.message?.includes("already connected")) return;
      throw error;
    });
    await publisher.publish(FANOUT_CHANNEL, JSON.stringify(event));
  } catch (error) {
    console.warn(`Redis notification fanout failed: ${error.message}`);
    broadcastNotification(event);
  }
}

export function publishNotification(input) {
  const event = normalizeEvent(input);
  events = [event, ...events].slice(0, MAX_EVENTS);
  broadcastNotification(event);
  return event;
}

export async function publishPersistentNotification(db, input) {
  const fallback = normalizeEvent(input);
  try {
    const event = await persistNotification(db, fallback);
    events = [event, ...events.filter((item) => item.id !== event.id)].slice(0, MAX_EVENTS);
    await publishFanout(event);
    return event;
  } catch {
    return publishNotification(fallback);
  }
}

export async function publishActivityNotification(db, input) {
  try {
    const context = await contextFor(db, input);
    const copy = {
      ...input,
      actionTarget: input.actionTarget || targetFor(input.type),
      metadata: {
        ...(input.metadata || {}),
        memberName: memberLabel(context),
        memberCode: context.member_code || null,
        monthNumber: context.month_number || null,
        cycleName: context.cycle_name || null,
      },
    };
    const text = messageFor(copy, context);
    return publishPersistentNotification(db, { ...copy, ...text });
  } catch {
    return publishPersistentNotification(db, { ...input, actionTarget: input.actionTarget || targetFor(input.type) });
  }
}

export function queueActivityNotification(db, input) {
  if (env.notificationsQueueEnabled && redisEnabled()) {
    import("./notificationQueueService.js")
      .then(({ addNotificationJob }) => addNotificationJob(input))
      .catch(() => {
        setTimeout(() => publishActivityNotification(db, input).catch(() => null), 0);
      });
    return;
  }
  setTimeout(() => publishActivityNotification(db, input).catch(() => null), 0);
}

export function recentNotifications({ limit = 50 } = {}) {
  return events.slice(0, Math.max(1, Math.min(Number(limit) || 50, MAX_EVENTS)));
}

export async function listNotifications(db, { user, limit = 50 } = {}) {
  const runQuery = typeof db === "function" ? db : db?.query;
  const bounded = Math.max(1, Math.min(Number(limit) || 50, MAX_EVENTS));
  if (!runQuery) {
    const data = recentNotifications({ limit: bounded }).filter((event) => audienceMatches(event, user));
    return { data, unreadCount: data.length };
  }
  const { rows } = await runQuery(
    `SELECT n.*, r.read_at
     FROM notifications n
     LEFT JOIN notification_read_receipts r
       ON r.notification_id = n.id AND r.user_id = $1
     WHERE n.archived_at IS NULL
       AND (
         n.recipient_mode = 'AUDIENCE' AND (n.audience = 'ALL' OR n.audience = $2)
         OR EXISTS (
           SELECT 1 FROM notification_recipients nr
           WHERE nr.notification_id = n.id AND nr.user_id = $1
         )
       )
     ORDER BY n.created_at DESC
     LIMIT $3`,
    [user.id, user.role, bounded]
  );
  const data = rows.map(toCamelEvent);
  const unreadCount = data.filter((event) => !event.readAt).length;
  return { data, unreadCount };
}

export async function countUnreadNotifications(db, { user } = {}) {
  const runQuery = typeof db === "function" ? db : db?.query;
  if (!runQuery || !user?.id) return 0;
  const { rows } = await runQuery(
    `SELECT COUNT(*)::int AS unread_count
     FROM notifications n
     WHERE n.archived_at IS NULL
       AND (
         n.recipient_mode = 'AUDIENCE' AND (n.audience = 'ALL' OR n.audience = $2)
         OR EXISTS (
           SELECT 1 FROM notification_recipients nr
           WHERE nr.notification_id = n.id AND nr.user_id = $1
         )
       )
       AND NOT EXISTS (
         SELECT 1
         FROM notification_read_receipts r
         WHERE r.notification_id = n.id AND r.user_id = $1
       )`,
    [user.id, user.role]
  );
  return Number(rows[0]?.unread_count || 0);
}

export async function markNotificationsRead(db, { userId, notificationIds = [] } = {}) {
  const runQuery = typeof db === "function" ? db : db?.query;
  if (!runQuery || !userId || !notificationIds.length) return { read: 0 };
  const { rowCount } = await runQuery(
    `INSERT INTO notification_read_receipts (notification_id, user_id)
     SELECT id, $1
     FROM notifications
     WHERE id = ANY($2::uuid[])
     ON CONFLICT (notification_id, user_id) DO NOTHING`,
    [userId, notificationIds]
  );
  return { read: rowCount || 0 };
}

export async function archiveExpiredNotifications(db, { retentionDays = env.notificationRetentionDays, reason = "Retention policy" } = {}) {
  const runQuery = typeof db === "function" ? db : db?.query;
  if (!runQuery) return { archived: 0 };
  const { rowCount } = await runQuery(
    `UPDATE notifications
     SET archived_at = now(), archived_reason = $2
     WHERE archived_at IS NULL
       AND (
         (expires_at IS NOT NULL AND expires_at <= now())
         OR created_at < now() - ($1::int * interval '1 day')
       )`,
    [retentionDays, reason]
  );
  return { archived: rowCount || 0 };
}

export async function startNotificationFanoutSubscriber() {
  if (subscriberStarted || !env.notificationsRedisFanoutEnabled || !redisEnabled()) return null;
  const subscriber = getRedisSubscriberConnection();
  try {
    await subscriber.connect().catch((error) => {
      if (error.message?.includes("already connecting") || error.message?.includes("already connected")) return;
      throw error;
    });
    await subscriber.subscribe(FANOUT_CHANNEL);
    subscriber.on("message", (channel, payload) => {
      if (channel !== FANOUT_CHANNEL) return;
      try {
        const event = JSON.parse(payload);
        events = [event, ...events.filter((item) => item.id !== event.id)].slice(0, MAX_EVENTS);
        broadcastNotification(event);
      } catch {
        // Ignore malformed pub/sub messages.
      }
    });
    subscriberStarted = true;
    return subscriber;
  } catch (error) {
    console.warn(`Redis notification subscriber unavailable: ${error.message}`);
    return null;
  }
}

export async function streamNotifications(req, res, db) {
  const clientId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  clients.set(clientId, { res, user: req.user });
  writeEvent(res, "ready", { clientId, connectedAt: new Date().toISOString() });
  const { data } = await listNotifications(db, { user: req.user, limit: 25 }).catch(() => ({
    data: recentNotifications({ limit: 25 }).filter((event) => audienceMatches(event, req.user)),
  }));
  for (const event of data.reverse()) {
    writeEvent(res, "notification", event);
  }

  const heartbeat = setInterval(() => {
    if (!clients.has(clientId)) return;
    writeEvent(res, "heartbeat", { at: new Date().toISOString() });
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(clientId);
  });
}

export function clearNotificationsForTests() {
  events = [];
  nextId = 1;
  clients.clear();
}
