-- Migration to add sub_items JSONB column to variations table
ALTER TABLE variations ADD COLUMN IF NOT EXISTS sub_items JSONB DEFAULT NULL;
