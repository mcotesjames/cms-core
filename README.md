# MCJames Visual CMS

An editorial, canvas-first CMS: editors change pages, entries and records directly on the rendered page, with drafts, Publish, feedback comments and SEO built in. Each client site runs as its own instance on the platform.

- **Spec:** [`cms-platform-spec.md`](cms-platform-spec.md) is the single source of truth: architecture, editor behaviour, content model, roadmap and change log.
- **Working rules:** [`AGENTS.md`](AGENTS.md) (and the `AGENTS.md` files in subfolders).

## Status

Phase 0 of the roadmap (fork and tidy). The code still contains the original build's features as fixtures and its Supabase client, but no database is connected, so the site builds and its tests run without loading content. Phase 1 moves every data call behind `src/data/`; Phase 2 swaps the backend to Cloudflare D1 and R2.

## Development

You need Node.js and npm.

```sh
npm i
npm run dev      # vite dev server
npm test         # vitest
npm run lint     # eslint
npm run build    # production build
```
