-- Migration to add guide_image_url to menu_items table
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS guide_image_url TEXT;
