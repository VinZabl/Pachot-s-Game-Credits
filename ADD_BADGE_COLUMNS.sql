-- Migration to add badge_text and badge_color to menu_items table
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS badge_text TEXT;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS badge_color TEXT DEFAULT '#EC4899';
