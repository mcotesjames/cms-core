-- Fixture content (spec section 2 → Local development): loaded locally by `npm run db:reset`
-- and onto a new staging site. Sample text only: never client data, and never accounts or
-- passwords (staging is public). Local-only shortcut accounts are in seed.dev-users.sql.

-- The homepage: its hero, then a Text section and an Image section (the image is left empty, so
-- it's hidden on the site and shows an upload placeholder in the Studio).
INSERT INTO site_content (key, data) VALUES
  ('home', json('{"intro":{"title":"A skeleton site on the visual CMS.","summary":"A hero, a text section and an image section. Edit any of it in the Studio at /admin."},"sections":["stext","simage"],"section_data":{"stext":{"type":"text","heading":"About this site","body":"This is sample text. Click it in the Studio to edit it in place, or add more sections with the + button.\n\nA blank line starts a new paragraph."},"simage":{"type":"image","image_url":"","alt":"","caption":"","width":"contained"}}}')),
  ('settings', json('{"contact_email":"hello@example.com","footer_heading":"Get in touch","footer_tagline":"A sample footer line, edited in the Studio."}'));
