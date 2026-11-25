-- Fixture content for local development (spec section 2 → Local development).
-- Sample text only: never client data. Load with `npm run db:reset`.

INSERT INTO users (id, email, first_name, last_name, role, approved_at) VALUES
  ('dev-owner', 'owner@example.test', 'Dev', 'Owner', 'owner', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('dev-editor', 'editor@example.test', 'Sam', 'Rivera', 'editor', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('dev-pending', 'pending@example.test', 'Alex', 'Morgan', 'pending', NULL);

-- The homepage: its hero, then a Text section and an Image section (the image is left empty, so
-- it's hidden on the site and shows an upload placeholder in the Studio).
INSERT INTO site_content (key, data) VALUES
  ('home', json('{"intro":{"title":"A skeleton site on the visual CMS.","summary":"A hero, a text section and an image section. Edit any of it in the Studio at /admin."},"sections":["stext","simage"],"section_data":{"stext":{"type":"text","heading":"About this site","body":"This is sample text. Click it in the Studio to edit it in place, or add more sections with the + button.\n\nA blank line starts a new paragraph."},"simage":{"type":"image","image_url":"","alt":"","caption":"","width":"contained"}}}')),
  ('settings', json('{"contact_email":"hello@example.com","footer_heading":"Get in touch","footer_tagline":"A sample footer line, edited in the Studio."}'));
