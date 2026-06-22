import express from "express";
import { z } from "zod";
import { query, withTransaction } from "../../db/pool.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { requireConsistentCycleReferences, requireCycleMemberAccessFromBody, requireUnlockedMonthForDeclarationParam, requireUnlockedMonthFromBody } from "../../middleware/domainGuards.js";
import { validate } from "../../middleware/validate.js";
import { audit } from "../../services/auditService.js";
import { publishNotification } from "../../services/notificationService.js";
import { postLedger } from "../../services/ledgerService.js";
import {
  assertDeclarationCanBeSubmitted,
  assertDeclarationCanBeCancelled,
  assertDeclarationCanCreateLoanRequest,
  assertDraftCanBeSaved,
  assertMissedDeclarationCanBeMarked,
  loanIntentAmount,
  loanIntentOriginType,
  resolveDeclarationStatus,
} from "../../services/declarationService.js";
import {
  buildPaymentProofUploadSignature,
  resourceTypeForContentType,
  signedPaymentProofUrl,
  validateCloudinaryUploadResult,
  validatePaymentProofRequest,
} from "../../services/paymentProofService.js";
import { badRequest, forbidden, notFound } from "../../utils/httpError.js";

export const declarationsRouter = express.Router();
declarationsRouter.use(requireAuth);

const declarationSchema = z.object({
  cycleId: z.string().uuid(),
  cycleMonthId: z.string().uuid(),
  cycleMemberId: z.string().uuid(),
  savingsAmount: z.number().nonnegative().default(0),
  loanRequestAmount: z.number().nonnegative().default(0),
  loanTopUpAmount: z.number().nonnegative().default(0),
  principalRepaymentAmount: z.number().nonnegative().default(0),
  loanInterestRepaymentAmount: z.number().nonnegative().default(0),
  commonInterestPaymentAmount: z.number().nonnegative().default(0),
  otherObligationAmount: z.number().nonnegative().default(0),
  notes: z.string().optional().nullable(),
  saveAsDraft: z.boolean().optional().default(false),
});

const missedDeclarationSchema = z.object({
  cycleId: z.string().uuid(),
  cycleMonthId: z.string().uuid(),
  cycleMemberId: z.string().uuid(),
  penaltyTypeId: z.string().uuid().optional().nullable(),
  amount: z.number().nonnegative().optional().default(0),
  notes: z.string().optional().nullable(),
});

const proofSignatureSchema = z.object({
  attachmentType: z.enum([
    "SAVINGS_PAYMENT_PROOF",
    "PRINCIPAL_REPAYMENT_PROOF",
    "LOAN_INTEREST_PAYMENT_PROOF",
    "COMMON_INTEREST_PAYMENT_PROOF",
  ]),
  filename: z.string().min(1).max(255),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
  fileSizeBytes: z.number().int().positive(),
});

const proofConfirmSchema = z.object({
  attachmentType: proofSignatureSchema.shape.attachmentType,
  expectedPublicId: z.string().min(1),
  originalFilename: z.string().min(1).max(255),
  contentType: proofSignatureSchema.shape.contentType,
  fileSizeBytes: z.number().int().positive(),
  cloudinary: z.object({
    assetId: z.string().optional().nullable(),
    publicId: z.string().min(1),
    resourceType: z.string().min(1),
    deliveryType: z.string().optional().nullable(),
    format: z.string().optional().nullable(),
    version: z.number().int().optional().nullable(),
    bytes: z.number().int().positive().optional().nullable(),
    secureUrl: z.string().optional().nullable(),
  }),
});

async function getDeclarationForAccess(id, { lock = false, client = null } = {}) {
  const db = client || { query };
  const { rows } = await db.query(
    `SELECT d.*, cm.status AS cycle_month_status, m.user_id
     FROM declarations d
     JOIN cycle_months cm ON cm.id = d.cycle_month_id
     JOIN cycle_members cycle_member ON cycle_member.id = d.cycle_member_id
     JOIN members m ON m.id = cycle_member.member_id
     WHERE d.id = $1${lock ? " FOR UPDATE" : ""}`,
    [id]
  );
  return rows[0] || null;
}

function assertDeclarationAccess(req, declaration) {
  if (!declaration) throw notFound("Declaration not found");
  if (["ADMIN", "AUDITOR"].includes(req.user.role)) return;
  if (String(declaration.user_id) !== String(req.user.id)) {
    throw forbidden("You can only access your own declaration proofs");
  }
}

