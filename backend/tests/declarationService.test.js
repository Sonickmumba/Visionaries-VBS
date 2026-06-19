import { describe, expect, it } from "vitest";
import {
  assertDeclarationCanBeSubmitted,
  assertDeclarationCanBeCancelled,
  assertDeclarationCanCreateLoanRequest,
  assertDraftCanBeSaved,
  assertMissedDeclarationCanBeMarked,
  hasDeclarationActivity,
  hasLoanRequestActivity,
  hasWindowBoundDeclarationActivity,
  isLoanOnlyDeclaration,
  loanIntentAmount,
  loanIntentOriginType,
  resolveDeclarationStatus,
} from "../src/services/declarationService.js";

describe("declaration service", () => {
  it("allows empty drafts", () => {
    expect(resolveDeclarationStatus({ saveAsDraft: true, input: {} })).toBe("DRAFT");
  });

  it("marks submitted declarations by declaration window", () => {
    expect(resolveDeclarationStatus({ isWithinWindow: true, input: { savingsAmount: 100 } })).toBe("SUBMITTED");
    expect(resolveDeclarationStatus({ isWithinWindow: false, input: { savingsAmount: 100 } })).toBe("LATE");
  });

  it("allows loan-only declarations on any day in the month", () => {
    expect(hasLoanRequestActivity({ loanRequestAmount: 5000 })).toBe(true);
    expect(hasWindowBoundDeclarationActivity({ loanRequestAmount: 5000 })).toBe(false);
    expect(isLoanOnlyDeclaration({ loanRequestAmount: 5000, notes: "Needed today" })).toBe(true);
    expect(resolveDeclarationStatus({ isWithinWindow: false, input: { loanRequestAmount: 5000 } })).toBe("SUBMITTED");
    expect(resolveDeclarationStatus({ isWithinWindow: false, input: { loanTopUpAmount: 2000 } })).toBe("SUBMITTED");
    expect(resolveDeclarationStatus({ isWithinWindow: false, input: { loanRequestAmount: 5000, savingsAmount: 100 } })).toBe("LATE");
    expect(resolveDeclarationStatus({ isWithinWindow: false, input: { loanRequestAmount: 5000, principalRepaymentAmount: 100 } })).toBe("LATE");
  });

  it("treats notes as declaration activity", () => {
    expect(hasDeclarationActivity({ notes: "I will pay after the meeting" })).toBe(true);
  });

  it("rejects empty non-draft submissions", () => {
    expect(() => resolveDeclarationStatus({ saveAsDraft: false, input: {} })).toThrow("Use Save Draft");
  });

  it("allows draft saves only before final submission", () => {
    expect(() => assertDraftCanBeSaved(null)).not.toThrow();
    expect(() => assertDraftCanBeSaved({ status: "DRAFT" })).not.toThrow();
    expect(() => assertDraftCanBeSaved({ status: "SUBMITTED" })).toThrow("Use Edit Declaration");
    expect(() => assertDraftCanBeSaved({ status: "APPROVED" })).toThrow("Use Edit Declaration");
  });

  it("allows cancellation only for active declaration records", () => {
    expect(() => assertDeclarationCanBeCancelled({ status: "SUBMITTED" })).not.toThrow();
    expect(() => assertDeclarationCanBeCancelled({ status: "LATE" })).not.toThrow();
    expect(() => assertDeclarationCanBeCancelled({ status: "CANCELLED" })).toThrow("cannot be cancelled again");
    expect(() => assertDeclarationCanBeCancelled({ status: "MISSED" })).toThrow("cannot be cancelled again");
    expect(() => assertDeclarationCanBeCancelled(null)).toThrow("Declaration not found");
  });

  it("blocks replacing closed declarations through submission", () => {
    expect(() => assertDeclarationCanBeSubmitted(null)).not.toThrow();
    expect(() => assertDeclarationCanBeSubmitted({ status: "DRAFT" })).not.toThrow();
    expect(() => assertDeclarationCanBeSubmitted({ status: "SUBMITTED" })).not.toThrow();
    expect(() => assertDeclarationCanBeSubmitted({ status: "APPROVED" })).toThrow("closed");
    expect(() => assertDeclarationCanBeSubmitted({ status: "CANCELLED" })).toThrow("closed");
    expect(() => assertDeclarationCanBeSubmitted({ status: "MISSED" })).toThrow("closed");
  });

  it("derives loan request intent from original loan or top-up fields", () => {
    expect(loanIntentAmount({ loan_request_amount: 5000, loan_top_up_amount: 0 })).toBe(5000);
    expect(loanIntentOriginType({ loan_request_amount: 5000, loan_top_up_amount: 0 })).toBe("ORIGINAL_LOAN");
    expect(loanIntentAmount({ loan_request_amount: 5000, loan_top_up_amount: 2000 })).toBe(2000);
    expect(loanIntentOriginType({ loan_request_amount: 5000, loan_top_up_amount: 2000 })).toBe("TOP_UP");
  });

  it("allows loan request creation only from active declarations with loan intent", () => {
    expect(() => assertDeclarationCanCreateLoanRequest({ status: "SUBMITTED", loan_request_amount: 1000 })).not.toThrow();
    expect(() => assertDeclarationCanCreateLoanRequest({ status: "APPROVED", loan_top_up_amount: 1000 })).not.toThrow();
    expect(() => assertDeclarationCanCreateLoanRequest({ status: "CANCELLED", loan_request_amount: 1000 })).toThrow("cannot create loan requests");
    expect(() => assertDeclarationCanCreateLoanRequest({ status: "MISSED", loan_request_amount: 1000 })).toThrow("cannot create loan requests");
    expect(() => assertDeclarationCanCreateLoanRequest({ status: "SUBMITTED" })).toThrow("no loan request or top-up");
    expect(() => assertDeclarationCanCreateLoanRequest(null)).toThrow("Declaration not found");
  });

  it("marks missed only when no submitted declaration exists", () => {
    expect(() => assertMissedDeclarationCanBeMarked(null)).not.toThrow();
    expect(() => assertMissedDeclarationCanBeMarked({ status: "MISSED" })).not.toThrow();
    expect(() => assertMissedDeclarationCanBeMarked({ status: "SUBMITTED" })).toThrow("already has a declaration");
    expect(() => assertMissedDeclarationCanBeMarked({ status: "LATE" })).toThrow("already has a declaration");
    expect(() => assertMissedDeclarationCanBeMarked({ status: "APPROVED" })).toThrow("already has a declaration");
  });
});
