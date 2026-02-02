-- Add max_order_amount column to payment_methods table
ALTER TABLE payment_methods
ADD COLUMN IF NOT EXISTS max_order_amount DECIMAL(10,2);

-- Add comment
COMMENT ON COLUMN payment_methods.max_order_amount IS 'Maximum order amount (in PHP) for this payment method to be shown. NULL means no limit. If order total is >= this amount, payment method will be hidden.';
