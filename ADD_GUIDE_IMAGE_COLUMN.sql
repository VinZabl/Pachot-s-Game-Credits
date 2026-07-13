-- Migration to add guide_image_url and guide_text to menu_items table
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS guide_image_url TEXT;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS guide_text TEXT;
