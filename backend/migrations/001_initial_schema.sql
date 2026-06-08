CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE TYPE user_role AS ENUM ('ADMIN','MEMBER','AUDITOR'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE cycle_status AS ENUM ('DRAFT','ACTIVE','CLOSED','ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE cycle_member_status AS ENUM ('ACTIVE','INACTIVE','REMOVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE cycle_month_status AS ENUM ('OPEN','DECLARATION_PERIOD','PAYOUT_PERIOD','PROCESSING','REVIEW','LOCKED','REOPENED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE declaration_status AS ENUM ('DRAFT','SUBMITTED','LATE','APPROVED','MISSED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE approval_status AS ENUM ('PENDING','APPROVED','REJECTED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE borrowing_compliance_status AS ENUM ('NEVER_BORROWED','BORROWED_BELOW_MINIMUM','AT_OR_ABOVE_MINIMUM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE ledger_transaction_type AS ENUM ('SAVINGS_DEPOSIT','SAVINGS_INTEREST','SOCIAL_FUND_PAYMENT','MEMBERSHIP_FEE_PAYMENT','LOAN_DISBURSEMENT','LOAN_TOP_UP','PRINCIPAL_REPAYMENT','LOAN_INTEREST_ASSESSMENT','LOAN_INTEREST_REPAYMENT','COMMON_INTEREST_ASSESSMENT','COMMON_INTEREST_PAYMENT','PENALTY_ASSESSMENT','PENALTY_PAYMENT','CONVERTED_PENALTY_LOAN','ADMIN_ADJUSTMENT','REVERSAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE ledger_account_type AS ENUM ('SAVINGS_PRINCIPAL','SAVINGS_INTEREST','SOCIAL_FUND','MEMBERSHIP_FEE','LOAN_PRINCIPAL','LOAN_INTEREST','COMMON_INTEREST','PENALTY','CASH_POOL','ADJUSTMENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE loan_origin_type AS ENUM ('ORIGINAL_LOAN','TOP_UP','CONVERTED_PENALTY','ADMIN_CONVERSION'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE penalty_status AS ENUM ('ASSESSED','PAID','PARTIALLY_PAID','CONVERTED_TO_LOAN','WAIVED','REVERSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE common_interest_allocation_method AS ENUM ('ONLY_NON_BORROWERS_EQUAL','NON_BORROWERS_AND_BELOW_MINIMUM_PROPORTIONAL','ALL_MEMBERS_EQUAL','MANUAL_OVERRIDE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE contribution_type AS ENUM ('SOCIAL_FUND','MEMBERSHIP_FEE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE audit_action AS ENUM ('CREATE','UPDATE','DELETE','APPROVE','REJECT','POST','REVERSE','OVERRIDE','LOCK','REOPEN','LOGIN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id),
  member_code TEXT UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  national_id TEXT,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status cycle_status NOT NULL DEFAULT 'DRAFT',
  savings_cap NUMERIC(14,2) NOT NULL,
  minimum_borrowing_amount NUMERIC(14,2) NOT NULL,
  savings_interest_rate NUMERIC(8,6) NOT NULL,
  loan_interest_rate NUMERIC(8,6) NOT NULL,
  common_interest_rate NUMERIC(8,6) NOT NULL,
  social_fund_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  membership_fee_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  declaration_start_day SMALLINT NOT NULL,
  declaration_end_day SMALLINT NOT NULL,
  payout_start_day SMALLINT NOT NULL,
  payout_end_day SMALLINT NOT NULL,
  rounding_scale SMALLINT NOT NULL DEFAULT 2,
  rounding_mode TEXT NOT NULL DEFAULT 'HALF_UP',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cycles_date_check CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS cycle_months (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  month_number INTEGER NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  declaration_window_start DATE NOT NULL,
  declaration_window_end DATE NOT NULL,
  payout_window_start DATE NOT NULL,
  payout_window_end DATE NOT NULL,
  status cycle_month_status NOT NULL DEFAULT 'OPEN',
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, month_number)
);

CREATE TABLE IF NOT EXISTS cycle_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id),
  status cycle_member_status NOT NULL DEFAULT 'ACTIVE',
  joined_at DATE NOT NULL DEFAULT CURRENT_DATE,
  left_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, member_id)
);

CREATE TABLE IF NOT EXISTS penalty_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(14,2) NOT NULL,
  is_convertible_to_loan BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, code)
);

CREATE TABLE IF NOT EXISTS declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES cycles(id),
  cycle_month_id UUID NOT NULL REFERENCES cycle_months(id),
  cycle_member_id UUID NOT NULL REFERENCES cycle_members(id),
  savings_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  loan_request_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  loan_top_up_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  principal_repayment_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  loan_interest_repayment_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  common_interest_payment_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  other_obligation_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status declaration_status NOT NULL DEFAULT 'SUBMITTED',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_by UUID REFERENCES users(id),
  is_within_window BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cycle_month_id, cycle_member_id)
);

