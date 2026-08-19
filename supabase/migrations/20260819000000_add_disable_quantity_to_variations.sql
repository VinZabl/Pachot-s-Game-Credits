-- Migration to add disable_quantity boolean column to variations table
ALTER TABLE variations ADD COLUMN IF NOT EXISTS disable_quantity BOOLEAN DEFAULT false;
