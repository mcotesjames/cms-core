INSERT INTO public.site_content (key, content) VALUES
('home', '{"hero":{"headline":"","cta_label":""},"intro":{"text":""},"what":{"eyebrow":"","intro":""},"bio":{"name":"","description":"","portrait_url":"","portrait_alt":""},"sections":[]}'::jsonb),
('insights', '{"intro":{"title":"","note":""},"list_label":""}'::jsonb),
('investments', '{"intro":{"eyebrow":"","title_line_1":"","title_line_2":"","summary":""}}'::jsonb),
('publications', '{"intro":{"eyebrow":"","title":"","summary":""},"selected_label":"","footnote":""}'::jsonb),
('settings', '{"substack_url":"","contact_email":"","enquiry_recipient":"","footer_heading":"","footer_tagline":"","investments_disclaimer":""}'::jsonb)
ON CONFLICT (key) DO NOTHING;