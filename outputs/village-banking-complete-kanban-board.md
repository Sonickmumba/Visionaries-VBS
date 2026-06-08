# Village Banking Web Application
# Complete Implementation Kanban Board

## 1. Board Purpose

This Kanban board defines the full implementation plan for the Village Banking Web Application.

The build order is:

1. Backend foundation using Node.js, Express.js, and PostgreSQL.
2. Backend domain modules and financial rules engine.
3. Backend testing, security, audit, and reporting.
4. Frontend foundation using React and JavaScript.
5. Admin screens and workflows.
6. Member portal screens and responsive layouts.
7. Full integration, QA, deployment, and production readiness.

The board is designed for a scalable application with strong auditability, ledger-based financial tracking, monthly processing, and responsive support for mobile and desktop screens.

## 2. Recommended Kanban Columns

Use these columns:

```text
Backlog
Ready
In Progress
Code Review
Testing
Blocked
Done
Released
```

Optional swimlanes:

```text
Backend
Frontend
Testing / QA
DevOps
Security
Documentation
```

## 3. Priority Levels

```text
P0 - Required for MVP financial correctness
P1 - Required for complete application workflow
P2 - Important for scalability, usability, and admin efficiency
P3 - Enhancement after core release
```

## 4. Definition of Done

A task is done only when:

- implementation is complete,
- validation rules are enforced server-side,
- database migrations are created,
- unit tests are added where applicable,
- integration tests are added for API workflows,
- frontend states are covered where applicable,
- mobile and desktop layouts are checked,
- error states are handled,
- audit trail behavior is verified for sensitive actions,
- documentation or notes are updated.

## 5. Backend Phase 1: Project Foundation

### BE-001: Initialize Backend Project

Priority: P0  
Epic: Backend Foundation

Description:
Create the Express.js backend project using Node.js and JavaScript. The project should be structured for modular growth.

Subtasks:

- Create backend folder structure.
- Initialize `package.json`.
- Install Express, PostgreSQL client, validation, auth, logging, and testing dependencies.
- Configure environment variables.
- Add `.env.example`.
- Add basic health-check endpoint.
- Add centralized error handler.
- Add request logging.
- Add linting and formatting.

Suggested structure:

```text
backend/
  src/
    app.js
    server.js
    config/
    db/
    middleware/
    modules/
    services/
    utils/
    tests/
```

Acceptance Criteria:

- Server starts successfully.
- `GET /health` returns status and timestamp.
- Environment configuration works for development and test.
- Errors return consistent JSON format.

Testing:

- Unit test health endpoint.
- Test missing route returns 404.
- Test error handler returns expected shape.

### BE-002: PostgreSQL Connection and Migration Setup

Priority: P0  
Epic: Backend Foundation

Description:
Set up PostgreSQL connection and database migration workflow.

Subtasks:

- Configure PostgreSQL connection pool.
- Add migration tool such as Knex, node-pg-migrate, Sequelize migrations, or Prisma migrations.
- Create development and test database configs.
- Add migration scripts.
- Add seed script structure.
- Add database reset script for test environment.

Acceptance Criteria:

- Backend can connect to PostgreSQL.
- Migrations can run up and down.
- Test database can be reset automatically.

Testing:

- Test database connection.
- Test migration execution in CI/local test command.

### BE-003: Implement Base Middleware

Priority: P0  
Epic: Backend Foundation

Description:
Add middleware required across the backend.

Subtasks:

- JSON body parser.
- CORS configuration.
- Security headers.
- Request ID middleware.
- Request logger.
- Auth middleware placeholder.
- Role authorization helper.
- Validation middleware.
- Locked-month guard placeholder.

Acceptance Criteria:

- Every request receives a request ID.
- Validation errors are consistent.
- Protected route scaffolding is available.

Testing:

- Middleware unit tests.
- Validation error response tests.
- CORS and security header smoke tests.

## 6. Backend Phase 2: Database Schema

### BE-004: Create Core Enum and Identity Migrations

Priority: P0  
Epic: Database

Description:
Create database enum types and identity tables.

Subtasks:

- Add PostgreSQL enum migrations.
- Create `users`.
- Create `members`.
- Add indexes and uniqueness constraints.
- Add timestamp update trigger or app-level update handling.

Acceptance Criteria:

- Users and members can be created.
- Member may optionally link to a user account.
- Duplicate email is rejected.

Testing:

- Migration tests.
- Model/repository tests for users and members.
- Unique constraint tests.

### BE-005: Create Cycle Configuration Schema

Priority: P0  
Epic: Database

Description:
Implement cycle-related tables.

Subtasks:

- Create `cycles`.
- Create `cycle_months`.
- Create `cycle_members`.
- Create `penalty_types`.
- Add constraints for dates, rates, and non-negative amounts.
- Add indexes for cycle queries.

Acceptance Criteria:

- Cycle rules are persisted per cycle.
- Members can be enrolled into cycles.
- Duplicate enrollment is prevented.
- Cycle months can be generated.

Testing:

- Migration tests.
- Constraint tests.
- Repository tests for cycle creation and member enrollment.

### BE-006: Create Financial Operations Schema

Priority: P0  
Epic: Database

Description:
Implement operational tables for declarations, contributions, loans, penalties, common interest, ledger, snapshots, audit, and overrides.

Subtasks:

- Create `declarations`.
- Create `contribution_payments`.
- Create `loan_requests`.
- Create `loan_disbursements`.
- Create `loan_repayments`.
- Create `penalties`.
- Create `common_interest_runs`.
- Create `common_interest_allocations`.
- Create `ledger_transactions`.
- Create `ledger_entries`.
- Create `monthly_closing_runs`.
- Create `member_monthly_snapshots`.
- Create `cycle_month_summaries`.
- Create `overrides`.
- Create `audit_logs`.
- Add indexes for reporting and member statements.

