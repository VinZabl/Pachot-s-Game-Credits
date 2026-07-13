-- Run this in your Supabase SQL Editor to insert the customizable How to Order settings
INSERT INTO site_settings (id, value, type, description) VALUES
('how_to_order_title', 'HOW TO ORDER', 'text', 'Title of the How To Order instruction modal'),
('how_to_order_subtitle', 'Follow these steps to place your order', 'text', 'Subtitle of the How To Order instruction modal'),
('how_to_order_step_1', 'Enter user ID', 'text', 'Step 1 description in How To Order modal'),
('how_to_order_step_2', 'Select Items', 'text', 'Step 2 description in How To Order modal'),
('how_to_order_step_3', 'Choose Payment Method', 'text', 'Step 3 description in How To Order modal'),
('how_to_order_step_4', 'Submit Order', 'text', 'Step 4 description in How To Order modal')
ON CONFLICT (id) DO NOTHING;
