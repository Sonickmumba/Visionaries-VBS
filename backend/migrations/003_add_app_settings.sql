CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO app_settings (key, value, description)
VALUES
  ('notification_preferences', '{"emailEnabled": false, "smsEnabled": false, "declarationReminderDays": [28, 1, 3], "payoutReminderDays": [4, 5]}'::jsonb, 'System-wide notification preferences'),
  ('active_cycle_defaults', '{"autoSelectLatestActive": true, "defaultCycleId": null}'::jsonb, 'Default cycle selection preferences')
ON CONFLICT (key) DO NOTHING;