Acceptance Criteria:

- All financial workflow data can be stored.
- One declaration per member per month is enforced.
- One social fund and one membership fee per member per cycle is enforced.
- Ledger entries can be linked to source workflows.

Testing:

- Migration tests for all tables.
- Foreign key tests.
- Unique constraint tests.
- Index existence checks where useful.

## 7. Backend Phase 3: Authentication and Authorization

### BE-007: Authentication Service

Priority: P0  
Epic: Auth

Description:
Implement login, signup or invitation acceptance, password reset, and session/JWT handling.

Subtasks:

- Password hashing.
- Login endpoint.
- Logout endpoint if using sessions.
- Signup endpoint if member self-registration is allowed.
- Admin-created user invitation endpoint.
- Forgot password endpoint.
- Reset password endpoint.
- Current user endpoint.
- Refresh token/session renewal if used.

Acceptance Criteria:

- Users can log in securely.
- Passwords are never stored in plain text.
- Invalid credentials do not reveal account existence.
- Password reset tokens expire.

Testing:

- Auth unit tests.
- Login success/failure tests.
- Password reset token tests.
- Signup validation tests.

### BE-008: Role-Based Access Control

Priority: P0  
Epic: Security

Description:
Restrict routes by role and ownership.

Subtasks:

- Implement `requireAuth`.
- Implement `requireRole`.
- Implement member ownership checks.
- Implement admin-only financial posting guard.
- Implement auditor read-only access.

Acceptance Criteria:

- Members can only view their own data.
- Admins can manage operational records.
- Auditors can view reports and audit trail but cannot post financial records.

Testing:

- Unauthorized access tests.
- Member ownership tests.
- Admin-only route tests.
- Auditor read-only tests.

## 8. Backend Phase 4: Core Domain Modules

### BE-009: Member Management API

Priority: P0  
Epic: Members

Description:
Implement member CRUD and cycle enrollment APIs.

Subtasks:

- Create member.
- Update member.
- Activate/deactivate member.
- List members with filters.
- Get member detail.
- Enroll member into cycle.
- Deactivate participation in cycle.

Endpoints:

```text
GET /api/members
POST /api/members
GET /api/members/:id
PATCH /api/members/:id
POST /api/cycles/:cycleId/members
PATCH /api/cycles/:cycleId/members/:cycleMemberId
```

Acceptance Criteria:

- Admin can manage members.
- Member list supports search and status filters.
- Member detail returns cycle participation summary.

Testing:

- CRUD tests.
- Enrollment tests.
- Duplicate enrollment tests.
- Permission tests.

### BE-010: Cycle Management API

Priority: P0  
Epic: Cycles

Description:
Implement cycle configuration and cycle month management.

Subtasks:

- Create cycle.
- Edit draft cycle.
- Activate cycle.
- Generate monthly periods.
- Update cycle status.
- Configure penalty types.
- Fetch cycle detail with rules.
- Fetch cycle months.

Endpoints:

```text
GET /api/cycles
POST /api/cycles
GET /api/cycles/:cycleId
PATCH /api/cycles/:cycleId
POST /api/cycles/:cycleId/months/generate
GET /api/cycles/:cycleId/months
POST /api/cycles/:cycleId/penalty-types
```

Acceptance Criteria:

- Cycle-specific rules are stored permanently.
- Months include declaration and payout windows.
- Active cycles cannot have critical rules silently changed without audit.

Testing:

- Cycle creation tests.
- Month generation tests.
- Rate and date validation tests.
- Audit tests for rule changes.

### BE-011: Declaration API

Priority: P0  
Epic: Declarations

Description:
Implement monthly declaration submission and admin review.

Subtasks:

- Submit declaration.
- Save declaration draft if allowed.
- Validate declaration window.
- List declarations by cycle month.
- Get declaration detail.
- Edit declaration before locked month.
- Mark missed declarations during monthly processing.
- Cancel declaration with audit.

Endpoints:

```text
GET /api/declarations
POST /api/declarations
GET /api/declarations/:id
PATCH /api/declarations/:id
POST /api/declarations/:id/cancel
```

Acceptance Criteria:

- One declaration per member per month.
- Submission stores timestamp and within-window flag.
- Missed members can be identified.
- Locked months cannot be edited.

Testing:

- Declaration submission tests.
- Window validation tests.
- Duplicate declaration tests.
- Locked month edit tests.
- Member ownership tests.

### BE-012: Savings and Contributions API

Priority: P0  
Epic: Savings

Description:
Implement savings deposits and one-time contribution posting.

Subtasks:

- Post savings deposit.
- Validate savings principal cap.
- Post social fund payment.
- Post membership fee payment.
- Prevent duplicate one-time contribution.
- Link postings to ledger.
- List savings activity.
- Return savings cap progress.

Endpoints:

```text
POST /api/savings/deposits
GET /api/savings/member/:cycleMemberId
POST /api/contributions
GET /api/contributions/member/:cycleMemberId
```

Acceptance Criteria:

- Savings cap applies only to principal.
- Contributions are separate from savings.
- All postings create ledger transactions.

Testing:

- Savings deposit tests.
- Cap enforcement tests.
- Duplicate contribution tests.
- Ledger posting tests.
- Locked month guard tests.

### BE-013: Loan Management API

Priority: P0  
Epic: Loans

Description:
Implement loan requests, approvals, disbursements, top-ups, and repayments.

Subtasks:

