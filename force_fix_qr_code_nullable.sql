-- Force fix: Make qr_code_url nullable
-- Run this in Supabase SQL Editor

-- First, let's see the current constraint
SELECT 
  conname as constraint_name,
  contype as constraint_type
FROM pg_constraint 
WHERE conrelid = 'payment_methods'::regclass
  AND conname LIKE '%qr_code%';

-- Drop any check constraints that might be enforcing NOT NULL
-- (This is a safety measure)

-- Now force the column to be nullable
ALTER TABLE payment_methods 
ALTER COLUMN qr_code_url DROP NOT NULL;

-- If the above doesn't work, try this alternative approach:
-- First set existing empty strings to NULL
UPDATE payment_methods 
SET qr_code_url = NULL 
WHERE qr_code_url = '';

-- Then drop NOT NULL
ALTER TABLE payment_methods 
ALTER COLUMN qr_code_url DROP NOT NULL;

-- Verify it worked
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'payment_methods' 
  AND column_name = 'qr_code_url';

-- Should show is_nullable = 'YES'
