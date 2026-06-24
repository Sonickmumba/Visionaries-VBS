DO $$ BEGIN CREATE TYPE shareout_status AS ENUM ('DRAFT','POSTED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE shareout_member_status AS ENUM ('PENDING','POSTED','PAID'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE shareout_line_item_type AS ENUM ('ACCUMULATED_SAVINGS','GROUP_SURPLUS_SHARE','OUTSTANDING_LOAN','UNPAID_PENALTY','UNPAID_COMMON_INTEREST','ADMIN_ADJUSTMENT','NET_SHAREOUT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE ledger_transaction_type ADD VALUE IF NOT EXISTS 'GROUP_SURPLUS_INTEREST';
ALTER TYPE ledger_transaction_type ADD VALUE IF NOT EXISTS 'SHAREOUT_POSTING';
ALTER TYPE ledger_transaction_type ADD VALUE IF NOT EXISTS 'SHAREOUT_PAYMENT';

ALTER TYPE ledger_account_type ADD VALUE IF NOT EXISTS 'GROUP_SURPLUS';
ALTER TYPE ledger_account_type ADD VALUE IF NOT EXISTS 'SHAREOUT_PAYABLE';

CREATE TABLE IF NOT EXISTS group_surplus_months (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  cycle_month_id UUID NOT NULL REFERENCES cycle_months(id) ON DELETE CASCADE,
  monthly_closing_run_id UUID REFERENCES monthly_closing_runs(id),
  month_number INTEGER NOT NULL,
  interest_rate NUMERIC(8,6) NOT NULL,
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  social_fund_collected NUMERIC(14,2) NOT NULL DEFAULT 0,
  membership_collected NUMERIC(14,2) NOT NULL DEFAULT 0,
  penalties_collected NUMERIC(14,2) NOT NULL DEFAULT 0,
  interest_earned NUMERIC(14,2) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  calculated_by UUID REFERENCES users(id),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cycle_month_id)
);

CREATE TABLE IF NOT EXISTS cycle_shareouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  status shareout_status NOT NULL DEFAULT 'DRAFT',
  calculation_method TEXT NOT NULL DEFAULT 'EQUAL_GROUP_SURPLUS',
  total_accumulated_savings NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_group_surplus NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_surplus_allocated NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_outstanding_loans NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_unpaid_penalties NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_unpaid_common_interest NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_net_shareout NUMERIC(14,2) NOT NULL DEFAULT 0,
  eligible_member_count INTEGER NOT NULL DEFAULT 0,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_by UUID REFERENCES users(id),
  posted_by UUID REFERENCES users(id),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  posted_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cycle_shareouts_one_open
  ON cycle_shareouts(cycle_id)
  WHERE status IN ('DRAFT','POSTED');

CREATE TABLE IF NOT EXISTS member_shareouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shareout_id UUID NOT NULL REFERENCES cycle_shareouts(id) ON DELETE CASCADE,
  cycle_id UUID NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  cycle_member_id UUID NOT NULL REFERENCES cycle_members(id),
  member_id UUID NOT NULL REFERENCES members(id),
  accumulated_savings NUMERIC(14,2) NOT NULL DEFAULT 0,
  savings_principal NUMERIC(14,2) NOT NULL DEFAULT 0,
  savings_interest NUMERIC(14,2) NOT NULL DEFAULT 0,
  group_surplus_share NUMERIC(14,2) NOT NULL DEFAULT 0,
  outstanding_loan_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  unpaid_penalties NUMERIC(14,2) NOT NULL DEFAULT 0,
  unpaid_common_interest NUMERIC(14,2) NOT NULL DEFAULT 0,
  other_adjustments NUMERIC(14,2) NOT NULL DEFAULT 0,
  gross_shareout NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_shareout NUMERIC(14,2) NOT NULL DEFAULT 0,
  status shareout_member_status NOT NULL DEFAULT 'PENDING',
  posted_ledger_transaction_id UUID REFERENCES ledger_transactions(id),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shareout_id, cycle_member_id)
);

CREATE TABLE IF NOT EXISTS shareout_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_shareout_id UUID NOT NULL REFERENCES member_shareouts(id) ON DELETE CASCADE,
  shareout_id UUID NOT NULL REFERENCES cycle_shareouts(id) ON DELETE CASCADE,
  cycle_id UUID NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  cycle_member_id UUID NOT NULL REFERENCES cycle_members(id),
  line_item_type shareout_line_item_type NOT NULL,
  label TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  source_table TEXT,
  source_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_surplus_months_cycle ON group_surplus_months(cycle_id, month_number);
CREATE INDEX IF NOT EXISTS idx_cycle_shareouts_cycle_status ON cycle_shareouts(cycle_id, status);
CREATE INDEX IF NOT EXISTS idx_member_shareouts_cycle_member ON member_shareouts(cycle_member_id);
CREATE INDEX IF NOT EXISTS idx_shareout_line_items_member ON shareout_line_items(member_shareout_id, sort_order);
