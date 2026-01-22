-- Add rejection_reason column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Add comment to explain the column
COMMENT ON COLUMN orders.rejection_reason IS 'Reason for order rejection, can be a predefined reason or custom text from admin';
