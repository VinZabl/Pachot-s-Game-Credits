/*
  # Add Hero Slideshow Images to Site Settings

  Adds 5 configurable hero slideshow images for the customer page:
  - hero_image_1 through hero_image_5
  
  These images will be displayed in a slideshow on the customer page
  when viewing "All" categories. Images auto-rotate every 5 seconds.
*/

INSERT INTO site_settings (id, value, type, description)
VALUES
  ('hero_image_1', '', 'text', 'Hero slideshow image 1 URL'),
  ('hero_image_2', '', 'text', 'Hero slideshow image 2 URL'),
  ('hero_image_3', '', 'text', 'Hero slideshow image 3 URL'),
  ('hero_image_4', '', 'text', 'Hero slideshow image 4 URL'),
  ('hero_image_5', '', 'text', 'Hero slideshow image 5 URL')
ON CONFLICT (id) DO NOTHING;
