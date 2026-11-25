# MCJames Visual CMS

An editorial, canvas-first CMS: editors change pages, entries and records directly on the rendered page, with drafts, Publish, feedback comments and SEO built in. Each client site runs as its own instance on the platform.

- **Spec:** [`cms-platform-spec.md`](cms-platform-spec.md) is the single source of truth: architecture, editor behaviour, content model, roadmap and change log.
- **Working rules:** [`AGENTS.md`](AGENTS.md) (and the `AGENTS.md` files in subfolders).

## Status

The site and Studio run locally on a local D1 database and R2 bucket, and a staging copy runs on Cloudflare at https://cms-core-staging.mcotesjames.workers.dev (not indexed). The public site is a plain skeleton: a homepage built from a hero and Text and Image sections, with more pages created in the Studio. The Studio at `/admin` uses email + password sign-in; new accounts wait for an admin's approval. In `npm run dev` there are also one-click shortcut accounts.

## Development

You need Node.js and npm.

```sh
npm i
npm run db:reset # build the local D1 database and seed fixture content
npm run dev      # vite dev server (local D1 + R2 through Wrangler)
npm test         # vitest
npm run lint     # eslint
npm run build    # production build (Cloudflare Worker via Nitro)
npm run db:generate  # after changing src/data/schema.ts: write a new migration
npm run user:owner -- you@example.com [--remote]  # make a signed-up account the owner
```

Local sign-in needs a `.dev.vars` file (gitignored) with `BETTER_AUTH_SECRET=<random>`; create one with `printf 'BETTER_AUTH_SECRET=%s\n' "$(openssl rand -base64 32)" > .dev.vars`.

Deploying staging (needs `npx wrangler login` once):

```sh
npx wrangler d1 migrations apply DB --remote          # when there are new migrations
npx vite build && npx wrangler deploy --config .output/server/wrangler.json
```
