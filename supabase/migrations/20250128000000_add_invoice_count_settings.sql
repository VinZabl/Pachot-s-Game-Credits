-- Add invoice count settings for tracking daily invoice numbers
INSERT INTO site_settings (id, value, type, description)
VALUES 
  (
    'invoice_count',
    '0',
    'number',
    'Current invoice count for the day (resets daily)'
  ),
  (
    'invoice_count_date',
    '',
    'text',
    'Date of the current invoice count (YYYY-MM-DD format)'
  )
ON CONFLICT (id) DO NOTHING;
