-- Add admin_password to site_settings if it doesn't exist
INSERT INTO site_settings (id, value, type, description)
VALUES ('admin_password', 'Diginix@Admin!2025', 'text', 'Admin dashboard password')
ON CONFLICT (id) DO NOTHING;

-- Update RLS policy to allow public read/write for admin_password
-- This is needed since admin login doesn't use Supabase Auth
DROP POLICY IF EXISTS "Public can manage admin password" ON site_settings;

CREATE POLICY "Public can manage admin password"
  ON site_settings
  FOR ALL
  TO public
  USING (id = 'admin_password')
  WITH CHECK (id = 'admin_password');