function attachmentRowsQuery(ownerWhere = "") {
  return `SELECT da.*
    FROM declaration_attachments da
    JOIN declarations d ON d.id = da.declaration_id
    JOIN cycle_members cm ON cm.id = d.cycle_member_id
    JOIN members m ON m.id = cm.member_id
    WHERE da.declaration_id = $1
      AND da.status <> 'DELETED'
      ${ownerWhere}
    ORDER BY da.uploaded_at DESC`;
}

declarationsRouter.get("/queue", requireRole("ADMIN", "AUDITOR"), async (req, res, next) => {
  try {
    const cycleId = req.query.cycleId;
    let cycleMonthId = req.query.cycleMonthId;

    if (!cycleMonthId) {
      const activeMonth = await query(
        `SELECT cm.id
         FROM cycle_months cm
         JOIN cycles c ON c.id = cm.cycle_id
         WHERE c.status = 'ACTIVE'
         ORDER BY
           CASE cm.status
             WHEN 'DECLARATION_PERIOD' THEN 1
             WHEN 'OPEN' THEN 2
             ELSE 3
           END,
           cm.month_number
         LIMIT 1`
      );
      cycleMonthId = activeMonth.rows[0]?.id;
    }

    if (!cycleMonthId) return res.json({ data: { cycleMonth: null, declarations: [], missed: [] } });

    const params = [cycleMonthId];
    let cycleFilter = "";
    if (cycleId) {
      params.push(cycleId);
      cycleFilter = ` AND cm.cycle_id = $${params.length}`;
    }

    const month = await query(
      `SELECT cm.*, c.name AS cycle_name
       FROM cycle_months cm
       JOIN cycles c ON c.id = cm.cycle_id
       WHERE cm.id = $1${cycleFilter}`,
      params
    );
    if (!month.rows[0]) return res.json({ data: { cycleMonth: null, declarations: [], missed: [] } });

    const declarations = await query(
      `SELECT d.*, m.first_name, m.last_name, m.member_code,
        cm.member_id,
        CASE
          WHEN d.loan_request_amount > 0 OR d.loan_top_up_amount > 0 THEN TRUE
          ELSE FALSE
        END AS has_loan_intent,
        EXISTS (
          SELECT 1 FROM loan_requests lr
          WHERE lr.declaration_id = d.id
        ) AS has_loan_request
       FROM declarations d
       JOIN cycle_members cm ON cm.id = d.cycle_member_id
       JOIN members m ON m.id = cm.member_id
       WHERE d.cycle_month_id = $1
       ORDER BY d.submitted_at DESC`,
      [cycleMonthId]
    );

    const missed = await query(
      `SELECT cm.id AS cycle_member_id, cm.cycle_id, m.id AS member_id, m.first_name, m.last_name, m.member_code,
        pt.id AS failure_penalty_type_id,
        pt.amount AS failure_penalty_amount,
        EXISTS (
          SELECT 1
          FROM penalties p
          WHERE p.cycle_month_id = $1
            AND p.cycle_member_id = cm.id
            AND p.penalty_type_id = pt.id
            AND p.status <> 'REVERSED'
        ) AS has_failure_penalty
       FROM cycle_members cm
       JOIN members m ON m.id = cm.member_id
       LEFT JOIN penalty_types pt ON pt.cycle_id = cm.cycle_id AND pt.code = 'FAILURE_TO_DECLARE'
       WHERE cm.status = 'ACTIVE'
         AND cm.cycle_id = (SELECT cycle_id FROM cycle_months WHERE id = $1)
         AND NOT EXISTS (
           SELECT 1 FROM declarations d
           WHERE d.cycle_month_id = $1 AND d.cycle_member_id = cm.id
         )
       ORDER BY m.first_name, m.last_name`,
      [cycleMonthId]
    );

    res.json({ data: { cycleMonth: month.rows[0] || null, declarations: declarations.rows, missed: missed.rows } });
  } catch (error) {
    next(error);
  }
});

