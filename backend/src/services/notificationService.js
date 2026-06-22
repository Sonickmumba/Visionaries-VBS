const MAX_EVENTS = 200;
const clients = new Map();
let events = [];
let nextId = 1;

function normalizeEvent(input = {}) {
  const id = String(nextId++);
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
    metadata: input.metadata || {},
    createdAt: new Date().toISOString(),
  };
}

function writeEvent(res, eventName, data) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function publishNotification(input) {
  const event = normalizeEvent(input);
  events = [event, ...events].slice(0, MAX_EVENTS);
  for (const [clientId, res] of clients.entries()) {
    try {
      writeEvent(res, "notification", event);
    } catch {
      clients.delete(clientId);
    }
  }
  return event;
}

export function recentNotifications({ limit = 50 } = {}) {
  return events.slice(0, Math.max(1, Math.min(Number(limit) || 50, MAX_EVENTS)));
}

export function streamNotifications(req, res) {
  const clientId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  clients.set(clientId, res);
  writeEvent(res, "ready", { clientId, connectedAt: new Date().toISOString() });
  for (const event of recentNotifications({ limit: 25 }).reverse()) {
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
