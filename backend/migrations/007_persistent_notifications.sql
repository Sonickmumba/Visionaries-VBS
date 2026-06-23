CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'ALL',
  severity TEXT NOT NULL DEFAULT 'INFO',
  cycle_id UUID REFERENCES cycles(id) ON DELETE SET NULL,
  cycle_month_id UUID REFERENCES cycle_months(id) ON DELETE SET NULL,
  cycle_member_id UUID REFERENCES cycle_members(id) ON DELETE SET NULL,
  source_table TEXT,
  source_id UUID,
  action_url TEXT,
  action_target JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notifications_audience_check CHECK (audience IN ('ALL','ADMIN','MEMBER','AUDITOR')),
  CONSTRAINT notifications_severity_check CHECK (severity IN ('INFO','SUCCESS','WARNING','DANGER'))
);

CREATE TABLE IF NOT EXISTS notification_read_receipts (
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_audience_created_at ON notifications(audience, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_cycle_month ON notifications(cycle_id, cycle_month_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_source ON notifications(source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_notification_read_receipts_user ON notification_read_receipts(user_id, read_at DESC);