- Create loan request from declaration or admin.
- Approve loan request.
- Reject loan request.
- Disburse approved loan.
- Treat top-up as separate disbursement.
- Record principal repayment.
- Record interest repayment.
- Compute outstanding loan summary.
- Track cumulative borrowed amount separately from outstanding balance.

Endpoints:

```text
GET /api/loans/requests
POST /api/loans/requests
POST /api/loans/requests/:id/approve
POST /api/loans/requests/:id/reject
POST /api/loans/disbursements
POST /api/loans/repayments
GET /api/loans/member/:cycleMemberId
```

Acceptance Criteria:

- Only admins approve/disburse loans.
- Payout window is enforced.
- Repayments split principal and interest.
- Loan origin is preserved.

Testing:

- Request approval tests.
- Disbursement tests.
- Payout window tests.
- Repayment tests.
- Cumulative borrowing tests.
- Permission tests.

### BE-014: Penalty Engine API

Priority: P0  
Epic: Penalties

Description:
Implement penalty assessment, payment, waiver, reversal, and conversion to loan.

Subtasks:

- Assess failure-to-declare penalty.
- Assess configurable penalty type.
- Record penalty payment.
- Convert unpaid penalty to loan.
- Link converted loan to original penalty.
- Waive penalty with reason.
- Reverse erroneous penalty.
- List penalty report data.

Endpoints:

```text
GET /api/penalties
POST /api/penalties
POST /api/penalties/:id/pay
POST /api/penalties/:id/convert-to-loan
POST /api/penalties/:id/waive
POST /api/penalties/:id/reverse
```

Acceptance Criteria:

- K100 failure-to-declare penalty can be assessed.
- Converted penalty becomes loan principal.
- Converted penalty origin remains auditable.
- Waiver and reversal require reason.

Testing:

- Penalty assessment tests.
- Payment status tests.
- Conversion to loan tests.
- Converted loan interest eligibility tests.
- Audit tests.

## 9. Backend Phase 5: Financial Rules Engine

### BE-015: Ledger Posting Service

Priority: P0  
Epic: Ledger

Description:
Implement immutable ledger transaction posting with debit and credit entries.

Subtasks:

- Create ledger posting service.
- Validate balanced debit/credit entries.
- Link transaction to source table and source ID.
- Add reversal posting service.
- Prevent deletion of posted transactions.
- Add transaction wrapping for financial operations.

Acceptance Criteria:

- Every financial event creates a ledger transaction.
- Ledger entries balance.
- Reversals create new reversing entries.
- Source workflow is preserved.

Testing:

- Ledger balance unit tests.
- Posting integration tests.
- Reversal tests.
- Transaction rollback tests.

### BE-016: Savings Interest Calculator

Priority: P0  
Epic: Financial Engine

Description:
Implement monthly savings interest calculation.

Formula:

```text
savings_base = accumulated_savings_brought_forward + deposit_made
savings_interest = savings_rate * savings_base
accumulated_savings_carried_forward = savings_base + savings_interest
```

Subtasks:

- Implement calculator.
- Apply rounding policy.
- Post savings interest ledger transactions.
- Store monthly snapshot values.
- Prevent duplicate posting for locked/finalized run.

Acceptance Criteria:

- Interest is calculated monthly.
- Cap does not apply to accumulated interest.
- Values match configured cycle rate.

Testing:

- Unit tests for formula.
- Rounding tests.
- Monthly posting tests.
- Snapshot tests.

### BE-017: Loan Interest Calculator

Priority: P0  
Epic: Financial Engine

Description:
Implement monthly loan interest on brought-forward outstanding balance.

Formula:

```text
loan_interest = loan_rate * loan_brought_forward
outstanding_before_new_loan = loan_brought_forward + loan_interest - principal_repaid - interest_repaid
loan_carried_forward = outstanding_before_new_loan + new_loan
```

Subtasks:

- Implement calculator.
- Apply configured cycle rate.
- Apply rounding policy.
- Post loan interest ledger transactions.
- Ensure converted penalty loans are included in future standing loan balance.

Acceptance Criteria:

- Interest applies to brought-forward balance.
- New loans in the same month are tracked separately.
- Repayments reduce balances correctly.

Testing:

- Formula unit tests.
- Repayment ordering tests.
- Converted penalty loan tests.
- Monthly snapshot tests.

### BE-018: Borrowing Compliance Classifier

Priority: P0  
Epic: Financial Engine

Description:
Classify members by cumulative borrowing.

Subtasks:

- Calculate cumulative borrowed amount.
- Classify never borrowed.
- Classify below minimum.
- Classify at or above minimum.
- Calculate borrowing shortfall.

Acceptance Criteria:

- Compliance status is correct per member per month.
- Outstanding balance is not confused with cumulative borrowing.

Testing:

- Classification unit tests.
- Edge case tests for exactly K20,000.
- Tests for repaid loans still counting toward cumulative borrowing.

### BE-019: Common-Interest Engine

Priority: P0  
Epic: Financial Engine

Description:
Calculate unborrowed money and allocate common interest.

Subtasks:

- Calculate total pool contributions.
- Calculate total loans issued.
- Calculate unborrowed money.
- Calculate common-interest pool.
- Implement only non-borrowers equal allocation.
- Implement non-borrowers and below-minimum proportional allocation.
- Implement all-members equal allocation.
- Store run header and per-member allocation.
- Post common-interest assessment ledger transactions.
- Support authorized override.

Acceptance Criteria:

- Allocation method is stored.
- Every allocation stores eligibility, shortfall, weight, base, calculated charge, and final charge.
- Zero eligible member cases are handled explicitly.

Testing:

- Unit tests for all allocation methods.
- Proportional shortfall tests.
- Rounding distribution tests.
- Override tests.
- Ledger posting tests.

### BE-020: Monthly Closing Service

Priority: P0  
Epic: Monthly Processing

Description:
Implement full month-end workflow.

Subtasks:

- Validate month can be processed.
- Detect missed declarations.
- Post penalties.
- Calculate savings interest.
- Calculate loan interest.
- Calculate common interest.
- Generate member snapshots.
- Generate cycle month summary.
- Prepare review state.
- Lock month.
- Support draft recalculation before lock.

Acceptance Criteria:

- Monthly closing follows required steps.
- Month cannot be locked with unresolved critical errors.
- Locked month blocks ordinary edits.
- Closing is auditable.

Testing:

- End-to-end monthly closing test.
- Missed declaration penalty test.
- Interest posting tests.
- Common-interest integration tests.
- Locked month edit prevention tests.
- Recalculation tests.

## 10. Backend Phase 6: Reporting, Audit, and Admin Controls

### BE-021: Reporting API

Priority: P1  
Epic: Reports

Description:
Implement read APIs for statements and reports.

Subtasks:

- Member monthly statement.
- Member cycle statement.
- Monthly pool summary.
- Savings report.
- Loan report.
- Common-interest allocation report.
- Declaration compliance report.
- Penalty report.
- Converted penalty report.
- Cycle closing report.
- CSV/PDF export support where feasible.

Endpoints:

```text
GET /api/reports/member-statement
GET /api/reports/pool-summary
GET /api/reports/savings
GET /api/reports/loans
GET /api/reports/common-interest
GET /api/reports/declarations
GET /api/reports/penalties
GET /api/reports/cycle-closing
```

Acceptance Criteria:

- Reports can filter by cycle, month, member, and status.
- Reports reconcile with ledger/snapshots.
- Members only access their own reports.

Testing:

- Report query tests.
- Permission tests.
- Snapshot reconciliation tests.
- Export smoke tests.

### BE-022: Audit Trail and Override API

Priority: P0  
Epic: Audit

Description:
Implement audit logging and override workflows.

Subtasks:

- Central audit logger.
- Log creates, updates, approvals, postings, reversals, overrides, locks.
- Create override endpoint.
- Require reason for override.
- Preserve original and overridden values.
- List audit logs with filters.

Endpoints:

```text
GET /api/audit
POST /api/overrides
GET /api/overrides
```

Acceptance Criteria:

- Sensitive actions are logged.
- Overrides cannot be created without reason.
- Original calculated value remains visible.

Testing:

- Audit log tests.
- Override validation tests.
- Permission tests.

### BE-023: Settings API

Priority: P1  
Epic: Administration

Description:
Implement administrative settings.

Subtasks:

- Manage users.
- Manage roles.
- Manage penalty types.
- Manage notification preferences.
- Manage active cycle defaults.
- Manage rounding policy for draft cycles.

Acceptance Criteria:

- Admin can invite users.
- Admin can configure penalty types per cycle.
- Settings changes are audited.

Testing:

- User invitation tests.
- Penalty type tests.
- Settings permission tests.

## 11. Backend Phase 7: Backend Quality, Security, and Performance

### BE-024: Backend Test Suite

Priority: P0  
Epic: Quality

Description:
Build complete backend automated test suite.

Subtasks:

- Configure Jest or Vitest.
- Add test database setup.
- Add unit tests for calculators.
- Add repository tests.
- Add API integration tests.
- Add monthly closing end-to-end tests.
- Add auth and permission tests.
- Add report tests.

Acceptance Criteria:

- Tests run with one command.
- Financial formulas have strong unit coverage.
- Critical workflows have integration coverage.

Testing:

- This task is complete when CI/local test suite passes.

### BE-025: Backend Security Hardening

Priority: P0  
Epic: Security

Description:
Protect the API against common application risks.

Subtasks:

- Rate limit auth endpoints.
- Add request size limits.
- Sanitize inputs.
- Use parameterized SQL/query builder.
- Add password policy.
- Protect reset tokens.
- Add secure cookie/session settings if used.
- Add audit logging for failed sensitive operations.

Acceptance Criteria:

- Authentication endpoints are rate-limited.
- No raw interpolated SQL for user input.
- Sensitive data is not logged.

Testing:

- Security middleware tests.
- Rate limit tests.
- SQL injection smoke tests.

### BE-026: Backend Performance and Scalability

Priority: P1  
Epic: Scalability

Description:
Prepare backend for larger groups, more cycles, and long-term history.

Subtasks:

- Add pagination to list endpoints.
- Add database indexes for reports.
- Add query performance checks.
- Add caching strategy for read-heavy reports if needed.
- Add background job structure for reminders and previews.
- Add idempotency keys for financial posting endpoints.

Acceptance Criteria:

- Large member lists are paginated.
- Report queries use indexes.
- Duplicate financial posts are prevented.

Testing:

- Pagination tests.
- Idempotency tests.
- Query plan review for heavy reports.

## 12. Frontend Phase 1: Project Foundation

### FE-001: Initialize React Project

Priority: P0  
Epic: Frontend Foundation

Description:
Create the frontend using React and JavaScript.

Subtasks:

- Initialize React app with Vite.
- Add routing.
- Add API client.
- Add auth state management.
- Add global layout structure.
- Add design tokens for colors, spacing, typography.
- Add responsive CSS foundation.
- Add test framework.

Suggested structure:

```text
frontend/
  src/
    api/
    components/
    layouts/
    pages/
    routes/
    hooks/
    state/
    styles/
    tests/
```

Acceptance Criteria:

