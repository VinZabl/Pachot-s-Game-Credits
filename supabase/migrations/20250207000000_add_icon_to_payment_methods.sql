-- Add icon_url to payment_methods for customer-facing payment option display
ALTER TABLE payment_methods
ADD COLUMN IF NOT EXISTS icon_url text;

COMMENT ON COLUMN payment_methods.icon_url IS 'URL of payment method icon shown on customer side when choosing payment';
