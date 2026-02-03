-- Add approval_message column to orders table
-- Allows admin to send a message when approving an order (e.g. "Credits have been sent!").
-- Customer can see this message in the order status view.
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS approval_message text;

COMMENT ON COLUMN orders.approval_message IS 'Message from admin when order is approved, shown to customer';