- App runs locally.
- Routes are configured.
- API client handles auth token/session.
- Base layout works on mobile and desktop.

Testing:

- Render smoke test.
- Router smoke test.
- API client test.

### FE-002: Design System Components

Priority: P0  
Epic: UI System

Description:
Build reusable UI components for all screens.

Subtasks:

- Button component.
- Icon button component.
- Input component.
- Select component.
- Date input.
- Number/currency input.
- Textarea.
- Badge.
- Card.
- Table.
- Tabs.
- Modal.
- Drawer.
- Toast/alert.
- Stepper.
- Pagination.
- Empty state.
- Loading skeleton.
- Confirm dialog with reason field.

Acceptance Criteria:

- Components support disabled, loading, error, and responsive states.
- Currency inputs handle Kwacha values.
- Tables work on desktop and mobile.

Testing:

- Component render tests.
- Interaction tests for modals, tabs, forms.
- Accessibility checks for labels and buttons.

### FE-003: App Layouts

Priority: P0  
Epic: UI Layout

Description:
Create layouts for admin and member portals.

Subtasks:

- Admin sidebar layout.
- Admin top bar with cycle/month selectors.
- Mobile drawer navigation.
- Member portal layout.
- Protected route wrapper.
- Public auth layout.
- Breadcrumbs.

Acceptance Criteria:

- Desktop has persistent sidebar.
- Mobile has collapsible navigation.
- Active page is visible.
- Cycle and month selectors are available where needed.

Testing:

- Responsive layout tests.
- Protected route tests.
- Navigation tests.

## 13. Frontend Phase 2: Authentication Screens

### FE-004: Login Screen

Priority: P0  
Epic: Auth UI

Description:
Build login page.

Subtasks:

- Email input.
- Password input.
- Remember me option if supported.
- Forgot password link.
- Create account link if supported.
- Error messages.
- Loading state.
- Role-based redirect after login.

Acceptance Criteria:

- Admin redirects to dashboard.
- Member redirects to member dashboard.
- Invalid login shows friendly error.
- Works on mobile.

Testing:

- Login form validation tests.
- Successful login flow test.
- Failed login test.
- Mobile viewport check.

### FE-005: Signup and Invitation Screen

Priority: P1  
Epic: Auth UI

Description:
Build signup or invitation acceptance flow.

Subtasks:

- First name.
- Last name.
- Phone.
- Email.
- Password.
- Confirm password.
- Submit.
- Back to login.
- Success state.

Acceptance Criteria:

- Form validates required fields.
- Password mismatch is blocked.
- Successful signup shows next action.

Testing:

- Validation tests.
- Submit success/failure tests.
- Mobile viewport check.

### FE-006: Password Recovery Screens

Priority: P1  
Epic: Auth UI

Description:
Build forgot password and reset password pages.

Subtasks:

- Forgot password form.
- Reset password form.
- Token expired state.
- Success message.
- Back to login action.

Acceptance Criteria:

- User can request reset link.
- User can set a new password.
- Invalid token is handled.

Testing:

- Forgot password validation.
- Reset password validation.
- Error state tests.

## 14. Frontend Phase 3: Admin Screens

### FE-007: Admin Dashboard

Priority: P0  
Epic: Admin UI

Description:
Build admin dashboard.

Subtasks:

- Summary cards.
- Active cycle/month selector.
- Monthly closing progress panel.
- Priority queue.
- Pending loan approvals widget.
- Missed declaration widget.
- Penalty conversion widget.
- Quick action buttons.

Buttons:

- Review Declarations.
- Approve Loans.
- Run Monthly Closing.
- View Reports.

Acceptance Criteria:

- Dashboard loads live API data.
- Cards drill down to relevant screens.
- Mobile layout stacks cards and widgets cleanly.

Testing:

- Data loading test.
- Empty state test.
- Error state test.
- Mobile and desktop visual checks.

### FE-008: Cycle Screens

Priority: P0  
Epic: Cycle UI

Description:
Build cycle list, create/edit cycle, and cycle detail screens.

Subtasks:

- Cycle list table.
- New cycle button.
- Create cycle form.
- Edit rules form.
- Cycle detail tabs.
- Month generation action.
- Enroll members action.
- Penalty types tab.
- Audit tab.

Buttons:

- New Cycle.
- Save Cycle.
- Save Draft.
- Activate Cycle.
- Generate Months.
- Enroll Members.
- Edit Rules.
- Close Cycle.
- Archive.
- Cancel.

Acceptance Criteria:

- Admin can create and configure cycle rules.
- Validation errors are shown beside fields.
- Cycle detail shows rules, months, members, and audit.
- Mobile form uses single-column layout.

Testing:

- Form validation tests.
- Create/edit flow tests.
- Month generation flow test.
- Responsive layout tests.

### FE-009: Member Management Screens

Priority: P0  
Epic: Member UI

Description:
Build member list, create member, edit member, and member detail.

Subtasks:

- Member list with search.
- Filters for declaration, borrowing compliance, penalties.
- Create member form.
- Edit member form.
- Member detail overview.
- Member tabs: Savings, Loans, Declarations, Penalties, Statement, Audit.
- Member action buttons.

Buttons:

- New Member.
- Save Member.
- Save and Add Another.
- Edit Member.
- Activate/Deactivate.
- Enroll in Cycle.
- Post Savings.
- New Loan.
- Record Payment.
- Convert Penalty.
- Export Statement.
- View Transaction.

Acceptance Criteria:

- Member detail exposes all drill-down views.
- Amounts link to transaction or report details.
- Mobile table becomes card list.

Testing:

