const declarationAmountFields = [
  "savingsAmount",
  "loanRequestAmount",
  "loanTopUpAmount",
  "principalRepaymentAmount",
  "loanInterestRepaymentAmount",
  "commonInterestPaymentAmount",
  "otherObligationAmount",
];

const loanRequestFields = ["loanRequestAmount", "loanTopUpAmount"];
const windowBoundAmountFields = declarationAmountFields.filter((field) => !loanRequestFields.includes(field));

export function hasDeclarationActivity(input = {}) {
  return declarationAmountFields.some((field) => Number(input[field] || 0) > 0)
    || Boolean(String(input.notes || "").trim());
}

export function hasLoanRequestActivity(input = {}) {
  return loanRequestFields.some((field) => Number(input[field] || 0) > 0);
}

export function hasWindowBoundDeclarationActivity(input = {}) {
  return windowBoundAmountFields.some((field) => Number(input[field] || 0) > 0);
}

export function isLoanOnlyDeclaration(input = {}) {
  return hasLoanRequestActivity(input) && !hasWindowBoundDeclarationActivity(input);
}

export function resolveDeclarationStatus({ saveAsDraft = false, isWithinWindow = true, input = {} }) {
  if (saveAsDraft) return "DRAFT";
  if (!hasDeclarationActivity(input)) {
    const error = new Error("A submitted declaration must include at least one amount or note. Use Save Draft for incomplete declarations.");
    error.status = 400;
    throw error;
  }
  if (!isWithinWindow && isLoanOnlyDeclaration(input)) return "SUBMITTED";
  return isWithinWindow ? "SUBMITTED" : "LATE";
}

export function assertDraftCanBeSaved(existingDeclaration) {
  if (!existingDeclaration || existingDeclaration.status === "DRAFT") return;
  const error = new Error("This declaration has already been submitted. Use Edit Declaration instead of Save Draft.");
  error.status = 409;
  throw error;
}

export function assertDeclarationCanBeCancelled(declaration) {
  if (!declaration) {
    const error = new Error("Declaration not found");
    error.status = 404;
    throw error;
  }
  if (["CANCELLED", "MISSED"].includes(declaration.status)) {
    const error = new Error("Cancelled or missed declarations cannot be cancelled again");
    error.status = 409;
    throw error;
  }
}

export function loanIntentAmount(declaration = {}) {
  return Number(declaration.loan_top_up_amount || 0) > 0
    ? Number(declaration.loan_top_up_amount || 0)
    : Number(declaration.loan_request_amount || 0);
}

export function loanIntentOriginType(declaration = {}) {
  return Number(declaration.loan_top_up_amount || 0) > 0 ? "TOP_UP" : "ORIGINAL_LOAN";
}

export function assertDeclarationCanCreateLoanRequest(declaration) {
  if (!declaration) {
    const error = new Error("Declaration not found");
    error.status = 404;
    throw error;
  }
  if (["CANCELLED", "MISSED"].includes(declaration.status)) {
    const error = new Error("Cancelled or missed declarations cannot create loan requests");
    error.status = 409;
    throw error;
  }
  if (loanIntentAmount(declaration) <= 0) {
    const error = new Error("Declaration has no loan request or top-up amount");
    error.status = 400;
    throw error;
  }
}

export function assertDeclarationCanBeSubmitted(existingDeclaration) {
  if (!existingDeclaration) return;
  if (["APPROVED", "CANCELLED", "MISSED"].includes(existingDeclaration.status)) {
    const error = new Error("This declaration is closed and cannot be replaced by a new submission");
    error.status = 409;
    throw error;
  }
}

export function assertMissedDeclarationCanBeMarked(existingDeclaration) {
  if (!existingDeclaration || existingDeclaration.status === "MISSED") return;
  const error = new Error("Member already has a declaration for this month");
  error.status = 409;
  throw error;
}
