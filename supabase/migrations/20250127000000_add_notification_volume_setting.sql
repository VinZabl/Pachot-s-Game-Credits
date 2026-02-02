
-- Add notification volume setting
INSERT INTO site_settings (id, value, type, description)
VALUES (
  'notification_volume',
  '0.5',
  'number',
  'Volume level for order notification sound (0.0 to 1.0)'
)
ON CONFLICT (id) DO NOTHING;
