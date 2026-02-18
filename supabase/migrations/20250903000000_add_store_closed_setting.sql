-- Add store_closed site setting (when true, customer page shows closed state)
INSERT INTO site_settings (id, value, type, description, updated_at)
VALUES ('store_closed', 'false', 'text', 'When true, customer page is closed - customers cannot order or browse', now())
ON CONFLICT (id) DO NOTHING;