declarationsRouter.get("/", async (req, res, next) => {
  try {
    const params = [];
    let where = "WHERE 1=1";
    if (req.query.cycleMonthId) {
      params.push(req.query.cycleMonthId);
      where += ` AND d.cycle_month_id = $${params.length}`;
    }
    if (req.user.role === "MEMBER") {
      params.push(req.user.id);
      where += ` AND m.user_id = $${params.length}`;
    }
    const { rows } = await query(
      `SELECT d.*, m.first_name, m.last_name
       FROM declarations d
       JOIN cycle_members cm ON cm.id = d.cycle_member_id
       JOIN members m ON m.id = cm.member_id
       ${where}
       ORDER BY d.submitted_at DESC`,
      params
    );
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
});

declarationsRouter.post("/", validate(declarationSchema), requireConsistentCycleReferences(), requireCycleMemberAccessFromBody(), requireUnlockedMonthFromBody(), async (req, res, next) => {
  try {
    const month = await query("SELECT * FROM cycle_months WHERE id = $1", [req.body.cycleMonthId]);
    if (!month.rows[0]) {
      const error = new Error("Cycle month not found");
      error.status = 404;
      throw error;
    }
    const now = new Date();
    const m = month.rows[0];
    const withinWindow = now >= new Date(m.declaration_window_start) && now <= new Date(`${m.declaration_window_end}T23:59:59`);
    const status = resolveDeclarationStatus({ saveAsDraft: req.body.saveAsDraft, isWithinWindow: withinWindow, input: req.body });
    const result = await withTransaction(async (client) => {
      const existing = await client.query(
        "SELECT * FROM declarations WHERE cycle_month_id = $1 AND cycle_member_id = $2 FOR UPDATE",
        [req.body.cycleMonthId, req.body.cycleMemberId]
      );
      const before = existing.rows[0] || null;
      if (req.body.saveAsDraft) {
        assertDraftCanBeSaved(before);
      } else {
        assertDeclarationCanBeSubmitted(before);
      }
      if (before) {
        const existingPostings = await client.query(
          "SELECT id FROM ledger_transactions WHERE source_table = 'declarations' AND source_id = $1 LIMIT 1",
          [before.id]
        );
        if (existingPostings.rows[0]) {
          const error = new Error("This declaration has financial postings. Reverse or cancel the posted transactions before resubmitting.");
          error.status = 409;
          throw error;
        }
      }
      const { rows } = await client.query(
        `INSERT INTO declarations
          (cycle_id, cycle_month_id, cycle_member_id, savings_amount, loan_request_amount, loan_top_up_amount,
           principal_repayment_amount, loan_interest_repayment_amount, common_interest_payment_amount,
           other_obligation_amount, status, submitted_by, is_within_window, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (cycle_month_id, cycle_member_id) DO UPDATE SET
           savings_amount = EXCLUDED.savings_amount,
           loan_request_amount = EXCLUDED.loan_request_amount,
           loan_top_up_amount = EXCLUDED.loan_top_up_amount,
           principal_repayment_amount = EXCLUDED.principal_repayment_amount,
           loan_interest_repayment_amount = EXCLUDED.loan_interest_repayment_amount,
           common_interest_payment_amount = EXCLUDED.common_interest_payment_amount,
           other_obligation_amount = EXCLUDED.other_obligation_amount,
           status = EXCLUDED.status,
           submitted_by = EXCLUDED.submitted_by,
           is_within_window = EXCLUDED.is_within_window,
           submitted_at = now(),
           updated_at = now(),
           notes = EXCLUDED.notes
         RETURNING *`,
        [
          req.body.cycleId,
          req.body.cycleMonthId,
          req.body.cycleMemberId,
          req.body.savingsAmount,
          req.body.loanRequestAmount,
          req.body.loanTopUpAmount,
          req.body.principalRepaymentAmount,
          req.body.loanInterestRepaymentAmount,
          req.body.commonInterestPaymentAmount,
          req.body.otherObligationAmount,
          status,
          req.user.id,
          withinWindow,
          req.body.notes || null,
        ]
      );
      await audit(client, {
        actorUserId: req.user.id,
        action: before ? "UPDATE" : "CREATE",
        entityTable: "declarations",
        entityId: rows[0].id,
        beforeData: before,
        afterData: rows[0],
        reason: req.body.saveAsDraft ? "Declaration draft saved" : "Declaration submitted",
        req,
      });
      return rows[0];
    });
    publishNotification({
      type: result.status === "DRAFT" ? "DECLARATION_DRAFT_SAVED" : "DECLARATION_SUBMITTED",
      title: result.status === "DRAFT" ? "Declaration draft saved" : "Declaration submitted",
      message: result.status === "DRAFT"
        ? "A member saved a declaration draft."
        : "A member submitted a declaration for group review.",
      cycleId: result.cycle_id,
      cycleMonthId: result.cycle_month_id,
      cycleMemberId: result.cycle_member_id,
      sourceTable: "declarations",
      sourceId: result.id,
      actionUrl: "reports:declarations",
      metadata: {
        status: result.status,
        savingsAmount: result.savings_amount,
        loanRequestAmount: result.loan_request_amount,
        loanTopUpAmount: result.loan_top_up_amount,
        principalRepaymentAmount: result.principal_repayment_amount,
        loanInterestRepaymentAmount: result.loan_interest_repayment_amount,
        commonInterestPaymentAmount: result.common_interest_payment_amount,
      },
    });
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

declarationsRouter.post("/missed", requireRole("ADMIN"), validate(missedDeclarationSchema), requireConsistentCycleReferences(), requireUnlockedMonthFromBody(), async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const existingDeclaration = await client.query(
        "SELECT * FROM declarations WHERE cycle_month_id = $1 AND cycle_member_id = $2 FOR UPDATE",
        [req.body.cycleMonthId, req.body.cycleMemberId]
      );
      assertMissedDeclarationCanBeMarked(existingDeclaration.rows[0]);

      let declaration = existingDeclaration.rows[0];
      if (!declaration) {
        const created = await client.query(
          `INSERT INTO declarations
            (cycle_id, cycle_month_id, cycle_member_id, status, submitted_by, is_within_window, notes)
           VALUES ($1,$2,$3,'MISSED',$4,FALSE,$5)
           RETURNING *`,
          [req.body.cycleId, req.body.cycleMonthId, req.body.cycleMemberId, req.user.id, req.body.notes || "Marked missed from declaration queue"]
        );
        declaration = created.rows[0];
        await audit(client, {
          actorUserId: req.user.id,
          action: "CREATE",
          entityTable: "declarations",
          entityId: declaration.id,
          afterData: declaration,
          reason: "Marked missed from declaration queue",
          req,
        });
      }

      let penalty = null;
      if (req.body.penaltyTypeId && Number(req.body.amount || 0) > 0) {
        const existingPenalty = await client.query(
          `SELECT * FROM penalties
           WHERE cycle_month_id = $1
             AND cycle_member_id = $2
             AND penalty_type_id = $3
             AND status <> 'REVERSED'
           LIMIT 1`,
          [req.body.cycleMonthId, req.body.cycleMemberId, req.body.penaltyTypeId]
        );
        penalty = existingPenalty.rows[0] || null;
        if (!penalty) {
          const ledger = await postLedger(client, {
            cycleId: req.body.cycleId,
            cycleMonthId: req.body.cycleMonthId,
            cycleMemberId: req.body.cycleMemberId,
            transactionType: "PENALTY_ASSESSMENT",
            amount: req.body.amount,
            description: "Failure to declare penalty",
            postedBy: req.user.id,
            entries: [
              { accountType: "PENALTY", debit: req.body.amount },
              { accountType: "ADJUSTMENT", credit: req.body.amount },
            ],
          });
          const createdPenalty = await client.query(
            `INSERT INTO penalties
              (cycle_id, cycle_month_id, cycle_member_id, penalty_type_id, amount_assessed, assessed_by, assessment_ledger_transaction_id, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             RETURNING *`,
            [
              req.body.cycleId,
              req.body.cycleMonthId,
              req.body.cycleMemberId,
              req.body.penaltyTypeId,
              req.body.amount,
              req.user.id,
              ledger.id,
              req.body.notes || "Assessed from missed declaration queue",
            ]
          );
          penalty = createdPenalty.rows[0];
        }
      }

      return { declaration, penalty };
    });
    publishNotification({
      type: "DECLARATION_MARKED_MISSED",
      title: "Declaration marked missed",
      message: result.penalty ? "A missed declaration was recorded and a penalty was assessed." : "A missed declaration was recorded.",
      cycleId: result.declaration.cycle_id,
      cycleMonthId: result.declaration.cycle_month_id,
      cycleMemberId: result.declaration.cycle_member_id,
      sourceTable: "declarations",
      sourceId: result.declaration.id,
      actionUrl: "reports:declarations",
      metadata: {
        penaltyId: result.penalty?.id || null,
        penaltyAmount: result.penalty?.amount_assessed || 0,
      },
    });
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

declarationsRouter.get("/attachments/:attachmentId/download-url", async (req, res, next) => {
  try {
    const params = [req.params.attachmentId];
    let ownerWhere = "";
    if (req.user.role === "MEMBER") {
      params.push(req.user.id);
      ownerWhere = " AND m.user_id = $2";
    }
    const { rows } = await query(
      `SELECT da.*
       FROM declaration_attachments da
       JOIN declarations d ON d.id = da.declaration_id
       JOIN cycle_members cm ON cm.id = d.cycle_member_id
       JOIN members m ON m.id = cm.member_id
       WHERE da.id = $1
         AND da.status <> 'DELETED'
         ${ownerWhere}`,
      params
    );
    const attachment = rows[0];
    if (!attachment) throw notFound("Payment proof not found");
    res.json({
      data: {
        url: signedPaymentProofUrl(attachment, { asAttachment: req.query.download === "true" }),
        expiresInSeconds: 300,
      },
    });
  } catch (error) {
    next(error);
  }
});

declarationsRouter.get("/:id/attachments", async (req, res, next) => {
  try {
    const declaration = await getDeclarationForAccess(req.params.id);
    assertDeclarationAccess(req, declaration);
    const params = [req.params.id];
    let ownerWhere = "";
    if (req.user.role === "MEMBER") {
      params.push(req.user.id);
      ownerWhere = `AND m.user_id = $${params.length}`;
    }
    const { rows } = await query(attachmentRowsQuery(ownerWhere), params);
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
});

declarationsRouter.post("/:id/attachments/upload-signature", validate(proofSignatureSchema), requireUnlockedMonthForDeclarationParam(), async (req, res, next) => {
  try {
    const declaration = await getDeclarationForAccess(req.params.id);
    assertDeclarationAccess(req, declaration);
    validatePaymentProofRequest({
      declaration,
      attachmentType: req.body.attachmentType,
      contentType: req.body.contentType,
      fileSizeBytes: req.body.fileSizeBytes,
    });
    const signature = buildPaymentProofUploadSignature({
      declaration,
      attachmentType: req.body.attachmentType,
      contentType: req.body.contentType,
    });
    res.json({ data: signature });
  } catch (error) {
    next(error);
  }
});

declarationsRouter.post("/:id/attachments", validate(proofConfirmSchema), requireUnlockedMonthForDeclarationParam(), async (req, res, next) => {
  try {
    const attachment = await withTransaction(async (client) => {
      const declaration = await getDeclarationForAccess(req.params.id, { lock: true, client });
      assertDeclarationAccess(req, declaration);
      validatePaymentProofRequest({
        declaration,
        attachmentType: req.body.attachmentType,
        contentType: req.body.contentType,
        fileSizeBytes: req.body.fileSizeBytes,
      });
      validateCloudinaryUploadResult({
        expectedPublicId: req.body.expectedPublicId,
        expectedResourceType: resourceTypeForContentType(req.body.contentType),
        upload: {
          publicId: req.body.cloudinary.publicId,
          resourceType: req.body.cloudinary.resourceType,
          bytes: req.body.cloudinary.bytes || req.body.fileSizeBytes,
        },
      });
      if (!String(req.body.cloudinary.publicId).includes(`/${declaration.id}/`)) {
        throw badRequest("Uploaded proof does not belong to this declaration.");
      }

      const { rows } = await client.query(
        `INSERT INTO declaration_attachments
          (declaration_id, cycle_id, cycle_month_id, cycle_member_id, uploaded_by,
           attachment_type, cloudinary_asset_id, public_id, resource_type, delivery_type,
           format, version, original_filename, content_type, file_size_bytes, secure_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (public_id) DO UPDATE SET
           original_filename = EXCLUDED.original_filename,
           file_size_bytes = EXCLUDED.file_size_bytes,
           secure_url = EXCLUDED.secure_url,
           updated_at = now()
         RETURNING *`,
        [
          declaration.id,
          declaration.cycle_id,
          declaration.cycle_month_id,
          declaration.cycle_member_id,
          req.user.id,
          req.body.attachmentType,
          req.body.cloudinary.assetId || null,
          req.body.cloudinary.publicId,
          req.body.cloudinary.resourceType,
          req.body.cloudinary.deliveryType || "authenticated",
          req.body.cloudinary.format || null,
          req.body.cloudinary.version || null,
          req.body.originalFilename,
          req.body.contentType,
          req.body.cloudinary.bytes || req.body.fileSizeBytes,
          req.body.cloudinary.secureUrl || null,
        ]
      );
      await audit(client, {
        actorUserId: req.user.id,
        action: "CREATE",
        entityTable: "declaration_attachments",
        entityId: rows[0].id,
        afterData: rows[0],
        reason: "Payment proof uploaded",
        req,
      });
      return rows[0];
    });
    res.status(201).json({ data: attachment });
  } catch (error) {
    next(error);
  }
});

declarationsRouter.get("/:id", async (req, res, next) => {
  try {
    const params = [req.params.id];
    let ownerWhere = "";
    if (req.user.role === "MEMBER") {
      params.push(req.user.id);
      ownerWhere = " AND m.user_id = $2";
    }
    const { rows } = await query(
      `SELECT d.*, m.first_name, m.last_name, m.member_code, cm.member_id,
        c.name AS cycle_name, c.minimum_borrowing_amount,
        c.savings_cap, cycle_months.month_number, cycle_months.status AS cycle_month_status,
        EXISTS (
          SELECT 1 FROM loan_requests lr
          WHERE lr.declaration_id = d.id
        ) AS has_loan_request
       FROM declarations d
       JOIN cycle_members cm ON cm.id = d.cycle_member_id
       JOIN members m ON m.id = cm.member_id
       JOIN cycles c ON c.id = d.cycle_id
       JOIN cycle_months ON cycle_months.id = d.cycle_month_id
       WHERE d.id = $1${ownerWhere}`,
      params
    );
    if (!rows[0]) {
      const error = new Error("Declaration not found");
      error.status = 404;
      throw error;
    }
    res.json({ data: rows[0] });
  } catch (error) {
    next(error);
  }
});

declarationsRouter.patch("/:id", requireRole("ADMIN"), validate(declarationSchema.partial()), requireUnlockedMonthForDeclarationParam(), async (req, res, next) => {
  try {
    const updated = await withTransaction(async (client) => {
      const before = (await client.query("SELECT * FROM declarations WHERE id = $1 FOR UPDATE", [req.params.id])).rows[0];
      if (!before) {
        const error = new Error("Declaration not found");
        error.status = 404;
        throw error;
      }
      if (["CANCELLED", "MISSED"].includes(before.status)) {
        const error = new Error("Cancelled or missed declarations cannot be edited");
        error.status = 409;
        throw error;
      }
      const existingPostings = await client.query(
        "SELECT id FROM ledger_transactions WHERE source_table = 'declarations' AND source_id = $1 LIMIT 1",
        [req.params.id]
      );
      if (existingPostings.rows[0]) {
        const error = new Error("This declaration has financial postings. Reverse or cancel the posted transactions before editing.");
        error.status = 409;
        throw error;
      }

      const { rows } = await client.query(
        `UPDATE declarations SET
          savings_amount = COALESCE($2, savings_amount),
          loan_request_amount = COALESCE($3, loan_request_amount),
          loan_top_up_amount = COALESCE($4, loan_top_up_amount),
          principal_repayment_amount = COALESCE($5, principal_repayment_amount),
          loan_interest_repayment_amount = COALESCE($6, loan_interest_repayment_amount),
          common_interest_payment_amount = COALESCE($7, common_interest_payment_amount),
          other_obligation_amount = COALESCE($8, other_obligation_amount),
          notes = COALESCE($9, notes),
          status = CASE WHEN status = 'APPROVED' THEN 'SUBMITTED'::declaration_status ELSE status END,
          updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [
          req.params.id,
          req.body.savingsAmount,
          req.body.loanRequestAmount,
          req.body.loanTopUpAmount,
          req.body.principalRepaymentAmount,
          req.body.loanInterestRepaymentAmount,
          req.body.commonInterestPaymentAmount,
          req.body.otherObligationAmount,
          req.body.notes,
        ]
      );
      await audit(client, {
        actorUserId: req.user.id,
        action: "UPDATE",
        entityTable: "declarations",
        entityId: req.params.id,
        beforeData: before,
        afterData: rows[0],
        reason: "Declaration inputs edited",
        req,
      });
      return rows[0];
    });
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

declarationsRouter.post("/:id/cancel", requireRole("ADMIN"), requireUnlockedMonthForDeclarationParam(), async (req, res, next) => {
  try {
    const cancelled = await withTransaction(async (client) => {
      const before = (await client.query("SELECT * FROM declarations WHERE id = $1 FOR UPDATE", [req.params.id])).rows[0];
      assertDeclarationCanBeCancelled(before);
      const { rows } = await client.query(
        "UPDATE declarations SET status = 'CANCELLED', updated_at = now() WHERE id = $1 RETURNING *",
        [req.params.id]
      );
      await audit(client, {
        actorUserId: req.user.id,
        action: "UPDATE",
        entityTable: "declarations",
        entityId: req.params.id,
        beforeData: before,
        afterData: rows[0],
        reason: req.body?.reason || "Declaration cancelled",
        req,
      });
      return rows[0];
    });
    res.json({ data: cancelled });
  } catch (error) {
    next(error);
  }
});

declarationsRouter.post("/:id/approve-inputs", requireRole("ADMIN"), requireUnlockedMonthForDeclarationParam(), async (req, res, next) => {
  try {
    const approved = await withTransaction(async (client) => {
      const before = (await client.query("SELECT * FROM declarations WHERE id = $1 FOR UPDATE", [req.params.id])).rows[0];
      if (!before) {
        const error = new Error("Declaration not found");
        error.status = 404;
        throw error;
      }
      if (["CANCELLED", "MISSED"].includes(before.status)) {
        const error = new Error("Cancelled or missed declarations cannot be approved");
        error.status = 409;
        throw error;
      }

      async function hasPosting(transactionType) {
        const existing = await client.query(
          `SELECT id FROM ledger_transactions
           WHERE source_table = 'declarations'
             AND source_id = $1
             AND transaction_type = $2
           LIMIT 1`,
          [before.id, transactionType]
        );
        return existing.rows[0] || null;
      }

      if (Number(before.savings_amount || 0) > 0 && !await hasPosting("SAVINGS_DEPOSIT")) {
        const cycle = (await client.query("SELECT savings_cap FROM cycles WHERE id = $1", [before.cycle_id])).rows[0];
        const currentSavings = await client.query(
          `SELECT COALESCE(SUM(amount),0) AS total
           FROM ledger_transactions
           WHERE cycle_id = $1
             AND cycle_member_id = $2
             AND transaction_type = 'SAVINGS_DEPOSIT'`,
          [before.cycle_id, before.cycle_member_id]
        );
        if (Number(currentSavings.rows[0].total) + Number(before.savings_amount) > Number(cycle.savings_cap)) {
          const error = new Error(`Savings cap exceeded. Remaining principal cap is K${Number(cycle.savings_cap) - Number(currentSavings.rows[0].total)}.`);
          error.status = 400;
          throw error;
        }
        await postLedger(client, {
          cycleId: before.cycle_id,
          cycleMonthId: before.cycle_month_id,
          cycleMemberId: before.cycle_member_id,
          transactionType: "SAVINGS_DEPOSIT",
          amount: Number(before.savings_amount),
          description: "Approved declaration savings deposit",
          sourceTable: "declarations",
          sourceId: before.id,
          postedBy: req.user.id,
          entries: [
            { accountType: "CASH_POOL", debit: Number(before.savings_amount) },
            { accountType: "SAVINGS_PRINCIPAL", credit: Number(before.savings_amount) },
          ],
        });
      }

      let principalLedgerId = null;
      let interestLedgerId = null;
      const existingPrincipal = await hasPosting("PRINCIPAL_REPAYMENT");
      const existingInterest = await hasPosting("LOAN_INTEREST_REPAYMENT");
      if (Number(before.principal_repayment_amount || 0) > 0 && !existingPrincipal) {
        const ledger = await postLedger(client, {
          cycleId: before.cycle_id,
          cycleMonthId: before.cycle_month_id,
          cycleMemberId: before.cycle_member_id,
          transactionType: "PRINCIPAL_REPAYMENT",
          amount: Number(before.principal_repayment_amount),
          description: "Approved declaration principal repayment",
          sourceTable: "declarations",
          sourceId: before.id,
          postedBy: req.user.id,
          entries: [
            { accountType: "CASH_POOL", debit: Number(before.principal_repayment_amount) },
            { accountType: "LOAN_PRINCIPAL", credit: Number(before.principal_repayment_amount) },
          ],
        });
        principalLedgerId = ledger.id;
      }
      if (Number(before.loan_interest_repayment_amount || 0) > 0 && !existingInterest) {
        const ledger = await postLedger(client, {
          cycleId: before.cycle_id,
          cycleMonthId: before.cycle_month_id,
          cycleMemberId: before.cycle_member_id,
          transactionType: "LOAN_INTEREST_REPAYMENT",
          amount: Number(before.loan_interest_repayment_amount),
          description: "Approved declaration loan interest repayment",
          sourceTable: "declarations",
          sourceId: before.id,
          postedBy: req.user.id,
          entries: [
            { accountType: "CASH_POOL", debit: Number(before.loan_interest_repayment_amount) },
            { accountType: "LOAN_INTEREST", credit: Number(before.loan_interest_repayment_amount) },
          ],
        });
        interestLedgerId = ledger.id;
      }
      if (principalLedgerId || interestLedgerId) {
        await client.query(
          `INSERT INTO loan_repayments
            (cycle_id, cycle_month_id, cycle_member_id, principal_amount, interest_amount,
             principal_ledger_transaction_id, interest_ledger_transaction_id, posted_by, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            before.cycle_id,
            before.cycle_month_id,
            before.cycle_member_id,
            principalLedgerId ? Number(before.principal_repayment_amount || 0) : 0,
            interestLedgerId ? Number(before.loan_interest_repayment_amount || 0) : 0,
            principalLedgerId,
            interestLedgerId,
            req.user.id,
            "Posted from approved declaration",
          ]
        );
      }

      if (Number(before.common_interest_payment_amount || 0) > 0 && !await hasPosting("COMMON_INTEREST_PAYMENT")) {
        await postLedger(client, {
          cycleId: before.cycle_id,
          cycleMonthId: before.cycle_month_id,
          cycleMemberId: before.cycle_member_id,
          transactionType: "COMMON_INTEREST_PAYMENT",
          amount: Number(before.common_interest_payment_amount),
          description: "Approved declaration common-interest payment",
          sourceTable: "declarations",
          sourceId: before.id,
          postedBy: req.user.id,
          entries: [
            { accountType: "CASH_POOL", debit: Number(before.common_interest_payment_amount) },
            { accountType: "COMMON_INTEREST", credit: Number(before.common_interest_payment_amount) },
          ],
        });
      }

      if (loanIntentAmount(before) > 0) {
        const existingLoanRequest = await client.query("SELECT id FROM loan_requests WHERE declaration_id = $1 LIMIT 1", [before.id]);
        if (!existingLoanRequest.rows[0]) {
          const { rows: loanRows } = await client.query(
            `INSERT INTO loan_requests
              (cycle_id, cycle_month_id, cycle_member_id, declaration_id, requested_amount, origin_type, notes)
             VALUES ($1,$2,$3,$4,$5,$6,'Created from approved declaration')
             RETURNING *`,
            [
              before.cycle_id,
              before.cycle_month_id,
              before.cycle_member_id,
              before.id,
              loanIntentAmount(before),
              loanIntentOriginType(before),
            ]
          );
          await audit(client, {
            actorUserId: req.user.id,
            action: "CREATE",
            entityTable: "loan_requests",
            entityId: loanRows[0].id,
            afterData: loanRows[0],
            reason: "Created from approved declaration",
            req,
          });
        }
      }

      const { rows } = await client.query(
        "UPDATE declarations SET status = 'APPROVED', updated_at = now() WHERE id = $1 RETURNING *",
        [req.params.id]
      );
      await audit(client, {
        actorUserId: req.user.id,
        action: "APPROVE",
        entityTable: "declarations",
        entityId: req.params.id,
        beforeData: before,
        afterData: rows[0],
        reason: req.body?.reason || "Declaration inputs approved",
        req,
      });
      return rows[0];
    });
    publishNotification({
      type: "DECLARATION_APPROVED",
      title: "Declaration approved",
      message: "An administrator approved declaration inputs and posted approved financial amounts.",
      cycleId: approved.cycle_id,
      cycleMonthId: approved.cycle_month_id,
      cycleMemberId: approved.cycle_member_id,
      sourceTable: "declarations",
      sourceId: approved.id,
      actionUrl: "reports:declarations",
      metadata: {
        savingsAmount: approved.savings_amount,
        principalRepaymentAmount: approved.principal_repayment_amount,
        loanInterestRepaymentAmount: approved.loan_interest_repayment_amount,
        commonInterestPaymentAmount: approved.common_interest_payment_amount,
        loanRequestAmount: approved.loan_request_amount,
        loanTopUpAmount: approved.loan_top_up_amount,
      },
    });
    res.json({ data: approved });
  } catch (error) {
    next(error);
  }
});

declarationsRouter.post("/:id/create-loan-request", requireRole("ADMIN"), requireUnlockedMonthForDeclarationParam(), async (req, res, next) => {
  try {
    const loanRequest = await withTransaction(async (client) => {
      const declaration = (await client.query("SELECT * FROM declarations WHERE id = $1 FOR UPDATE", [req.params.id])).rows[0];
      assertDeclarationCanCreateLoanRequest(declaration);

      const existing = await client.query("SELECT * FROM loan_requests WHERE declaration_id = $1 LIMIT 1", [declaration.id]);
      if (existing.rows[0]) return existing.rows[0];

      const requestedAmount = loanIntentAmount(declaration);
      const originType = loanIntentOriginType(declaration);
      const { rows } = await client.query(
        `INSERT INTO loan_requests
          (cycle_id, cycle_month_id, cycle_member_id, declaration_id, requested_amount, origin_type, notes)
         VALUES ($1,$2,$3,$4,$5,$6,'Created from declaration review')
         RETURNING *`,
        [
          declaration.cycle_id,
          declaration.cycle_month_id,
          declaration.cycle_member_id,
          declaration.id,
          requestedAmount,
          originType,
        ]
      );
      await audit(client, {
        actorUserId: req.user.id,
        action: "CREATE",
        entityTable: "loan_requests",
        entityId: rows[0].id,
        beforeData: null,
        afterData: rows[0],
        reason: "Created from declaration review",
        req,
      });
      return rows[0];
    });
    publishNotification({
      type: "LOAN_REQUEST_CREATED",
      title: "Loan request created",
      message: "A loan request was created from a declaration.",
      cycleId: loanRequest.cycle_id,
      cycleMonthId: loanRequest.cycle_month_id,
      cycleMemberId: loanRequest.cycle_member_id,
      sourceTable: "loan_requests",
      sourceId: loanRequest.id,
      actionUrl: "reports:loans",
      metadata: {
        requestedAmount: loanRequest.requested_amount,
        originType: loanRequest.origin_type,
        declarationId: loanRequest.declaration_id,
      },
    });
    res.status(201).json({ data: loanRequest });
  } catch (error) {
    next(error);
  }
});
