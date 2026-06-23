ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS recipient_mode TEXT NOT NULL DEFAULT 'AUDIENCE',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_reason TEXT;

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_recipient_mode_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_recipient_mode_check CHECK (recipient_mode IN ('AUDIENCE','USERS'));

CREATE TABLE IF NOT EXISTS notification_recipients (
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_active_created_at ON notifications(created_at DESC) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON notifications(expires_at) WHERE archived_at IS NULL AND expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_archived_at ON notifications(archived_at DESC) WHERE archived_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_recipients_user ON notification_recipients(user_id, notification_id);
