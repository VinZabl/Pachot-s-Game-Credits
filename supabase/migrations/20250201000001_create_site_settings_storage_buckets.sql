/*
  # Create Storage Buckets for Site Settings

  Creates buckets for site logo and hero slideshow images used in Site Settings.
  - site-logo: logo image
  - hero-images: hero slideshow images (up to 5)
*/

-- Create storage bucket for site logo
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-logo',
  'site-logo',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Allow public read for site-logo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read access for site-logo'
  ) THEN
    CREATE POLICY "Public read access for site-logo"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'site-logo');
  END IF;
END $$;

-- Allow public upload for site-logo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public can upload site-logo'
  ) THEN
    CREATE POLICY "Public can upload site-logo"
    ON storage.objects FOR INSERT TO public
    WITH CHECK (bucket_id = 'site-logo');
  END IF;
END $$;

-- Allow public update/delete for site-logo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public can update site-logo'
  ) THEN
    CREATE POLICY "Public can update site-logo"
    ON storage.objects FOR UPDATE TO public
    USING (bucket_id = 'site-logo');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public can delete site-logo'
  ) THEN
    CREATE POLICY "Public can delete site-logo"
    ON storage.objects FOR DELETE TO public
    USING (bucket_id = 'site-logo');
  END IF;
END $$;

-- Create storage bucket for hero slideshow images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hero-images',
  'hero-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Allow public read for hero-images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read access for hero-images'
  ) THEN
    CREATE POLICY "Public read access for hero-images"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'hero-images');
  END IF;
END $$;

-- Allow public upload for hero-images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public can upload hero-images'
  ) THEN
    CREATE POLICY "Public can upload hero-images"
    ON storage.objects FOR INSERT TO public
    WITH CHECK (bucket_id = 'hero-images');
  END IF;
END $$;

-- Allow public update/delete for hero-images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public can update hero-images'
  ) THEN
    CREATE POLICY "Public can update hero-images"
    ON storage.objects FOR UPDATE TO public
    USING (bucket_id = 'hero-images');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public can delete hero-images'
  ) THEN
    CREATE POLICY "Public can delete hero-images"
    ON storage.objects FOR DELETE TO public
    USING (bucket_id = 'hero-images');
  END IF;
END $$;
