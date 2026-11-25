-- Local development only (never load this onto a deployed site): seeded Studio accounts without
-- passwords, used by the dev-only sign-in shortcuts (src/data/session.server.ts). Loaded by
-- `npm run db:reset`. They use the reserved .test domain so they can never receive email.
INSERT INTO users (id, name, email, first_name, last_name, role, approved_at) VALUES
  ('dev-collaborator', 'Dev Collaborator', 'collaborator@example.test', 'Dev', 'Collaborator', 'collaborator', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('dev-editor', 'Sam Rivera', 'editor@example.test', 'Sam', 'Rivera', 'editor', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('dev-pending', 'Alex Morgan', 'pending@example.test', 'Alex', 'Morgan', 'pending', NULL);
