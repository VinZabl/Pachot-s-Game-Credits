-- FINAL FIX: Make qr_code_url nullable in payment_methods table
-- Run this entire script in Supabase SQL Editor

-- Step 1: Check current state
SELECT 
  'BEFORE FIX:' as status,
  column_name,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'payment_methods' 
  AND column_name = 'qr_code_url';

-- Step 2: Update any empty strings to NULL first
UPDATE payment_methods 
SET qr_code_url = NULL 
WHERE qr_code_url = '' OR qr_code_url IS NULL;

-- Step 3: Force drop NOT NULL constraint
-- Try multiple methods to ensure it works

-- Method 1: Direct ALTER
DO $$
BEGIN
  BEGIN
    ALTER TABLE payment_methods 
    ALTER COLUMN qr_code_url DROP NOT NULL;
    RAISE NOTICE 'Method 1: Successfully dropped NOT NULL constraint';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Method 1 failed: %', SQLERRM;
      
      -- Method 2: Alter column type first, then drop NOT NULL
      BEGIN
        ALTER TABLE payment_methods 
        ALTER COLUMN qr_code_url TYPE text;
        
        ALTER TABLE payment_methods 
        ALTER COLUMN qr_code_url DROP NOT NULL;
        
        RAISE NOTICE 'Method 2: Successfully dropped NOT NULL constraint';
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Method 2 failed: %', SQLERRM;
          
          -- Method 3: More aggressive - recreate column
          BEGIN
            -- Add temporary column
            ALTER TABLE payment_methods 
            ADD COLUMN qr_code_url_temp text;
            
            -- Copy data
            UPDATE payment_methods 
            SET qr_code_url_temp = CASE 
              WHEN qr_code_url = '' THEN NULL 
              ELSE qr_code_url 
            END;
            
            -- Drop old column
            ALTER TABLE payment_methods 
            DROP COLUMN qr_code_url;
            
            -- Rename temp column
            ALTER TABLE payment_methods 
            RENAME COLUMN qr_code_url_temp TO qr_code_url;
            
            RAISE NOTICE 'Method 3: Successfully recreated column as nullable';
          EXCEPTION
            WHEN OTHERS THEN
              RAISE NOTICE 'Method 3 failed: %', SQLERRM;
          END;
      END;
  END;
END $$;

-- Step 4: Verify it worked (should show is_nullable = 'YES')
SELECT 
  'AFTER FIX:' as status,
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'payment_methods' 
  AND column_name = 'qr_code_url';

-- Step 5: Test insert with NULL (should work now)
-- Uncomment the line below to test:
-- INSERT INTO payment_methods (id, name, account_number, account_name, qr_code_url, active, sort_order, admin_name) 
-- VALUES ('test-null', 'Test Null', '123', 'Tester', NULL, true, 1, 'test') 
-- ON CONFLICT (id, admin_name) DO NOTHING;
