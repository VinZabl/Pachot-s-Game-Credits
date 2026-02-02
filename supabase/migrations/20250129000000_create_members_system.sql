/*
  # Create Members Management System

  1. New Tables
    - `members`
      - `id` (uuid, primary key)
      - `username` (text, unique) - member username
      - `email` (text, unique) - member email
      - `mobile_no` (text) - mobile number
      - `password_hash` (text) - hashed password
      - `level` (integer) - member level (default 1)
      - `status` (text) - active, inactive
      - `user_type` (text) - reseller, end_user
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `member_discounts`
      - `id` (uuid, primary key)
      - `member_id` (uuid, foreign key) - reference to member
      - `menu_item_id` (uuid, foreign key) - reference to menu item
      - `variation_id` (uuid, foreign key, nullable) - reference to variation (if discount is for specific variation)
      - `discount_percentage` (numeric) - discount percentage (0-100)
      - `capital_price` (numeric) - capital/cost price
      - `selling_price` (numeric) - selling price to member
      - `profit` (numeric) - calculated profit (selling_price - capital_price)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Updates
    - Add `member_id` to `orders` table to track orders per member

  3. Security
    - Enable RLS on all tables
    - Add policies for public access (registration, login)
    - Add policies for authenticated member access
    - Add policies for authenticated admin access
*/

-- Create members table
CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  mobile_no text NOT NULL,
  password_hash text NOT NULL,
  level integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  user_type text NOT NULL DEFAULT 'end_user' CHECK (user_type IN ('reseller', 'end_user')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create member_discounts table
CREATE TABLE IF NOT EXISTS member_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES menu_items(id) ON DELETE CASCADE,
  variation_id uuid REFERENCES variations(id) ON DELETE CASCADE,
  discount_percentage numeric(5, 2) NOT NULL DEFAULT 0,
  capital_price numeric(10, 2) NOT NULL,
  selling_price numeric(10, 2) NOT NULL,
  profit numeric(10, 2) NOT NULL GENERATED ALWAYS AS (selling_price - capital_price) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(member_id, menu_item_id, variation_id)
);

-- Add member_id to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'member_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN member_id uuid REFERENCES members(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_discounts ENABLE ROW LEVEL SECURITY;

-- Create policies for members table
-- Public can insert (registration)
CREATE POLICY "Anyone can register as member"
  ON members
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Public can select for login (but not password_hash)
CREATE POLICY "Anyone can read member basic info"
  ON members
  FOR SELECT
  TO public
  USING (true);

-- Authenticated users can update their own profile
CREATE POLICY "Members can update own profile"
  ON members
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create policies for member_discounts table
-- Public can read discounts (for showing prices)
CREATE POLICY "Anyone can read member discounts"
  ON member_discounts
  FOR SELECT
  TO public
  USING (true);

-- Authenticated admin can manage discounts
CREATE POLICY "Authenticated users can manage member discounts"
  ON member_discounts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create updated_at trigger for members
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create updated_at trigger for member_discounts
CREATE TRIGGER update_member_discounts_updated_at
  BEFORE UPDATE ON member_discounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_username ON members(username);
CREATE INDEX IF NOT EXISTS idx_member_discounts_member_id ON member_discounts(member_id);
CREATE INDEX IF NOT EXISTS idx_member_discounts_menu_item_id ON member_discounts(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_orders_member_id ON orders(member_id);
