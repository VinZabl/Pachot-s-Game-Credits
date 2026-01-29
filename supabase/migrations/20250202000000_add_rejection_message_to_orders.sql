/*
  # Add rejection message to orders

  Allows admin to send a message when rejecting an order (e.g. "Receipt is not valid").
  Customer can see this message in the order status view.
*/

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS rejection_message text;