- Member list tests.
- Create/edit tests.
- Detail tab tests.
- Mobile card list tests.

### FE-010: Declaration Screens

Priority: P0  
Epic: Declaration UI

Description:
Build admin and member declaration screens.

Subtasks:

- Declaration queue.
- Declaration filters.
- Submit declaration form.
- Declaration detail page.
- Edit declaration.
- Missed declaration state.
- Cancel declaration confirmation.

Buttons:

- New Declaration.
- Submit Declaration.
- Save Draft.
- Edit Declaration.
- Cancel Declaration.
- Approve Inputs.
- Create Loan Request.
- Assess Penalty.
- Back.

Acceptance Criteria:

- Declaration window status is visible.
- Form supports savings, loan request, top-up, repayments, common interest, and notes.
- Missed declarations are clearly marked.
- Mobile form is easy to complete.

Testing:

- Declaration form validation.
- Submit flow.
- Late/missed state tests.
- Mobile viewport checks.

### FE-011: Savings and Contribution Screens

Priority: P0  
Epic: Savings UI

Description:
Build posting and detail screens for savings, social fund, and membership fee.

Subtasks:

- Savings posting form.
- Cap warning display.
- Social fund posting.
- Membership fee posting.
- Savings history.
- Contribution status.

Buttons:

- Post Savings.
- Post Social Fund.
- Post Membership Fee.
- Reverse Posting.
- View Ledger.
- Cancel.

Acceptance Criteria:

- Savings cap progress is visible.
- One-time contributions show paid/unpaid status.
- All posts show confirmation before submission.

Testing:

- Currency input tests.
- Cap warning tests.
- Posting success/failure tests.
- Mobile layout tests.

### FE-012: Loan Screens

Priority: P0  
Epic: Loan UI

Description:
Build loan request queue, approval, disbursement, repayment, and loan detail screens.

Subtasks:

- Loan request table.
- Approval drawer/modal.
- Adjust approved amount.
- Reject with reason.
- Disbursement screen.
- Repayment form.
- Loan detail statement.
- Top-up handling.
- Converted penalty loan display.

Buttons:

- Approve.
- Reject.
- Adjust Amount.
- Disburse Loan.
- Record Repayment.
- View Loan.
- Reverse Transaction.
- Back.

Acceptance Criteria:

- Admin sees effect before posting.
- Principal and interest repayments are separate.
- Loan origin is visible.
- Mobile tables are usable.

Testing:

- Approval flow tests.
- Disbursement flow tests.
- Repayment form tests.
- Converted penalty display tests.
- Responsive checks.

### FE-013: Common-Interest Screens

Priority: P0  
Epic: Common Interest UI

Description:
Build common-interest run, allocation, and override screens.

Subtasks:

- Common-interest summary cards.
- Allocation method selector.
- Allocation preview table.
- Member allocation detail.
- Override form with reason.
- Approval action.
- Ledger links.

Buttons:

- Calculate Preview.
- Approve Allocation.
- Override Charge.
- Save Override.
- Cancel Override.
- View Ledger.
- Export.

Acceptance Criteria:

- Pool contributions, loans issued, unborrowed money, and pool are visible.
- Allocation explains each member charge.
- Overrides preserve original values.

Testing:

- Allocation table render tests.
- Override validation tests.
- Approval flow tests.
- Mobile layout tests.

### FE-014: Penalty Screens

Priority: P0  
Epic: Penalty UI

Description:
Build penalty list, detail, payment, conversion, waiver, and reversal screens.

Subtasks:

- Penalty table.
- Penalty filters.
- Penalty detail.
- Mark paid form.
- Convert to loan confirmation.
- Waive penalty form.
- Reverse penalty form.

Buttons:

- Assess Penalty.
- Mark Paid.
- Convert to Loan.
- Waive.
- Reverse.
- View Converted Loan.
- View Ledger.
- Cancel.

Acceptance Criteria:

- Penalty status is clear.
- Conversion warning explains loan interest impact.
- Reason is required for waiver and reversal.

Testing:

- Payment flow tests.
- Conversion flow tests.
- Waiver/reversal validation.
- Mobile layout tests.

### FE-015: Monthly Closing Screens

Priority: P0  
Epic: Monthly Closing UI

Description:
Build monthly closing wizard and review screens.

Subtasks:

- Stepper.
- Validate inputs step.
- Declaration compliance step.
- Penalty posting step.
- Savings interest step.
- Loan interest step.
- Common-interest step.
- Snapshot review.
- Lock month confirmation.
- Recalculate draft action.

Buttons:

- Start Closing.
- Continue.
- Back.
- Recalculate.
- View Exceptions.
- Approve Step.
- Lock Month.
- Export Closing Report.

Acceptance Criteria:

- Admin can see progress and exceptions.
- Month cannot be locked without confirmation.
- Locked status is obvious.
- Mobile wizard is usable.

Testing:

- Wizard navigation tests.
- Exception state tests.
- Lock confirmation tests.
- Responsive tests.

### FE-016: Ledger and Audit Screens

Priority: P1  
Epic: Ledger UI

Description:
Build ledger explorer, transaction detail, reversal workflow, and audit trail.

Subtasks:

- Ledger filter form.
- Ledger transaction table.
- Transaction detail.
- Debit/credit lines.
- Reverse transaction form.
- Audit trail table.
- Audit detail drawer.

Buttons:

- Filter.
- Clear Filters.
- View Transaction.
- Reverse Transaction.
- Export CSV.
- View Audit Detail.

Acceptance Criteria:

- Ledger can be searched by member, month, type, and source.
- Transaction detail shows source workflow.
- Reversal requires reason.

Testing:

