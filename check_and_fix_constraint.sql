-- Step 1: Check the current state
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'payment_methods' 
  AND column_name = 'qr_code_url';

-- Step 2: Check for any constraints on this column
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'payment_methods'::regclass
  AND (conname LIKE '%qr_code%' OR conname LIKE '%payment_methods%');

-- Step 3: Try to drop NOT NULL using different methods
-- Method 1: Standard ALTER TABLE
ALTER TABLE payment_methods 
ALTER COLUMN qr_code_url DROP NOT NULL;

-- If that doesn't work, try Method 2: Recreate the column
-- (This is more aggressive but will work)
DO $$
BEGIN
  -- Check if still NOT NULL
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'payment_methods' 
      AND column_name = 'qr_code_url'
      AND is_nullable = 'NO'
  ) THEN
    -- Method 2: Alter column type to allow NULL
    ALTER TABLE payment_methods 
    ALTER COLUMN qr_code_url TYPE text;
    
    -- Then drop NOT NULL
    ALTER TABLE payment_methods 
    ALTER COLUMN qr_code_url DROP NOT NULL;
    
    RAISE NOTICE 'Successfully made qr_code_url nullable using method 2';
  END IF;
END $$;

-- Step 4: Verify it worked
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'payment_methods' 
  AND column_name = 'qr_code_url';

-- Should now show is_nullable = 'YES'
