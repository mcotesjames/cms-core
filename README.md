# MCJames Visual CMS

An editorial, canvas-first CMS: editors change pages, entries and records directly on the rendered page, with drafts, Publish, feedback comments and SEO built in. Each client site runs as its own instance on the platform.

- **Spec:** [`cms-platform-spec.md`](cms-platform-spec.md) is the single source of truth: architecture, editor behaviour, content model, roadmap and change log.
- **Working rules:** [`AGENTS.md`](AGENTS.md) (and the `AGENTS.md` files in subfolders).

## Status

The site and Studio run locally on a local D1 database and R2 bucket, and a staging copy runs on Cloudflare at https://cms-core-staging.mcotesjames-f69.workers.dev (not indexed; its Studio is closed until sign-in arrives in roadmap Phase 3). The public site is a plain skeleton: a homepage built from a hero and Text and Image sections, with more pages created in the Studio. Sign-in is a dev-only placeholder until Better Auth (Phase 3): in `npm run dev` you pick a seeded account at `/admin`.

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
```

Deploying staging (needs `npx wrangler login` once):

```sh
npx wrangler d1 migrations apply DB --remote          # when there are new migrations
npx vite build && npx wrangler deploy --config .output/server/wrangler.json
```
