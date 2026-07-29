-- Migration to add Announcement Modal settings
INSERT INTO site_settings (id, value, type, description) VALUES
('announcement_active', 'false', 'text', 'Whether the announcement modal is active and displayed to users'),
('announcement_title', 'ANNOUNCEMENT', 'text', 'Title of the announcement modal'),
('announcement_text', '', 'text', 'Main body text of the announcement modal'),
('announcement_image', '', 'text', 'Image URL of the announcement modal')
ON CONFLICT (id) DO NOTHING;
