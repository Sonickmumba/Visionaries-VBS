import { badRequest } from "../utils/httpError.js";

function cents(value = 0) {
  return Math.round(Number(value || 0) * 100);
}

function validateLedgerEntries({ amount, sourceTable, sourceId, entries }) {
  if (!Array.isArray(entries) || entries.length < 2) {
    throw badRequest("Ledger posting requires at least two entries");
  }
  if (!sourceTable && sourceId) {
    throw badRequest("Ledger source table is required when source ID is provided");
  }

  let debit = 0;
  let credit = 0;
  for (const entry of entries) {
    if (!entry.accountType) throw badRequest("Ledger entry account type is required");
    const entryDebit = Number(entry.debit || 0);
    const entryCredit = Number(entry.credit || 0);
    if (entryDebit < 0 || entryCredit < 0) {
      throw badRequest("Ledger entry debit and credit amounts must be non-negative");
    }
    if (entryDebit > 0 && entryCredit > 0) {
      throw badRequest("Ledger entry cannot contain both debit and credit amounts");
    }
    if (entryDebit === 0 && entryCredit === 0) {
      throw badRequest("Ledger entry must contain a debit or credit amount");
    }
    debit += entryDebit;
    credit += entryCredit;
  }

  if (cents(debit) !== cents(credit)) {
    throw badRequest("Ledger entries must balance");
  }
  if (cents(amount) !== cents(debit)) {
    throw badRequest("Ledger transaction amount must match the balanced debit and credit total");
  }
}

export async function postLedger(client, {
  cycleId,
  cycleMonthId = null,
  cycleMemberId = null,
  transactionType,
  amount,
  description,
  sourceTable = null,
  sourceId = null,
  postedBy = null,
  entries,
}) {
  validateLedgerEntries({ amount, sourceTable, sourceId, entries });

  const tx = await client.query(
    `INSERT INTO ledger_transactions
      (cycle_id, cycle_month_id, cycle_member_id, transaction_type, amount, description, source_table, source_id, posted_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [cycleId, cycleMonthId, cycleMemberId, transactionType, amount, description, sourceTable, sourceId, postedBy]
  );
  const ledgerTransaction = tx.rows[0];

  for (const entry of entries) {
    await client.query(
      `INSERT INTO ledger_entries
        (ledger_transaction_id, cycle_id, cycle_member_id, account_type, debit, credit, memo)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        ledgerTransaction.id,
        cycleId,
        entry.cycleMemberId ?? cycleMemberId,
        entry.accountType,
        entry.debit || 0,
        entry.credit || 0,
        entry.memo || null,
      ]
    );
  }

  return ledgerTransaction;
}

export async function reverseLedgerTransaction(client, {
  ledgerTransactionId,
  reason,
  postedBy = null,
}) {
  if (!reason?.trim()) throw badRequest("Reversal reason is required");

  const original = (await client.query(
    "SELECT * FROM ledger_transactions WHERE id = $1",
    [ledgerTransactionId]
  )).rows[0];
  if (!original) {
    const error = new Error("Ledger transaction not found");
    error.status = 404;
    throw error;
  }
  if (original.is_reversal) {
    throw badRequest("A reversal transaction cannot be reversed from this workflow");
  }
  const existing = await client.query(
    "SELECT id FROM ledger_transactions WHERE reversed_transaction_id = $1 LIMIT 1",
    [ledgerTransactionId]
  );
  if (existing.rows[0]) {
    const error = new Error("This ledger transaction has already been reversed");
    error.status = 409;
    throw error;
  }

  const entries = await client.query(
    "SELECT * FROM ledger_entries WHERE ledger_transaction_id = $1 ORDER BY created_at",
    [ledgerTransactionId]
  );
  if (!entries.rows.length) throw badRequest("Cannot reverse a transaction without ledger entries");

  const tx = await client.query(
    `INSERT INTO ledger_transactions
      (cycle_id, cycle_month_id, cycle_member_id, transaction_type, amount, description,
       source_table, source_id, reversed_transaction_id, reversal_reason, posted_by, is_reversal)
     VALUES ($1,$2,$3,'REVERSAL',$4,$5,$6,$7,$8,$9,$10,TRUE)
     RETURNING *`,
    [
      original.cycle_id,
      original.cycle_month_id,
      original.cycle_member_id,
      original.amount,
      `Reversal of ${original.transaction_type}: ${reason}`,
      original.source_table,
      original.source_id,
      original.id,
      reason,
      postedBy,
    ]
  );
  const reversal = tx.rows[0];

  for (const entry of entries.rows) {
    await client.query(
      `INSERT INTO ledger_entries
        (ledger_transaction_id, cycle_id, cycle_member_id, account_type, debit, credit, memo)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        reversal.id,
        entry.cycle_id,
        entry.cycle_member_id,
        entry.account_type,
        entry.credit || 0,
        entry.debit || 0,
        `Reversal of entry ${entry.id}`,
      ]
    );
  }

  return { original, reversal };
}
