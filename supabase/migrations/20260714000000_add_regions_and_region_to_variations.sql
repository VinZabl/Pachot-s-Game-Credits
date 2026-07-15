-- Add regions JSONB column to menu_items table
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS regions JSONB DEFAULT '[]'::jsonb;

-- Add region text column to variations table
ALTER TABLE variations ADD COLUMN IF NOT EXISTS region TEXT DEFAULT NULL;
