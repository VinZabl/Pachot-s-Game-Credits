-- Migration to add is_active column to variations table
ALTER TABLE variations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