CREATE TABLE IF NOT EXISTS ledger_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES cycles(id),
  cycle_month_id UUID REFERENCES cycle_months(id),
  cycle_member_id UUID REFERENCES cycle_members(id),
  transaction_type ledger_transaction_type NOT NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(14,2) NOT NULL,
  description TEXT,
  source_table TEXT,
  source_id UUID,
  reversed_transaction_id UUID REFERENCES ledger_transactions(id),
  reversal_reason TEXT,
  posted_by UUID REFERENCES users(id),
  posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_reversal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_transaction_id UUID NOT NULL REFERENCES ledger_transactions(id) ON DELETE CASCADE,
  cycle_id UUID NOT NULL REFERENCES cycles(id),
  cycle_member_id UUID REFERENCES cycle_members(id),
  account_type ledger_account_type NOT NULL,
  debit NUMERIC(14,2) NOT NULL DEFAULT 0,
  credit NUMERIC(14,2) NOT NULL DEFAULT 0,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ledger_entries_amount_check CHECK (debit >= 0 AND credit >= 0 AND NOT (debit > 0 AND credit > 0))
);

CREATE TABLE IF NOT EXISTS contribution_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES cycles(id),
  cycle_member_id UUID NOT NULL REFERENCES cycle_members(id),
  contribution_type contribution_type NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ledger_transaction_id UUID REFERENCES ledger_transactions(id),
  posted_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, cycle_member_id, contribution_type)
);

CREATE TABLE IF NOT EXISTS loan_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES cycles(id),
  cycle_month_id UUID NOT NULL REFERENCES cycle_months(id),
  cycle_member_id UUID NOT NULL REFERENCES cycle_members(id),
  declaration_id UUID REFERENCES declarations(id),
  requested_amount NUMERIC(14,2) NOT NULL,
  origin_type loan_origin_type NOT NULL DEFAULT 'ORIGINAL_LOAN',
  status approval_status NOT NULL DEFAULT 'PENDING',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_amount NUMERIC(14,2),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loan_disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES cycles(id),
  cycle_month_id UUID NOT NULL REFERENCES cycle_months(id),
  cycle_member_id UUID NOT NULL REFERENCES cycle_members(id),
  loan_request_id UUID REFERENCES loan_requests(id),
  source_penalty_id UUID,
  origin_type loan_origin_type NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  disbursed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disbursed_by UUID REFERENCES users(id),
  ledger_transaction_id UUID REFERENCES ledger_transactions(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loan_repayments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES cycles(id),
  cycle_month_id UUID NOT NULL REFERENCES cycle_months(id),
  cycle_member_id UUID NOT NULL REFERENCES cycle_members(id),
  principal_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  interest_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  principal_ledger_transaction_id UUID REFERENCES ledger_transactions(id),
  interest_ledger_transaction_id UUID REFERENCES ledger_transactions(id),
  posted_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS penalties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES cycles(id),
  cycle_month_id UUID NOT NULL REFERENCES cycle_months(id),
  cycle_member_id UUID NOT NULL REFERENCES cycle_members(id),
  penalty_type_id UUID NOT NULL REFERENCES penalty_types(id),
  declaration_id UUID REFERENCES declarations(id),
  amount_assessed NUMERIC(14,2) NOT NULL,
  amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  status penalty_status NOT NULL DEFAULT 'ASSESSED',
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assessed_by UUID REFERENCES users(id),
  assessment_ledger_transaction_id UUID REFERENCES ledger_transactions(id),
  payment_ledger_transaction_id UUID REFERENCES ledger_transactions(id),
  converted_loan_disbursement_id UUID REFERENCES loan_disbursements(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loan_disbursements_source_penalty_fk'
  ) THEN
    ALTER TABLE loan_disbursements
      ADD CONSTRAINT loan_disbursements_source_penalty_fk
      FOREIGN KEY (source_penalty_id) REFERENCES penalties(id) DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS common_interest_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES cycles(id),
  cycle_month_id UUID NOT NULL REFERENCES cycle_months(id),
  allocation_method common_interest_allocation_method NOT NULL,
  total_pool_contributions NUMERIC(14,2) NOT NULL,
  total_loans_issued NUMERIC(14,2) NOT NULL,
  unborrowed_money NUMERIC(14,2) NOT NULL,
  common_interest_rate NUMERIC(8,6) NOT NULL,
  common_interest_pool NUMERIC(14,2) NOT NULL,
  status approval_status NOT NULL DEFAULT 'PENDING',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  calculated_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cycle_month_id)
);

CREATE TABLE IF NOT EXISTS common_interest_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  common_interest_run_id UUID NOT NULL REFERENCES common_interest_runs(id) ON DELETE CASCADE,
  cycle_id UUID NOT NULL REFERENCES cycles(id),
  cycle_month_id UUID NOT NULL REFERENCES cycle_months(id),
  cycle_member_id UUID NOT NULL REFERENCES cycle_members(id),
  compliance_status borrowing_compliance_status NOT NULL,
  cumulative_borrowed_amount NUMERIC(14,2) NOT NULL,
  borrowing_shortfall NUMERIC(14,2) NOT NULL,
  allocation_weight NUMERIC(18,10) NOT NULL DEFAULT 0,
  assigned_base NUMERIC(14,2) NOT NULL,
  calculated_charge NUMERIC(14,2) NOT NULL,
  final_charge NUMERIC(14,2) NOT NULL,
  ledger_transaction_id UUID REFERENCES ledger_transactions(id),
  override_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (common_interest_run_id, cycle_member_id)
);

