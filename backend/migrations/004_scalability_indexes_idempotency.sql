CREATE TABLE IF NOT EXISTS idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  actor_user_id UUID REFERENCES users(id),
  route TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (actor_user_id, route, key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at ON idempotency_keys(created_at);
CREATE INDEX IF NOT EXISTS idx_members_created_at ON members(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_members_search_names ON members(first_name, last_name, member_code);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_transactions_member_type_posted ON ledger_transactions(cycle_member_id, transaction_type, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_transactions_cycle_type_posted ON ledger_transactions(cycle_id, transaction_type, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_declarations_cycle_month_status ON declarations(cycle_id, cycle_month_id, status);
CREATE INDEX IF NOT EXISTS idx_penalties_cycle_month_status ON penalties(cycle_id, cycle_month_id, status);
CREATE INDEX IF NOT EXISTS idx_common_interest_allocations_cycle_month ON common_interest_allocations(cycle_id, cycle_month_id);
CREATE INDEX IF NOT EXISTS idx_cycle_month_summaries_cycle_month ON cycle_month_summaries(cycle_id, cycle_month_id);
