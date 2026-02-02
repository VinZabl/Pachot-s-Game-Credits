-- Add order_option column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS order_option text DEFAULT 'place_order' CHECK (order_option IN ('order_via_messenger', 'place_order'));

-- Update existing orders to have a default order_option
-- Since we can't determine the method for existing orders, default to 'place_order'
UPDATE orders 
SET order_option = 'place_order' 
WHERE order_option IS NULL;
