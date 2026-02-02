-- Add icon_url column to payment_methods table
ALTER TABLE payment_methods
ADD COLUMN IF NOT EXISTS icon_url TEXT;

-- Add comment
COMMENT ON COLUMN payment_methods.icon_url IS 'URL to the payment method icon/image';