- Filter tests.
- Detail view tests.
- Reversal validation tests.
- Responsive tests.

### FE-017: Reports Screens

Priority: P1  
Epic: Reports UI

Description:
Build report center and report detail pages.

Subtasks:

- Report cards.
- Report filters.
- Member statement report.
- Pool summary report.
- Savings report.
- Loan report.
- Common-interest report.
- Declaration compliance report.
- Penalty report.
- Converted penalty report.
- Cycle closing report.
- Export actions.

Buttons:

- Run Report.
- Download PDF.
- Export CSV.
- Clear Filters.
- Open Member.
- Open Ledger.

Acceptance Criteria:

- Reports support cycle, month, member, and status filters.
- Exports are available where supported.
- Mobile layout stacks filters and tables.

Testing:

- Filter form tests.
- Report loading tests.
- Empty state tests.
- Export button tests.
- Responsive tests.

### FE-018: Settings Screens

Priority: P1  
Epic: Settings UI

Description:
Build settings pages for users, roles, penalty types, and notifications.

Subtasks:

- User management.
- Invite user.
- Edit role.
- Disable user.
- Penalty type management.
- Notification preferences.
- Rounding policy for draft cycles.

Buttons:

- Invite User.
- Save User.
- Disable User.
- Add Penalty Type.
- Save Penalty Type.
- Save Settings.
- Cancel.

Acceptance Criteria:

- Settings changes are admin-only.
- Changes show success/error states.
- Mobile layout is usable.

Testing:

- User invite tests.
- Role update tests.
- Penalty type tests.
- Permission tests.

## 15. Frontend Phase 4: Member Portal

### FE-019: Member Dashboard

Priority: P0  
Epic: Member Portal

Description:
Build member dashboard.

Subtasks:

- Savings card.
- Loan card.
- Common-interest due card.
- Penalty card.
- Declaration window status.
- Monthly obligations panel.
- Quick action buttons.

Buttons:

- Submit Declaration.
- View Statement.
- View Savings.
- View Loans.
- View Penalties.

Acceptance Criteria:

- Member only sees own data.
- Current obligations are clear.
- Mobile view is first-class.

Testing:

- Member dashboard data tests.
- Permission tests.
- Mobile viewport tests.

### FE-020: Member Declaration Screen

Priority: P0  
Epic: Member Portal

Description:
Build member-facing declaration form.

Subtasks:

- Savings input.
- Loan request input.
- Top-up input.
- Principal repayment input.
- Loan interest repayment input.
- Common-interest payment input.
- Notes.
- Submit and save draft states.

Buttons:

- Submit.
- Save Draft.
- Cancel.

Acceptance Criteria:

- Member can submit within declaration window.
- Member sees late or closed window state.
- Form is easy on mobile.

Testing:

- Validation tests.
- Submit tests.
- Closed window tests.
- Mobile tests.

### FE-021: Member Statement and Detail Screens

Priority: P0  
Epic: Member Portal

Description:
Build member views for statements, savings, loans, and penalties.

Subtasks:

- My statement.
- My savings detail.
- My loan detail.
- My penalties.
- Transaction detail read-only view.
- Download statement action.

Buttons:

- Download PDF.
- View Transaction.
- View Loan Detail.
- View Savings Detail.
- View Penalty Detail.
- Back.

Acceptance Criteria:

- Member cannot see other members.
- Statement matches admin statement.
- Mobile layout is readable.

Testing:

- Statement render tests.
- Ownership tests.
- Download action tests.
- Responsive tests.

## 16. Frontend Phase 5: Responsive and Accessibility Work

### FE-022: Responsive Design Pass

Priority: P0  
Epic: Responsive UI

Description:
Ensure all screens work on mobile, tablet, and desktop.

Breakpoints:

```text
Mobile: 360px to 767px
Tablet: 768px to 1023px
Desktop: 1024px and above
```

Subtasks:

- Convert wide tables to horizontal scroll or card lists.
- Make side navigation collapse on mobile.
- Ensure forms become single column on mobile.
- Keep buttons reachable and readable.
- Avoid overlapping text.
- Verify modals and drawers fit mobile screens.

Acceptance Criteria:

- No screen has broken layout at 360px width.
- Admin workflows are still usable on tablet.
- Desktop remains dense and efficient.

Testing:

- Responsive Playwright tests.
- Manual screenshot review for core screens.
- Text overflow checks.

### FE-023: Accessibility Pass

Priority: P1  
Epic: Accessibility

Description:
Improve keyboard and screen reader usability.

Subtasks:

- Add labels to all inputs.
- Add aria labels where needed.
- Ensure color contrast.
- Add focus states.
- Support keyboard navigation in modals.
- Ensure error messages are announced.

Acceptance Criteria:

- Forms are label-complete.
- Buttons are keyboard accessible.
- Color contrast is acceptable.

Testing:

- Accessibility automated checks.
- Keyboard navigation tests.
- Screen reader label review.

## 17. Integration and QA Phase

### QA-001: End-to-End Admin Workflow

Priority: P0  
Epic: QA

Description:
Test complete admin path from cycle setup to month lock.

Subtasks:

- Create cycle.
- Generate months.
- Add members.
- Submit declarations.
- Post savings.
- Approve loans.
- Assess penalties.
- Run monthly closing.
- Review common interest.
- Lock month.
- Generate reports.

Acceptance Criteria:

- Full workflow completes without manual database edits.
- All financial records are traceable.

Testing:

- Playwright end-to-end test.
- Backend integration test.
- Report reconciliation check.

### QA-002: End-to-End Member Workflow

Priority: P0  
Epic: QA

Description:
Test full member journey.

Subtasks:

