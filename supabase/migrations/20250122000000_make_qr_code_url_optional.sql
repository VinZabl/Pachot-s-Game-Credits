/*
  # Make QR Code URL Optional for Payment Methods
  
  This migration makes the qr_code_url field optional (nullable) in the payment_methods table.
  This allows payment methods to be saved without requiring a QR code image.
*/

-- Make qr_code_url nullable
ALTER TABLE payment_methods 
ALTER COLUMN qr_code_url DROP NOT NULL;

-- Add comment to document the change
COMMENT ON COLUMN payment_methods.qr_code_url IS 'QR code image URL (optional)';