CREATE TABLE IF NOT EXISTS monthly_closing_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES cycles(id),
  cycle_month_id UUID NOT NULL REFERENCES cycle_months(id),
  run_number INTEGER NOT NULL DEFAULT 1,
  status approval_status NOT NULL DEFAULT 'PENDING',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  started_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cycle_month_id, run_number)
);

CREATE TABLE IF NOT EXISTS member_monthly_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES cycles(id),
  cycle_month_id UUID NOT NULL REFERENCES cycle_months(id),
  cycle_member_id UUID NOT NULL REFERENCES cycle_members(id),
  monthly_closing_run_id UUID REFERENCES monthly_closing_runs(id),
  declaration_status declaration_status NOT NULL,
  borrowing_compliance_status borrowing_compliance_status NOT NULL,
  savings_brought_forward NUMERIC(14,2) NOT NULL DEFAULT 0,
  savings_deposit NUMERIC(14,2) NOT NULL DEFAULT 0,
  savings_interest NUMERIC(14,2) NOT NULL DEFAULT 0,
  accumulated_savings_carried_forward NUMERIC(14,2) NOT NULL DEFAULT 0,
  cumulative_savings_principal NUMERIC(14,2) NOT NULL DEFAULT 0,
  loan_brought_forward NUMERIC(14,2) NOT NULL DEFAULT 0,
  new_loan_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  top_up_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  converted_penalty_loan_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  loan_interest_assessed NUMERIC(14,2) NOT NULL DEFAULT 0,
  principal_repaid NUMERIC(14,2) NOT NULL DEFAULT 0,
  interest_repaid NUMERIC(14,2) NOT NULL DEFAULT 0,
  loan_carried_forward NUMERIC(14,2) NOT NULL DEFAULT 0,
  cumulative_borrowed_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  borrowing_shortfall NUMERIC(14,2) NOT NULL DEFAULT 0,
  common_interest_charge NUMERIC(14,2) NOT NULL DEFAULT 0,
  common_interest_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  penalties_assessed NUMERIC(14,2) NOT NULL DEFAULT 0,
  penalties_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  penalties_converted_to_loan NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cycle_month_id, cycle_member_id)
);

CREATE TABLE IF NOT EXISTS cycle_month_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES cycles(id),
  cycle_month_id UUID NOT NULL REFERENCES cycle_months(id),
  monthly_closing_run_id UUID REFERENCES monthly_closing_runs(id),
  total_savings_deposits NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_savings_interest NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_accumulated_savings NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_social_fund NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_membership_fees NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_loans_issued NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_top_ups NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_converted_penalty_loans NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_principal_repaid NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_loan_interest_assessed NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_loan_interest_repaid NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_outstanding_loans NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_pool_contributions NUMERIC(14,2) NOT NULL DEFAULT 0,
  unborrowed_money NUMERIC(14,2) NOT NULL DEFAULT 0,
  common_interest_pool NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_common_interest_charged NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_common_interest_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_penalties_assessed NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_penalties_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_penalties_converted NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cycle_month_id)
);

CREATE TABLE IF NOT EXISTS overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES cycles(id),
  cycle_month_id UUID REFERENCES cycle_months(id),
  target_table TEXT NOT NULL,
  target_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  original_value NUMERIC(14,2) NOT NULL,
  overridden_value NUMERIC(14,2) NOT NULL,
  reason TEXT NOT NULL,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id),
  action audit_action NOT NULL,
  entity_table TEXT NOT NULL,
  entity_id UUID,
  before_data JSONB,
  after_data JSONB,
  reason TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cycle_months_cycle ON cycle_months(cycle_id);
CREATE INDEX IF NOT EXISTS idx_cycle_members_cycle ON cycle_members(cycle_id);
CREATE INDEX IF NOT EXISTS idx_cycle_members_member ON cycle_members(member_id);
CREATE INDEX IF NOT EXISTS idx_declarations_month_member ON declarations(cycle_month_id, cycle_member_id);
CREATE INDEX IF NOT EXISTS idx_loan_disbursements_member_month ON loan_disbursements(cycle_member_id, cycle_month_id);
CREATE INDEX IF NOT EXISTS idx_loan_repayments_member_month ON loan_repayments(cycle_member_id, cycle_month_id);
CREATE INDEX IF NOT EXISTS idx_penalties_member_month ON penalties(cycle_member_id, cycle_month_id);
CREATE INDEX IF NOT EXISTS idx_ledger_transactions_cycle_month ON ledger_transactions(cycle_id, cycle_month_id);
CREATE INDEX IF NOT EXISTS idx_ledger_transactions_member ON ledger_transactions(cycle_member_id);
CREATE INDEX IF NOT EXISTS idx_member_snapshots_member_month ON member_monthly_snapshots(cycle_member_id, cycle_month_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_table, entity_id);
