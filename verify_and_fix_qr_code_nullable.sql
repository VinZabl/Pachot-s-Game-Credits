-- Step 1: Check the current state of the column
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'payment_methods' 
  AND column_name = 'qr_code_url';

-- Step 2: Make qr_code_url nullable (run this even if it says it's already nullable)
DO $$
BEGIN
  -- Check if column is currently NOT NULL
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'payment_methods' 
      AND column_name = 'qr_code_url'
      AND is_nullable = 'NO'
  ) THEN
    -- Make it nullable
    ALTER TABLE payment_methods 
    ALTER COLUMN qr_code_url DROP NOT NULL;
    
    RAISE NOTICE 'Successfully made qr_code_url nullable';
  ELSE
    RAISE NOTICE 'qr_code_url is already nullable';
  END IF;
END $$;

-- Step 3: Verify it worked (should show 'YES' for is_nullable)
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'payment_methods' 
  AND column_name = 'qr_code_url';
