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
    actionTarget: input.actionTarget || null,
    metadata: input.metadata || {},
    createdAt: new Date().toISOString(),
  };
}

function money(value) {
  const amount = Number(value || 0);
  return `K${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function memberLabel(context = {}) {
  return [context.first_name, context.last_name].filter(Boolean).join(" ") || context.member_code || "A member";
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
  if (!db?.query || (!input.cycleMemberId && !input.cycleMonthId && !input.cycleId)) return {};
  const { rows } = await db.query(
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
    return publishNotification({ ...copy, ...text });
  } catch {
    return publishNotification({ ...input, actionTarget: input.actionTarget || targetFor(input.type) });
  }
}

export function queueActivityNotification(db, input) {
  setTimeout(() => {
    publishActivityNotification(db, input).catch(() => null);
  }, 0);
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
