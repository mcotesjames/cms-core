-- Fixture content for local development (spec section 2 → Local development).
-- Sample text only: never client data. Load with `npm run db:reset`.

INSERT INTO users (id, email, first_name, last_name, role, approved_at) VALUES
  ('dev-owner', 'owner@example.test', 'Dev', 'Owner', 'owner', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('dev-editor', 'editor@example.test', 'Sam', 'Rivera', 'editor', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('dev-pending', 'pending@example.test', 'Alex', 'Morgan', 'pending', NULL);

INSERT INTO site_content (key, data) VALUES
  ('home', json('{"hero":{"headline":"A sample site on the visual CMS.","cta_label":"Discover"},"intro":{"text":"This is fixture content for local development. Edit anything here in the Studio."},"what":{"eyebrow":"What we do","intro":"Three sample cards that stack as you scroll."},"bio":{"name":"Sample Person","description":"A short sample biography. Points on the image open more detail.","portrait_url":"","portrait_alt":""}}')),
  ('insights', json('{"intro":{"title":"Insights","note":"Sample articles, essays and notes."},"list_label":"All insights"}')),
  ('investments', json('{"intro":{"eyebrow":"Portfolio","title_line_1":"Sample","title_line_2":"records","summary":"Records listed and filtered by sector and stage."}}')),
  ('publications', json('{"intro":{"eyebrow":"Writing","title":"Sample publications.","summary":"Published work hosted elsewhere."},"selected_label":"Selected","footnote":"Sample footnote."}')),
  ('settings', json('{"substack_url":"https://example.com/newsletter","contact_email":"hello@example.com","enquiry_recipient":"hello@example.com","footer_heading":"Get in touch","footer_tagline":"A sample footer tagline.","investments_disclaimer":"Sample disclaimer text."}'));

INSERT INTO entries (id, type, slug, title, standfirst, author, published, published_at, blocks) VALUES
  ('entry-welcome', 'insight', 'welcome', 'Welcome to the sample site', 'A first sample article, so the Insights pages have something to show.', 'Sam Rivera', 1, '2026-11-20',
   json('[{"id":"b1","type":"rich_text","body":"<p>This article is fixture content. Open it in the Studio to edit it in place.</p>"},{"id":"b2","type":"pull_quote","quote":"Edit where readers read.","attribution":"The CMS spec"}]')),
  ('entry-second', 'insight', 'second-sample', 'A second sample article', 'Another sample, so the feed and previous / next links work.', 'Sam Rivera', 1, '2026-11-10',
   json('[{"id":"b1","type":"rich_text","body":"<p>More sample text.</p>"}]')),
  ('entry-draft', 'insight', 'unpublished-sample', 'An unpublished sample', 'Only visible in the Studio.', 'Sam Rivera', 0, NULL,
   json('[{"id":"b1","type":"rich_text","body":"<p>Not on the live site yet.</p>"}]'));

INSERT INTO list_items (id, list, position, data) VALUES
  ('pillar-1', 'pillars', 0, json('{"title":"Research","tagline":"We study the fundamentals.","body":"Sample pillar text.","image_url":"","accordions":[{"title":"Method","body":"Sample detail."}]}')),
  ('pillar-2', 'pillars', 1, json('{"title":"Practice","tagline":"We put it to work.","body":"Sample pillar text.","image_url":"","accordions":[]}')),
  ('pillar-3', 'pillars', 2, json('{"title":"Sharing","tagline":"We make it accessible.","body":"Sample pillar text.","image_url":"","accordions":[]}')),
  ('card-1', 'cards', 0, json('{"title":"First card","body":"Sample card text.","image_url":""}')),
  ('card-2', 'cards', 1, json('{"title":"Second card","body":"Sample card text.","image_url":""}')),
  ('card-3', 'cards', 2, json('{"title":"Third card","body":"Sample card text.","image_url":""}')),
  ('hotspot-1', 'hotspots', 0, json('{"label":"Approach","body":"Sample hotspot text.","items":["First point","Second point"],"link_url":"","x":30,"y":30}')),
  ('hotspot-2', 'hotspots', 1, json('{"label":"Newsletter","body":"Sample link hotspot.","items":[],"link_url":"https://example.com/newsletter","x":70,"y":25}'));

INSERT INTO records (id, type, position, data) VALUES
  ('rec-inv-1', 'investment', 0, json('{"name":"Sample Co","description":"A sample record.","sector":"Energy","stage":"Seed","logo_url":"","website_url":"https://example.com","is_placeholder":false}')),
  ('rec-inv-2', 'investment', 1, json('{"name":"Example Labs","description":"Another sample record.","sector":"Materials / Quantum","stage":"Seed / Series A","logo_url":"","website_url":"","is_placeholder":true}')),
  ('rec-pub-1', 'publication', 0, json('{"title":"A sample paper","kind":"Paper","year":"2026","month":"10","outlet":"Sample Journal","coauthors":null,"summary":"A sample summary.","url":"https://example.com/paper","pdf":null,"featured":true,"sort":0,"is_placeholder":false}')),
  ('rec-pub-2', 'publication', 1, json('{"title":"A sample essay","kind":"Essay","year":"2025","month":null,"outlet":"Sample Review","coauthors":"A. Coauthor","summary":"Another sample.","url":"https://example.com/essay","pdf":null,"featured":false,"sort":1,"is_placeholder":false}'));