- Login as member.
- View dashboard.
- Submit declaration.
- View statement.
- View loan/savings/penalty detail.
- Download statement.

Acceptance Criteria:

- Member only sees own data.
- Member screens work on mobile.

Testing:

- Playwright member E2E test.
- Ownership security test.
- Mobile E2E test.

### QA-003: Financial Accuracy Test Pack

Priority: P0  
Epic: QA

Description:
Create known calculation scenarios and expected outputs.

Subtasks:

- Savings interest scenario.
- Loan interest scenario.
- Loan repayment scenario.
- Converted penalty loan scenario.
- Common-interest only non-borrowers scenario.
- Common-interest proportional scenario.
- All-members common-interest scenario.
- Locked month reversal scenario.

Acceptance Criteria:

- Expected results are documented.
- Automated tests match expected financial outputs.

Testing:

- Unit test each scenario.
- Integration test monthly closing scenario.

### QA-004: Regression Test Suite

Priority: P1  
Epic: QA

Description:
Create regression coverage for future changes.

Subtasks:

- Auth regression tests.
- Member CRUD regression tests.
- Cycle rules regression tests.
- Ledger posting regression tests.
- Monthly closing regression tests.
- Report regression tests.
- Responsive regression screenshots.

Acceptance Criteria:

- Regression suite runs before release.
- Critical financial paths are protected.

Testing:

- CI test run.
- Screenshot comparison where available.

## 18. DevOps and Release Phase

### DO-001: Local Development Environment

Priority: P0  
Epic: DevOps

Description:
Create local development setup.

Subtasks:

- Docker Compose for PostgreSQL.
- Backend dev command.
- Frontend dev command.
- Database migration command.
- Seed data command.
- README setup guide.

Acceptance Criteria:

- New developer can run app locally.
- Seed data creates usable demo cycle and members.

Testing:

- Fresh setup test.
- Seed data smoke test.

### DO-002: CI Pipeline

Priority: P0  
Epic: DevOps

Description:
Add automated checks.

Subtasks:

- Install dependencies.
- Run backend tests.
- Run frontend tests.
- Run lint.
- Run migrations against test DB.
- Run E2E smoke tests if feasible.

Acceptance Criteria:

- Pull requests show pass/fail checks.
- Broken tests block merge.

Testing:

- CI dry run.

### DO-003: Production Deployment

Priority: P1  
Epic: DevOps

Description:
Prepare production deployment.

Subtasks:

- Choose hosting platform.
- Configure production PostgreSQL.
- Configure environment variables.
- Configure migrations on deploy.
- Configure backups.
- Configure logging.
- Configure monitoring.
- Configure HTTPS.

Acceptance Criteria:

- App deploys to staging.
- Database backups are enabled.
- Logs are available for debugging.

Testing:

- Staging smoke test.
- Backup restore drill.
- Health-check monitoring test.

## 19. Documentation Phase

### DOC-001: Developer Documentation

Priority: P1  
Epic: Documentation

Subtasks:

- Setup guide.
- Architecture overview.
- API conventions.
- Database migration guide.
- Testing guide.
- Ledger posting guide.
- Monthly closing guide.

Acceptance Criteria:

- Developer can understand project structure and run tests.

### DOC-002: Admin User Guide

Priority: P1  
Epic: Documentation

Subtasks:

- Cycle setup guide.
- Member management guide.
- Declaration guide.
- Loan approval guide.
- Monthly closing guide.
- Penalty conversion guide.
- Reporting guide.
- Reversal and override guide.

Acceptance Criteria:

- Admin can perform monthly workflow from guide.

### DOC-003: Member User Guide

Priority: P2  
Epic: Documentation

Subtasks:

- Login guide.
- Declaration submission guide.
- Statement guide.
- Savings and loan viewing guide.
- Penalty explanation.

Acceptance Criteria:

- Member can understand portal usage.

## 20. Suggested MVP Release Scope

MVP must include:

- Authentication and roles.
- Member management.
- Cycle management.
- Cycle member enrollment.
- Declarations.
- Savings deposits.
- Social fund and membership fees.
- Loan requests, approvals, disbursements, and repayments.
- Penalty assessment and conversion.
- Ledger posting.
- Savings interest.
- Loan interest.
- Common-interest calculation and allocation.
- Monthly closing and month locking.
- Member statements.
- Admin reports.
- Member portal.
- Responsive mobile and desktop layouts.

## 21. Suggested Implementation Order

1. BE-001 to BE-006: backend foundation and schema.
2. BE-007 to BE-008: auth and permissions.
3. BE-009 to BE-014: core operational APIs.
4. BE-015 to BE-020: ledger and financial engine.
5. BE-021 to BE-026: reports, audit, security, performance.
6. FE-001 to FE-003: frontend foundation.
7. FE-004 to FE-006: authentication UI.
8. FE-007 to FE-018: admin UI.
9. FE-019 to FE-021: member portal.
10. FE-022 to FE-023: responsive and accessibility passes.
11. QA-001 to QA-004: full workflow and regression testing.
12. DO-001 to DO-003: local setup, CI, staging, production.
13. DOC-001 to DOC-003: documentation.

## 22. Release Readiness Checklist

- All P0 backend tasks complete.
- All P0 frontend tasks complete.
- Monthly closing E2E test passes.
- Financial accuracy test pack passes.
- Member ownership security tests pass.
- Locked month edit prevention works.
- Ledger reversals work.
- Reports reconcile with snapshots and ledger.
- Mobile screens checked at 360px width.
- Desktop screens checked at 1366px width.
- Database backup configured.
- Admin user guide complete.
- Production environment variables configured.
