# MCJames Visual CMS — Platform Spec

*Version 1.1 · 25 Nov 2026 · generalised from the original client build's Content Studio plan.*

*This is the platform version of the CMS spec. It describes the editor, content model and rules that every site on the MCJames CMS shares. Nothing in it is specific to one client: anything that varies per site lives in that site's **site configuration** (section 9) and its **site appendix** (section 15 holds the first one, mcotesjames.com).*

*This file is the single source of truth for the CMS platform. It lives in the platform repo. Every change to the CMS updates the relevant section and adds an entry to the change log (section 17). The original client build is a separate, frozen project and does not follow this file.*

**How to read it**
- **Platform** = behaviour every site gets. Change it here, and it changes for every site on the next update.
- **Site config** = what a site declares (its content types, records, sections, settings, brand). Declared, never hard-coded in shared components.
- `{{SITE_NAME}}`, `{{DOMAIN}}` etc. are filled from the site config.
- ✅ = proven in the original build and being ported · ☐ = new for the platform · ◐ = partly built in the original build.

---

## 1. Overview & Principles

Give each client an editorial, modular CMS that fits their brand. Editors change pages, entries and records directly on the rendered page, without technical overhead and without being able to break the layout.

**Guiding principle: simple but efficient.** The canvas is the editor. Editors edit where readers read; the side panel only appears for the thing they're working on.

### Requirements
- **One editor everywhere:** content entries and pages use the same visual editor and behave identically.
- **Canvas-first:** the real page is the editing surface. Text is typed in place; blocks and sections are selected on the page.
- **Canvas controls on the canvas:** hover outlines and ↑ / ↓ / + controls appear on the page, never in the side panel.
- **Side panel for the selected thing only:** every CMS field of the selected block, section or item, and nothing else.
- **Modular, short catalogues:** a small block catalogue for entries, a designed section library for pages.
- **Fast authoring:** paste from Google Docs; `+` inserter on every block.
- **Desktop-only editing:** tablet and mobile are checked with the device toggle, not edited.
- **Draft / live separation:** nothing changes the live site until **Publish / Update**.
- **No hard-coded content:** everything a visitor reads is editable, apart from UI labels (section 7).
- **No content lost:** every data change follows the content-safety rules (section 11).
- **Content vs design ownership:** editors own content; the developer owns layout, styling, templates and new sections. Code never hard-codes or overwrites CMS content.

---

## 2. Platform Architecture ☐

Replaces the original build's stack (Lovable Cloud / Supabase).

### One instance per site
Each site is its own deployment on the MCJames Cloudflare account:

| Piece | Per site |
|---|---|
| Worker (TanStack Start, built by Nitro for Cloudflare) | Public site + Studio at `/admin` |
| D1 database | Own database, bound only to this site's Worker |
| R2 bucket | Own media bucket (never a folder in a shared bucket) |
| Users | Stored in the site's own D1 |
| Secrets | Own Resend key, own auth secret |
| Environments | Production Worker + a staging Worker, each with its own D1 and R2 (see Environments and content flow) |

A site's code can only reach its own bindings, so client data is separated by infrastructure, not by filters in code.

### Data layer (`src/data/`)
- **The only code that talks to D1 or R2.** Routes, components and the Studio call named functions (`getPage`, `saveDraft`, `publishEntry`, `listRecords`, `uploadMedia`…), never the database directly.
- **Access is denied by default.** Every server function lives in `src/data/` and starts its chain with one access middleware from `src/data/access.ts`: `asVisitor` for public reads (live columns only, never `draft`), or `asEditor` / `asAdmin` / `asCollaborator` for Studio functions, which check the session and role before the handler runs and pass the user on as `context.user`. (These are the `publicFn` / `studioFn` wrappers: TanStack Start's compiler needs each `createServerFn(…).handler(…)` chain written out in place, so the wrapper is a middleware rather than a factory.) `src/test/server-fns.test.ts` lists every server function and fails if one is defined elsewhere or skips the middleware. These checks replace Supabase's RLS policies: drafts, unapproved accounts and the media library are protected here.
- **Each field has exactly one writer** (section 5 → Page settings). The data layer enforces it: Publish preserves live values of fields it doesn't own.
- **Validation from config:** each record type's `data`, each section's fields and each list item are checked against a schema (zod) generated from the declarations in `site.config.ts`. The Studio form, the data layer and the public site share that one definition.
- **Schema and migrations with Drizzle** (D1 / SQLite dialect); generated SQL migration files are committed.
- Functions run server-side only (TanStack server functions). No database credentials or bindings ever reach the browser.

### Rendering
- **Public pages render on the Worker** from live columns in D1, and the response is stored in Cloudflare's edge cache (Cache API) by `src/data/cache.server.ts`.
- **Cached pages are keyed by a content version**, not purged: the key is the page's path plus the time live site content last changed (`site_content.updated_at`, written by Publish and Settings saves, never by draft autosaves). Any live change makes every data centre miss on its next request and render fresh, so publishing is live everywhere within seconds (the version is re-read at most every 2 seconds per Worker instance). *Why not purge: the Cache API is per data centre, so deleting entries only clears one; a global purge needs Cloudflare's purge API, a zone and a token per site.* Query strings are ignored for public pages.
- **Cached pages are also keyed by the build** (`__BUILD_ID__`: the commit in CI, a fresh value for local builds, set in `vite.config.ts`). A deploy renames the CSS and JS files the HTML points at and removes the old ones, so HTML cached by an older build must never be served after a deploy; with the build in the key, the first request after a deploy renders fresh in every data centre.
- **Never cached:** the Studio (`/admin`), server functions (`/_serverFn`) and the Studio canvas (`?studio=1`). Media (`/media/<key>`) is cached by address, since a key's file never changes.
- **Browsers always revalidate pages** with the edge (`cache-control: public, max-age=0, must-revalidate`); media keeps a one-year immutable lifetime. Responses carry `x-edge-cache: HIT|MISS <build> <version>` for diagnosis.
- **The Studio and its canvas run on the same Worker** and read drafts through the data layer, never from the cache. Studio canvases render in the browser only (`?studio=1`, TanStack `ssr: "data-only"`) to avoid hydration mismatches when drafts arrive.
- **Sitemap and robots** are server routes built from published content and cached like pages.

### Media
- Uploads go to the site's R2 bucket under `library/<timestamp>-<name>`, served from a stable public path (`/media/<key>` via the Worker, `cache-control: public, max-age=31536000, immutable`, ETag / 304). **No expiring signed links.** Content stores the path; share tags make it absolute.
- **Images are resized and compressed in the browser before upload** (canvas / `createImageBitmap`; max dimension and quality set in site config). Workers can't run `sharp`, and this keeps uploads small and free. The original file is not kept.
- SVG and non-image files upload unchanged.

### Auth
- **Better Auth** on D1 (no hand-rolled sessions): `src/data/auth.server.ts`, endpoints at `/api/auth/*` (never cached). Built per request, using the request's origin as its base address, so one build runs on localhost, staging and production. Sessions are HTTP-only, `SameSite=Lax` cookies (Secure on https), 7 days.
- **Email + password** (decision 1). Passwords are hashed with PBKDF2-SHA256 through Web Crypto (`src/data/password.server.ts`, 100,000 iterations, stored with their iteration count so it can be raised). Minimum 10 characters. Until email sending exists, admins set temporary passwords (Users) and everyone can change their own (Your account); changing a password signs out other sessions.
- **Sign-up** asks for first name, last name, email and password and creates a `pending` user; sign-up never sets a role. `SIGNUP_OPEN=false` makes a site invite-only.
- **Rate limits** (stored in D1, so they hold across Workers): sign-in 5 per minute, sign-up 5 per hour, password change 5 per minute, per IP (`cf-connecting-ip`).
- **Secret:** `BETTER_AUTH_SECRET`, a Worker secret per environment (`.dev.vars` locally); generated and piped into `wrangler secret put`, never printed.
- **The collaborator** (the site's developer, MCJames) gets in without waiting: the first sign-up whose email matches the site's `COLLABORATOR_EMAIL` (a Worker secret; `.dev.vars` locally) is approved as collaborator automatically, as long as the site has no collaborator yet. Anyone else, including a stranger who reaches a new site's sign-up first, waits for approval. `npm run user:collaborator -- <email> [--remote]` hands the role to another signed-up account.
- **Local development** also has shortcut accounts without passwords (`db/seed.dev-users.sql`, `cms_dev_user` cookie), compiled out of builds and never seeded anywhere else.

### Local development
- `npm run dev` with a local D1 database and R2 bucket (through Wrangler), seeded from `db/seed.sql` (fixture content only, never client data). Local has its own database (`preview_database_id`), never staging's.

### Environments and content flow
Every site runs in three places, each with its own database and media bucket:

| Environment | What it's for | Content |
|---|---|---|
| **Local** | Experimenting and building features | Fixtures, or a copy pulled from production |
| **Staging** | Previewing new features and designs to the client; rehearsing updates and migrations | Before launch: where the site's content is built. After launch: a copy pulled from production |
| **Production** | The public site | The real content, edited by the client in its own Studio |

**The rule: code goes up, content comes down.**
- **Code and schema** move local → staging → production. The same migrations run in the same order everywhere, so the three databases always share one structure.
- **Deploys come from GitHub, never a laptop.** Every push to `main` runs the checks (`.github/workflows/ci.yml`: type check, lint, tests, build); if they pass, the `deploy-staging` job notes the D1 Time Travel restore point, applies staging migrations, then deploys the exact Worker that was built and checked. One staging deploy runs at a time and is never cancelled halfway. It uses the repo secrets `CLOUDFLARE_API_TOKEN` (Workers + D1 write, this account only) and `CLOUDFLARE_ACCOUNT_ID`; the Worker's own secrets stay on Cloudflare. Production (☐, Phase 7) will deploy from a tag or a manual run behind a GitHub environment that needs MCJames's approval, with a backup before any migration. The manual `wrangler deploy` stays as a fallback only.
- **Content** moves production → staging → local (`content:pull`), so previews and experiments use real content. Once a site is live, nothing copies content *up* over production: the client edits there, and copying staging up would erase their changes.
- **The one exception is launch:** before a site goes live, its content is built on staging, and `content:launch` copies it into the empty production database once.
- **Previewing content changes after launch** happens on production itself: every edit is a draft until Publish, and secret preview links (Phase 9) share a draft without publishing it. Staging is only needed to preview *features*.

**What a content copy includes:** site content, pages, entries, records, list items, menus, settings, the `media` table and the media files in R2 (copied object by object, since they live outside the database). **What it never copies:** users, sign-in sessions and accounts (test logins must never reach production, and real accounts never leave it) and, by default, feedback comments (they're about the environment they were left in).

**Sync tools** (Phase 8; `content:launch` is needed for the first site launch in Phase 7):
- **`content:launch <site>`** — staging → production, once. Refuses if production already has content unless forced, and always exports a backup of production first. Copies the database content (D1 export → import of the content tables) and the media bucket, then clears the edge cache by its content version.
- **`content:pull <site> --to staging|local`** — production → staging or local. Backs up the target first, replaces its content tables and media, and leaves its users and comments untouched.

### Email
- Resend, the site's own sending domain. Used for: sign-in codes or confirmation, approval notices, comment notifications, form submissions.

### Scheduled jobs (Cloudflare Cron Triggers)
- Daily: delete resolved comment threads older than 30 days.
- Daily: export the database (SQL dump) to MCJames's backup bucket. D1 Time Travel covers point-in-time recovery on top.

### Database schema (SQLite / D1)
JSON is stored as `TEXT` and validated in the data layer; IDs are generated in code (`crypto.randomUUID()`); dates are ISO 8601 text. Live columns are what the public build reads; `draft` holds unpublished changes.

| Table | Holds | Key columns |
|---|---|---|
| `entries` | Content entries (all content types) | `id`, `type`, `slug`, `title`, `standfirst`, `cover`, `author`, `published_at`, `published`, `blocks` (JSON), `legacy_body`, `seo` (JSON), `draft` (JSON) |
| `records` | Records (all record types) | `id`, `type`, `data` (JSON), `position`, `draft` (JSON), `created_at`, `updated_at` |
| `list_items` | Items inside sections (cards, accordions, positioned items…) | `id`, `list`, `position`, `data` (JSON) |
| `site_content` | One row per page, plus `settings`, `menus`, `lists` (list drafts), `pages` (created-page index) | `key`, `data` (JSON), `draft` (JSON) |
| `media` | Media library | `id`, `key`, `filename`, `mime`, `bytes`, `width`, `height`, `alt`, `previous_key`, `uploaded_by`, `created_at` |
| `users` | Studio accounts | `id`, `email`, `first_name`, `last_name`, `role` (`pending` / `editor` / `admin` / `collaborator`), `created_at`, `approved_at` |
| `sessions`, `accounts`, `verifications` | Sign-in sessions and codes (Better Auth's own tables) | as Better Auth defines them |
| `comments` | Feedback threads and replies | `id`, `thread_id` (null for a thread, the thread's id for a reply), `anchor` (element address), `opened_on` (`page:<key>`, `post:<id>`, `record:<table>:<id>`), `position` (JSON), `body`, `author_id`, `assignee_id` (who it's for), `device`, `resolved_at`, `resolved_by`, `created_at`, `updated_at` |

- **Records are one generic table.** A record type's fields are declared in site config and stored in `data`. New record types need no migration.
- **Multi-value fields** are stored as a JSON array (not a joined string), ordered as the option list orders them.
- Migrations are SQL files in the repo, applied per site by the setup and update scripts. Platform migrations live in `migrations/platform/`; the rare site-only table goes in `migrations/site/`, so their numbering never clashes (section 12 → Platform updates).
- With generic `records` and `list_items`, a new record type or section needs config only, never a migration.

### Roles

| Role | Can |
|---|---|
| `pending` | Sign in and see "Waiting for approval". Nothing else. |
| `editor` | Everything in the Studio except Users and site settings marked collaborator-only. |
| `admin` | Everything, including approving and removing users (never their own access). |
| `collaborator` | MCJames, the site's developer. Same as admin; can't be removed or demoted. The first sign-up with the site's `COLLABORATOR_EMAIL` becomes the collaborator automatically. |

There is no "whoever signs up first gets in" rule: only the collaborator email is approved automatically. The client's first admin signs up and the collaborator approves them as admin.

---

## 3. Content Kinds

Every content type on every site is one of these kinds and inherits that kind's screens and behaviour. **No bespoke admin screens.**

| Kind | What it is | How it's edited | Declared in site config as |
|---|---|---|---|
| **Content** | Editorial entries with their own page (articles, news, case studies with detail pages) | List → visual editor + Settings | `contentTypes` |
| **Records** | Reusable structured data, listed, filtered or referenced across pages (team, services, projects, logos, publications) | List → form drawer | `recordTypes` |
| **Pages** | A page and the sections on it | Pages list → visual editor + Settings | `pages` (built-in) + created pages |
| **Settings** | Site-wide configuration, rarely changed | One form | `settings` |

### Where new content goes
1. An editorial entry with its own page → **Content**.
2. Structured data listed, filtered or referenced across pages → **Records**.
3. A section on a specific page → that page under **Pages**.
4. Site-wide configuration → **Settings**.

### One home, many references
- Every piece of content is created and edited in exactly one place; other pages reference it.
- Updating it updates it everywhere it appears.
- **Draft, unpublished or deleted references** are hidden on the live site and flagged in the editor — never an empty card or broken section.

### Growing the admin
- A section used on one page lives on that page (its items are list items).
- If it starts appearing on a second page, it gets its own home (usually a record type) and both pages reference it.
- The admin only grows when the site does.

---

## 4. The Visual Editor

### Studio dashboard
- `/admin` opens on the site's **primary list** (site config `studio.home`: the main content type, or Pages if the site has none).
- **Every list works the same way** (content entries, pages): thumbnail where relevant, title or name, status (**Draft / Live / Live with unpublished changes**), date or web address, and **Edit / Settings / Duplicate / Delete**, plus **+ New**.
  - **Edit** opens the visual editor, which is only for what's on the page.
  - **Settings** opens a form for everything behind it (name, web address, author, date, search & sharing). **Save puts settings live straight away**; they don't wait for Publish.
  - **Duplicate** creates a draft copy. **Delete** asks for confirmation.
- The sign-in screen uses the site's logo (from site config), not typed text.

### Editor layout

```text
+------------------------------------------------------------------------------------------+
| ← Back  [Page switcher ▾]  Unpublished changes  [Desktop|Tablet|Mobile] [Comment] [Hide panel] [Discard] [Publish] |
+---------------------------------------------------------------+--------------------------+
|                                                               | SELECTED: Quote          |
|   DATE · AUTHOR                        ← click: Settings link | Quote                    |
|   Title                                ← type in place        | [__________________]     |
|   Standfirst…                          ← type in place        | Attribution              |
|   [ cover image ]                      ← click to replace     | [__________________]     |
|                                                               |                          |
|   ┌ ─ ─ ─ ─ ─ ─ hovered block (dashed outline) ─ ─ ─ ─ ─ ┐    | [Done]                   |
|   │  "Quote text…"                                       │    |                          |
|   └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─[ ↑  ↓  + ]─ ┘    |                          |
+---------------------------------------------------------------+--------------------------+
```

### Canvas behaviour ✅
- **The canvas is the real page**, rendered exactly as it is live, loaded in a frame with editable text and sections marked.
- **Hover:** a block or section gets a dashed outline and a small **↑ / ↓ / +** bar at its bottom edge. **↑ / ↓** moves it one position; **+** inserts below it from the template's menu (section 6).
- **Click to select:** solid outline; the side panel fills with all its CMS fields.
- **Two selection levels, two colours:** sections (and entry blocks) in one colour, elements inside them (text, images, list items) in another. Dashed on hover, solid when selected; an inner element's outline sits inside its section's. Colours are tokens (`--studio-section` / `--studio-inner` / `--studio-comment` on `.studio-live`; default blue `#2f64d6` / cyan-blue `#3aa0c8` / purple `#7b5ad6`; site config `studio.selectionColours` later). The canvas's ↑/↓/+ bar is a small dark toolbar.
- **Selection flash:** a quick fading flash in the selection colour on the most specific thing selected. Off for reduced motion. Drawn as a separate fixed overlay, never by styling the element.
- **Outlines never collapse:** small elements are outlined just outside their edge; only items that fill their section are outlined inside.
- **Clear selection:** **Done** or **Escape**. With nothing selected, the panel shows a short hint and a link to Settings.
- **Editable text** is typed on the page; it saves to the draft on click-away. In-place and panel edits are the same draft and stay in sync.
- **Pinned parts** (a page's hero, an entry's header) can be edited but have no ↑ / ↓ and can't be deleted. A hero shows **+** only.
- **Deleting** is done from the side panel (**Delete block / section / item**), the same way everywhere.
- **Site-wide text** (footer, disclaimers) can be edited from any page and changes everywhere.
- **Empty fields still show in the editor** (section 5 → Empty content).

### Side panel ✅
- Only the selected thing's fields: text, images, links, options, and its own nested items.
- No page structure or section ordering (that's on the canvas). The one list it shows is a selected section's own items.
- **One column, drill-down layout** (never a list-plus-form split; it breaks in a 320px panel).
- Collapsible with **Hide panel**.

### Top bar (identical in every editor) ✅
**Back**, **page switcher**, **save state**, **Desktop / Tablet / Mobile**, **Comment** (with a count of open comments for you), **Hide panel**, **Discard**, **Publish** (becomes **Update** once live).

### Page switcher ✅
The page name in the top bar is a dropdown for jumping between editors.
- **Pages** are direct links; the current one is ticked.
- **Each content type** is a row that opens its list; its **›** arrow lists the entries, newest first, with "Draft" on unpublished ones.
- **Dots:** orange for unpublished changes (the page's own draft, or a site-wide draft — menus, footer, lists — since publishing from that page publishes it), purple for unresolved comments. Content-type rows roll up their entries' dots.
- **Search and shortcut:** type to filter; Enter opens the first match. **Cmd/Ctrl+K** opens it from anywhere, including the canvas.
- **Nothing is lost:** a draft still saving lands before the switch; no confirmation prompt.
- **View carries over:** device view and comment mode travel in the URL (`?device=mobile&mode=comment`).

### Content entries ✅
- **Header (pinned):** title and standfirst typed in place (the standfirst is also the excerpt for listings and social previews). Clicking the **date line** points to the entry's **Settings**. Clicking the **cover** replaces it.
- **Lead unit:** an entry can't be published without the fields its template marks required (default: cover and first paragraph).
- **Body blocks:** added with **+** from the template's block catalogue (section 6).
- **Paste from Google Docs:** keeps headings, paragraphs, lists, quotes, links, bold/italic and images; strips Docs' fonts, colours and spacing. A pasted Vimeo or YouTube link becomes a Video block.
- **New entries** open with the header and one empty text block — never a blank canvas.
- **Imported legacy content** (Markdown or HTML from an old site) converts to blocks when opened; the live entry is unchanged until **Update**, and the original is kept in `legacy_body` until the conversion is confirmed. Anything unmapped is flagged, not dropped.
- Automatic parts (reading progress, previous / next) are not editable.

### Pages ✅
**Every page is a pinned hero, then a flexible list of sections, then the site-wide footer.**
- **Adding:** press **+** on the hero or any section; the panel lists the sections the page's template allows. The new section appears below, selected, fields ready.
- **Any allowed section can go on any page.**
- **Text sections can repeat**, each with its own text.
- **Sections fed by a shared list appear once per page** (a second copy would show the same items). Once placed, they leave that page's + menu.
- **Deleting** a built-in page's original section keeps its content; adding that section type back restores it.
- **Pages only use designed sections** — entry blocks are not offered on pages.
- Each section has a stable anchor (`section-<id>`) so links survive reordering.

### List items ✅
Sections that show a set of items (cards, accordions, steps, logos, positioned items) edit them as list items.
- **Select an item** by clicking it on the page or in the section's list in the panel. The panel drills into that item (**← back** to the section); the item gets a solid outline.
- **Section panel:** the section's own fields, then its items with **↑ / ↓** to reorder and **+ Add <item>**.
- **Adding:** the new item appears **on the page straight away** with placeholder content, selected and scrolled into view.
- **Drafts:** item edits, additions, deletions and reordering are drafts. Lists are shared, so an unpublished list change shows in every editor that uses that section. On Publish, each edited list is written to `list_items` (position = order), removed items are deleted, and the list draft is cleared.

### Positioned items ✅ (generalised from the original build's biography hotspots)
A section type can declare **positioned items**: items placed over an image (hotspots, map pins, annotations).
- Placed by **clicking on the image** while the item is selected (new items start in the middle). X / Y % fields remain for fine adjustment.
- Selecting one shows its fields (label, text, optional bullets and link, position).
- Dragging the pin is a later refinement.

### Motion while editing ✅
Sites with motion (letter animations, shader backgrounds, smooth scrolling, horizontal or scroll-pinned sections) get in the way of editing.
- **In the editor, motion is paused**, smooth-scroll libraries are turned off, and scroll-driven sections lay out statically so every item can be reached — usually the site's reduced-motion layout.
- The live page and the device toggle show the real behaviour.
- **Requirement for every new section:** if it's scroll-driven, it must declare a static editor layout.

### Records ✅
Records are edited as a **list with a form drawer**, not on the canvas.
- Fields come from the record type's declaration (section 9). Constrained values are **dropdowns** or **tick-box lists** (several can apply).
- **Option lists live in one place** that both the form and the public site read (labels, filter buttons, plural labels), so they can't drift apart.
- **Old values are never silently changed:** a value no longer in its option list shows "(not in list)" until someone picks a new one.
- **Ordering:** each record type declares `manual` (↑ / ↓ in the list), or a sort field (alphabetical, date…).
- **Comments:** each saved record has a Comments area; the list shows open-comment counts.
- ☐ **Draft step for records** (the original build saves records straight to live; the platform gives them draft / Publish like everything else).
- ☐ **Preview card** of how the record appears on the site.
- ☐ **Placeholder flag** with a badge in the list; a launch check lists any placeholders still live.

### Studio theme ✅
- The whole Studio (sign-in, lists, forms, editor chrome) uses its **own "Panelled" theme** (`design.md` v1, 2026-11-25; reference products Kirby's Panel and Ghost's admin, nothing copied), defined as `--st-*` tokens under `:root:has(.studio)` in `src/styles.css`, with the shared Tailwind tokens mapped onto them:
  - **Cards on a canvas:** a warm grey canvas (`#f1f0ed`); everything you work on (the screen's content, the editor sheet, the side panel, dialogs) is a white card with a 1px `--st-line` border and 12px corners, no shadow. Menus and popovers float with `--st-shadow-pop`, dialogs with `--st-shadow-dialog`.
  - **Quiet chrome:** the sidebar (240px, Lucide icons, the active item a white lift) and the editor top bar (52px) sit directly on the canvas.
  - **One primary action per screen:** the only filled dark button (New page, Publish, Save); secondary buttons are white with a border, toolbar and row actions are ghost buttons. 8px radius, 36px default height.
  - **Status as a dot plus a word:** live (green), unpublished changes (amber), draft (hollow grey ring), error (red), comments (purple). Badge variants `live` / `changes` / `draft`; the editor bar shows a plain dot and word.
  - **Roomy forms:** labels 13/500 above 40px fields on an inset fill; focus = blue accent border plus a soft halo.
  - **Type:** Inter (variable, self-hosted via `@fontsource-variable/inter`, so only Studio screens download it), 14/20 base, weights 400/500/600, sentence case; uppercase only for the 12px sidebar group labels.
  - **Lists:** 48px rows divided by hairlines; the whole row opens the editor; Settings, Duplicate and Delete sit in a `…` menu.
  - **Editor:** device sizes as a segmented control (white lift on an inset track); the client's page sits on a white sheet 12px from the canvas edges; the side panel is a 340px card beside it, stacked under the sheet below 768px.
  - **Motion:** 120ms (hover) / 180ms (menus) / 240ms (dialogs, panel), one ease-out curve; reduced motion keeps only colour and opacity changes.
- **Scoped to Studio screens only** (`:root:has(.studio)`), and the public site's global element rules exclude the Studio, so neither leaks into the other. The canvas always shows the page exactly as visitors see it.

### Safety
- Drafts save on click-away; Publish / Update is the only route to the live site.
- Shortcuts use `Cmd` on Mac and `Ctrl` on Windows.

---

## 5. Studio Structure (`/admin`)

### Navigation
Built from site config; sections with nothing in them don't appear.

```text
{{SITE_NAME}} STUDIO
─────────────
FEEDBACK
  Feedback (count for you)
CONTENT              ← one item per content type
  <Content type>
RECORDS              ← one item per record type
  <Record type>
PAGES
  Pages
LIBRARY
  Media
─────────────
SETTINGS
  Site settings
  SEO
  Users (count waiting for approval)
```

### Menus ✅
Menus are edited on the canvas like any other block — no Menus screen.
- **Main menu** (header, also the mobile menu): a flat list of links. One link can be shown as a button. Above the site's `menus.mainMax` ordinary links (default 5) the panel warns it may not fit on smaller screens.
- **Footer menu:** up to `menus.footerColumns` columns (default 3), each a heading plus links. Columns can be added, removed and reordered.
- **No sub-menus** (platform v1).
- **Links point at things, not addresses:** a page, a published entry, a section of a page, an external link (new tab), or an email. Renames and reorders never break them.
- **A link whose target has gone** is hidden on the live site and shown faded and struck through in the editor, with the reason in the panel. **An external link with no address yet** shows as "coming soon".
- **Site-wide,** draft and publish like everything else (`site_content` row `menus`). Until first edited, menus are built from defaults in site config.

### Empty content is hidden ✅
One shared helper, used by every component: when a field is blank (or only spaces), it isn't rendered, and neither is its container once everything inside is empty.
- **Field, container and section level:** no empty tags, gaps or broken images; a section with nothing to show is left out.
- **Entry blocks** with an empty main field are left out.
- **Menus:** a link with no label is hidden, and so is a footer column with no heading and no visible links.
- **In the editor everything still shows:** empty text reads "Empty — hidden on the site" in faint italics; an empty image shows an upload placeholder.
- **Designed empty states stay** where they explain a visitor's own action ("Nothing in this category yet").

### Feedback comments ✅
A way for anyone in the Studio to leave a comment on part of a page, entry or record for someone else to pick up — the client asking for a fix, or MCJames asking the client for content.
- **Comment mode:** **Comment** in the top bar. While on, clicking anything on the canvas starts a comment on it, and editing pauses. "Comment on the page as a whole" covers everything else.
- **Pins only in comment mode:** numbered purple pins; clicking one opens its thread in the panel from any panel state.
- **Pins mark the exact spot clicked,** even inside things that can't be selected for editing. The comment belongs to the nearest addressable block and also stores the path to the inner element and the click point (`position`), so the pin follows the text when the layout reflows. If the inner element goes, the pin falls back to the same spot on the block.
- **Alt-click (Option-click)** uses the page normally while commenting (open an accordion, flip a card) — links still don't navigate.
- **Hidden content:** a pin whose element is closed is drawn hollow on the nearest visible part, and the thread says so.
- **Threads:** comment, replies, Resolve, Reopen; each records the device view it was left in.
- **"For" is required:** every comment is for a named, approved user; reassignable.
- **Notifications:** in-app "for you" counts (sidebar, Comment button) plus an email via Resend.
- **Records:** a record's thread shows in its form and as a pin wherever the record appears on a canvas — one thread in both places.
- **Shared elements** (records, entry cards, menus, footer) show their pins on every canvas they appear on; anything else only where it was left.
- **Element removed:** the thread stays in the list, marked "element removed".
- **Feedback list:** For me, All open, Resolved. Clicking a thread opens the right canvas in comment mode, scrolled to the exact spot, with the thread open (or the record's form, scrolled to its comments).
- **Clean-up:** resolved threads deleted 30 days after resolving (daily job). Open threads are never removed automatically.
- **Never on the live site.**

### Users and sign-up ✅ (auth rebuilt ☐)
- **Anyone can request an account** with first name, last name and email (sign-in method: open decision 1).
- **New accounts can't use the Studio until an admin approves them** in Settings → Users, which shows a count waiting. Admins can remove others' access, never their own.
- **Names are required** and shown on comments and in the "For" picker.
- Sign-up can be switched off per site (`auth.openSignup: false`), leaving invite-only.

### Page settings and SEO ✅
Every page and entry gets complete search and sharing tags from **one shared builder** (`lib/seo.ts`): title, description, canonical address on `{{DOMAIN}}`, Open Graph and Twitter tags with a share image, robots, and structured data (Organization on the homepage; Article on article-like content types). New pages are covered automatically.
- **Where it's edited:** the **Settings** screen for each page or entry (from **Settings** in its list, or the link in the editor's empty panel). The visual editor holds no backend settings.
  - **Page settings:** page name, web address, search & sharing.
  - **Entry settings:** author, publish date (empty = first publish day), web address, search & sharing.
- **Save goes live straight away** (it changes the content version, so cached pages refresh), with an "Unsaved changes" flag until then. It also writes into any open draft. For something not yet published, the toast says it goes live on first publish.
- **Ownership:** Settings is the only writer of a page's `seo` and an entry's author, date, web address and `seo`. Publish keeps the live values of these.
- **Search & sharing panel:** a Google-style preview; Search title, Description and Share image, each **Automatic** or **Custom · Reset**; counters that turn amber past Google's cut-off; **More** → Hide from search engines.
- **Every field is optional; empty means automatic.** The placeholder shows the exact automatic value: built-in pages use their hand-written defaults from site config; created pages use their hero title and summary; entries use their title, standfirst and cover; the share image falls back to Settings → SEO.
- **Titles:** the site's suffix (Settings → SEO, e.g. "— {{SITE_NAME}}") is added to every page except the homepage.
- **Hide from search engines** adds `noindex` and leaves it out of the sitemap.
- **Deliberately left out:** keywords, separate social titles, manual canonicals, structured-data settings.
- **Sitemap and robots:** server routes built from published pages and entries, minus hidden ones; robots keeps crawlers out of `/admin`.

### New pages ✅
Standard pages are created in the Studio; development is reserved for genuinely new layouts and functionality.
- **+ New page** (Pages list and page switcher) asks for a **name**, a **web address** (suggested from the name; addresses already used are refused) and a **template** (section 6).
- It starts with its template's hero and starting sections, and opens in the editor.
- **Duplicate** works on any page, built-in included: an unpublished copy named "… (copy)" with a free address and every section with its current text (the draft if there is one). Built-in sections convert to their editable equivalents.
- **Not on the site until its first Publish;** menu links to it stay hidden until then.
- **Settings:** rename, change the address (with a warning once live; menu links update automatically), **Delete** (off the site and out of the Studio; content kept in the database).
- **Built-in pages** (declared in site config) are managed the same way, except their **web address is fixed** and they **can't be deleted**.

### Consistency across the Studio
- **Ordering:** ↑ / ↓ on the canvas for blocks and sections; ↑ / ↓ in lists for manually ordered records. No numeric "Order" fields.
- **Draft / live:** content, records, pages, lists and menus all use the same Publish / Update flow. Settings screens save live.
- **Media library:** shared across the Studio.

---

## 6. Templates

Each content type, record type and page has a template that decides which blocks, sections or fields are available. Editors never choose a template for entries or records; created pages are the exception. The **+** menu only shows what the template allows.

### What a template defines
1. **Fixed parts:** pinned; editable but not moved or deleted.
2. **Flexible zone:** where blocks or sections are added, with its allowed list.
3. **Limits:** e.g. one hero; list-fed sections once per page.
4. **Required to publish:** fields that must be filled (e.g. cover, first paragraph).
5. **Section options:** designed layout variants or ordering options.

### Content template (default: Article)
| Fixed parts | Allowed blocks | Required to publish |
|---|---|---|
| Header (date, author, title, standfirst, cover); automatic reading progress and previous / next | Text, Quote, Image, Video, Stat, Divider (site config can remove blocks, or add site blocks) | Cover + first paragraph |

**Block catalogue (platform):**

| Block | Fields | Width |
|---|---|---|
| Text | Rich text (a continuous run of text is one block) | Reading column |
| Quote | Quote, attribution | May break out to wide |
| Image | Image, caption, layout (contained / full width / two-up), second image | May go full-bleed |
| Video | URL (Vimeo / YouTube / uploaded), caption | May go full-bleed |
| Stat | Value, label, footnote | May break out to wide |
| Divider | Line / space | — |

Block menus are ordered by how often each block is used (Text first).

### Page templates
A page template is a **set of rules over the one section system** (`lib/templates.ts`), not a separate renderer or editor. Draft/publish, comments, SEO, menus, duplicate and the canvas work the same on every template.

The platform ships one template, **Standard**:

| | **Standard** |
|---|---|
| Hero | Page hero (title + intro) |
| Starting sections | None |
| Required (can't delete; can move) | None |
| + menu offers | Every section type whose declaration allows Standard |
| Nav and footer | Shown |

Platform shape (`lib/templates.ts`): `{ label, description, hero: boolean, starting: SectionType[], required: SectionType[], allowed: (type) => boolean }`. New layouts ("Landing page", "Long-form report", the original build's "Interactive") are site templates declared in `site.config.ts` as `{ label, description, hero, required, sections }` (section 9), not new routes: `required` are the starting sections, `sections` what the + menu offers. A site section can limit itself to some templates (`templates: [...]`). A page whose stored template the site no longer has falls back to Standard (`templateDef`).

- **Stored** as `template` in the page's `site_content` row; missing = Standard. **Built-in pages are always Standard.**
- **Chosen** in + New page; **switched** in the page editor's empty panel → Template.
- **Switching clears the page's sections** (with a warning listing what will go) and starts the new template's starting sections. Kept: name, address, published state, hero text, SEO, comments (threads on removed sections show as "on a removed section"), media files. The switch is a draft: **Discard restores everything**.
- **Guard:** the renderer skips any section the page's template doesn't allow.

### Platform section library
Every site gets these; site config adds its own designed sections (section 9).

| Section | Own fields | Items from | Repeats? |
|---|---|---|---|
| **Text** ✅ | Heading, body (paragraphs separated by blank lines) | — | Yes |
| **Image** ✅ | Image, alt text, caption; option: contained / full width | — | Yes |
| **Content feed** ☐ | Label; options: count, featured = newest | A content type | Once per page |
| **Record grid / list** ☐ | Label, intro; options: filters on/off, layout variant | A record type (optionally only "pinned" records) | Once per page |
| **Form** ☐ | Heading, intro, fields (from site config), success message, recipient (Settings) | — | Once per page |

The skeleton site (2026-11-25) ships the page hero plus Text and Image only; the rest arrive as their features are built.

**Not in the platform:** bespoke features such as the original build's Interactive section (uploaded HTML in an iframe) are site sections. If a site ever needs embedded HTML, serve the files from a separate media subdomain, never the site's own origin, so a file can't act with a signed-in editor's session.

**Form section** ☐: submits to a Worker endpoint that validates, rate-limits and emails the site's recipient via Resend (replaces the original build's open-an-email-draft form). Multi-step layouts are a section option.

### Ordering rules
- Sections and blocks reorder with ↑ / ↓ on the canvas; pinned parts have no arrows.
- Content within a section keeps its designed layout unless a section option enables reordering.
- Content feeds are by publish date; record lists follow their record type's ordering.

### Template behaviour
- **Once-per-page sections** leave that page's + menu once placed.
- **Pasted content respects the template:** disallowed content shows a short note rather than vanishing.
- **Template changes apply to existing content:** entries using a dropped block are flagged for review.

### Rule for building a new site or section
- **Template changes are proposed as a list for review before building.** Flag anything unsure — one-off text, placeholders, hard-coded content.
- Every new content type or page declares its **kind** (section 3) and **template**.
- Every new section declares which templates allow it, whether it repeats, its fields, its items, its options, its static editor layout (if scroll-driven) and its empty-state behaviour.

---

## 7. Content vs Design Decisions (platform defaults)
- **UI labels** ("Read article", filter labels, designed empty states) are design, not content.
- **Button labels in heroes and sections** are content.
- **Wordmarks and logos** are fixed brand assets (site config), not CMS content, unless a site declares otherwise.
- **Author** defaults to the site's default author (site config).
- **Featured entry** in a content feed is the newest, automatically.

---

## 8. Component Structure

The platform code stays where it grew (decided in Phase 4: moving it into a `platform/` folder would touch every import for no gain); the site's code lives in `src/site/`.

```text
src/
  data/                 ← platform: the only code touching D1 / R2 (section 2)
  components/           ← platform: Studio (admin/), public chrome, section renderers, UI kit
  lib/                  ← platform: page model, templates, menus, SEO, media, show-if …
    site-config.ts      ← the site config contract: types, defineSite(), validation
    site.ts             ← the platform's one way in to the site's config
  routes/               ← platform routes: root, /, /$slug, /admin…, /media, sitemap, robots, api
  styles.css            ← platform tokens (in @layer base) + Studio styles; imports the site theme
  site/                 ← this site only
    site.config.ts      ← section 9
    sections/           ← the site's designed sections (React components)
    routes/             ← the site's bespoke routes, if any
    theme.css           ← token overrides and the public `.site-*` styles
migrations/
  platform/             ← (site/ when a site first needs its own table)
```

- **Shared renderers:** the same section components render on the live site and the canvas. A site section's component receives `{ values, cms }`: each field's current value (live, or the draft in the canvas) and its CMS address for `data-cms` / `data-cms-image`.
- **Platform code never imports from `src/site/`**; it reads the site only through `@/lib/site`. ESLint (`no-restricted-imports`) enforces it; site files, `lib/site.ts` and tests are exempt. This is what lets a platform update ship to every site.
- **Routes from both folders** are mounted with TanStack virtual file routes (`vite.config.ts`: `rootRoute("routes/__root.tsx", [physical("", "routes"), physical("", "site/routes")])`), confirmed with TanStack Start 1.168. Site routes list their top-level addresses in `routes` in site config, so pages created in the Studio can't take them (a test checks every route file is listed).
- **Theme layering:** platform tokens sit in `@layer base`; `src/site/theme.css` is imported after them, so a site overrides any token with a plain `:root { … }` rule. The Studio's dark theme (`:root:has(.studio)`) is unaffected.
- **Editors are keyed by what they edit** (`<Editor key={id} />`).

---

## 9. Site Configuration ◐

Everything that varies per site is declared in `src/site/site.config.ts` with `defineSite()` (contract: `src/lib/site-config.ts`). Shared code reads it through `@/lib/site`; it never hard-codes site values.

**Built (Phase 4):**

```typescript
export default defineSite({
  name: "MCJames",                       // titles, structured data, the Studio
  url: "https://mcotesjames.com",        // https origin, no trailing slash: canonical links, sitemap
  brand: { wordmark: "MCJames" },        // text wordmark until the site has a logo file
  media: { maxDimension: 2400, quality: 0.82 },  // applied in the browser before upload
  menus: {
    footerColumns: 3, mainMax: 5,
    defaults: (settings) => ({ main: [...], footer: [...] }),  // until the Studio edits them
  },
  sections: {
    // key: { label, repeatable, fields: [{ name, label, multi?, image?, options? }],
    //        defaults: { field: value }, templates?: [templateKey], component }
  },
  templates: {
    // key: { label, description, hero: boolean, required: [type], sections: [type] }
  },
  routes: ["styleguide"],                // top-level addresses of src/site/routes
});
```

`defineSite()` checks the config when the code loads, so a bad config fails the build and the tests with a message naming the problem (`site.config.ts: …`): the address isn't a bare https origin; a section or template key isn't lowercase or reuses a platform key (`text`, `image`, `standard`); a section has a field called `type` or a default for a field it doesn't have, or names an unknown template; a template names an unknown section, requires one it doesn't offer, or offers none; a route isn't a bare slug; media quality is outside 0–1.

**Still to come** (added to the contract with the features that need them): `contentTypes` and `recordTypes` (Phase 6), `pages` (more built-in pages), `settings` fields, `seo` (title suffix, organisation), `auth` options, `studio.home`, logo files and fonts in `brand`.

**Field types:** today a section field is text, multi-line text (`multi`), an image (`image`) or a choice (`options`). Planned: `richText`, `file`, `link` (points at a target, as menus do), `multiSelect`, `date`, `number`, `boolean`, `reference` (to a record or entry), `list` (repeating group).

---

## 10. New Site Setup ☐

The setup script (`scripts/new-site`) does, in order:
1. Create the site repo from the platform repo and add the `platform` remote.
2. Create the D1 databases and R2 buckets for production and staging.
3. Write the site's Worker config with **those** binding IDs (never copied from another site).
4. Apply migrations (platform, then site).
5. Seed default settings and menus from site config (never accounts). Set `COLLABORATOR_EMAIL`; MCJames signs up and becomes the collaborator automatically, then approves the client's first admin.
6. Set secrets (Resend key, auth secret).
7. Deploy staging and production, then add the custom domain.

**Launch checklist:** no placeholder records live; no test entries live; every built-in page has its SEO defaults; form submits and emails; backup job has run once; sign-up mode confirmed; client admin can sign in.

**Offboarding:** export the database and media bucket, hand them over, then delete both and the Worker.

---

## 11. Content Safety — no content may be lost

Reverting code never restores the database, so every data change must be safe the first time.
- **Back up before any migration:** export the affected tables (and confirm D1 Time Travel is available) before changing schema or moving data.
- **Migrate existing content exactly as it is:** text, images, links and order copied verbatim — never retyped, summarised or regenerated. This applies to importing a client's old site too.
- **No deletions without explicit approval:** unused tables, columns and rows are hidden or no longer read, not dropped.
- **Keep the original** when content converts to a new format (`legacy_body`) until the conversion is confirmed.
- **Keep image references working** when uploads move.
- **Verify after every migration:** the live site shows the same content as before, with any differences reported.
- **Platform updates are migrations too:** a platform release that changes the schema is applied site by site, each with a backup and a check.

---

## 12. Working Process

### Repos
- **Platform repo:** everything outside `src/site/` (section 8), `migrations/platform/`, scripts, this spec, and a **test site** (a fixture `src/site/`: MCJames, a Callout section, a Landing template and a `/styleguide` route).
- **Each site:** its own repo, created from the platform repo, with the platform added as a second git remote (`platform`). It holds the platform plus its own `src/site/` and `migrations/site/`, deployed as its own Worker.
- A platform package is reconsidered only if the number of sites makes merging updates a burden.

### Platform vs site: the boundary
**The platform owns everything outside `src/site/` and `migrations/site/`. The site owns everything inside them. They meet only through `site.config.ts`.**

- **Content made in the Studio is never at risk from a code update.** Created pages, records, entries, menus and comments are rows in the site's own D1. Only a platform migration touches data, and it follows the content-safety rules (section 11).
- **Site code plugs in through extension points:**

| A site adds | Where | How the platform picks it up |
|---|---|---|
| A section type ✅ | `src/site/sections/` + `config.sections` | Merged into the section library, the + menu, the renderer and the side panel |
| A record type ☐ | `config.recordTypes` | List, form drawer, validation and record grid built from its field declarations (Phase 6, with records) |
| A page template ✅ | `config.templates` | Offered in + New page after Standard |
| A bespoke route or feature ✅ | `src/site/routes/` + `config.routes` | Mounted alongside platform routes (section 8); its address is reserved |
| Brand and theme ✅ | `config.brand` + `src/site/theme.css` | Wordmark in the header; tokens and `.site-*` styles override the platform's (section 8) |
| A site-only table (rare) | `migrations/site/` | Applied after platform migrations |

- **Never patch platform files in a site repo.** If a site needs the platform to behave differently, the change goes into the platform for every site, behind a config option if needed.
- **Default to the site.** Build a feature in `src/site/` first; promote it to the platform only when a second site needs it.

### Platform updates
1. **Build and test in the platform repo.** CI (`.github/workflows/ci.yml`, GitHub Actions on every push and pull request: type check, lint, tests, build; no deploys) builds the test site, which uses every extension point (a custom section, a template, a bespoke route, a theme; a record type once records exist). A change that would break a site's additions fails here first.
2. **Release:** tag a version (`v1.4.0`) with a changelog entry. A change to the config contract is a major version, with upgrade notes.
3. **Roll out per site:** merge the tag from the `platform` remote (only platform files change, so conflicts are rare), run the site's checks, back up and migrate staging, check staging, then production.
4. **Know who's behind:** each site records its platform version (`PLATFORM_VERSION`), so outdated sites are visible.

### Compatibility contract
A platform update is safe for every site only if it never breaks what sites build on. Modelled on how WordPress updates millions of sites: core is replaced wholesale, sites customise only through stable hooks, nothing is removed without years of warning, and database upgrades only add.

**What sites build on (the contract):**
- **`defineSite()`**: the config shape, section props (`{ values, cms }`), template shape, routes (section 9).
- **The public markup's hooks:** the `.site-*` class names the platform renders (header, nav, footer, hero, Text, Image) and the design tokens (`--background`, `--foreground`, `--primary`, `--page-gutter`, `--measure`, `--wide`, `--type-*`, `--weight-*`, `--font-*`). A site's `theme.css` styles these, and CSS failures are silent (no type check catches them), so renaming or removing one is a **breaking change**, exactly like a config change.
- **The content model:** field names in `section_data`, page row keys, menu link shapes. Content saved under them must keep showing.

**Rules:**
- **Never edit platform files in a site repo** (WordPress: never edit core). Site changes go in `src/site/`; anything else goes into the platform for every site. Enforced by the Phase 8 client-repo CI guard.
- **Add, don't change.** New config options are optional with a default; new classes and tokens are added beside old ones. Existing sites keep building unchanged.
- **Deprecate before removing.** A deprecated option, class or token keeps working and logs a warning in development (and in the build) for at least one minor release; it's removed only in a major version (`v2.0.0`) with upgrade notes. `defineSite()` then fails the site's build with a message saying what to change, never the live site.
- **Migrations expand, then contract.** A migration runs seconds before the new Worker goes live, so the old code briefly runs against the new schema: a release may only *add* tables and columns (and copy data into them). Renames and removals happen in a later release, once no deployed code reads the old shape, and follow content safety (section 11).
- **Field renames move the content:** renaming a section field, page key or menu shape ships with a migration that copies the values, never by changing the code alone.
- **Each site tests its own build against the update.** The platform's CI only proves the fixture site; merging a release into a site repo runs that site's checks, then its staging is looked at before production. Layout regressions are caught by eye on staging until screenshot comparisons exist (Phase 8).
- **A failure stays local.** One broken site section should hide itself (in the Studio: an error card) rather than take down the page (WordPress recovery mode) — Phase 8. Code rolls back instantly (Cloudflare keeps previous Worker versions); content only through D1 Time Travel, which also rewinds every edit since, so data changes must be right the first time.

**Pace:** unlike WordPress, which updates sites it can't see, each MCJames site is updated deliberately: merge, its own CI, its own staging, then production. Fewer sites, each one checked.

### Rules for every change
- Follow `AGENTS.md` (project-wide and per folder).
- **Content safety** (section 11) for anything touching data.
- **Checks before a change lands:** type checks, the test suite, a full build, and a browser click-through of the screens affected. Keep an explicit "not yet clicked through" list.
- **Record it:** update the affected sections of this file, add a change log entry (section 17), and an `AGENTS.md` note for any lasting technical decision, with its reason.
- **Never rewrite pushed history.**
- **Platform or site?** Before building, decide whether a change belongs to the platform (every site gets it) or one site's `site/` folder. Default: site, until a second site needs it.

### If a site is ever built with an AI builder (Lovable etc.)
Write the standing rules (content ownership, content safety, content kinds, templates-first) into the builder's project knowledge **before** building; rules given only in chat get forgotten.

---

## 13. Roadmap

✅ done · ◐ partly · ☐ to do

Each phase leaves a site that works end to end, so every step can be checked against the one before. *Rewritten 2026-11-25 after the skeleton cut: the order now gets a real deployment and real sign-in in place before features are rebuilt, and adds a decision on what the core ships with.*

### Phase 0 — Fork and tidy ✅
- ✅ Copy the original codebase into a **new** platform repo, cut off from the original project (its repo, Lovable project, Supabase database and Worker are never touched); remove its `.env`, Supabase and Lovable files, build output, migrations, name, logo, copy, people and addresses.
- ✅ Fix formatting and remove unused packages; an npm lockfile replaces the builder's private-mirror one. Remaining lint items are tracked under Phase 1.

### Phase 1 — Data layer on D1 + R2 ✅ *(merged with the original Phase 2)*
*The repo has no Supabase project (the only one it ever pointed at is the original client's live database), so the data layer went straight onto local D1 and R2.*
- ✅ Wrangler config with D1 and R2 bindings; local dev on a local D1 database and R2 bucket (`npm run db:reset` seeds `db/seed.sql`, fixtures only).
- ✅ Drizzle schema (section 2) with committed SQL migrations, including the generic `entries`, `records` and `list_items` tables (unused until Phase 6).
- ✅ `src/data/` with the access middlewares, and the test that fails if a server function bypasses them.
- ✅ Everything the skeleton uses runs on `src/data/` and was clicked through on local D1/R2: public pages and sitemap; sign-in placeholder, approval and users; page editing, sections, menus and publish; page creation and settings; media upload and library; comments.
- ✅ Browser-side image resize; stable R2 media paths (`/media/<key>`).
- ✅ Deleted the Supabase client and package.
- ✅ Test the built Worker under `wrangler dev` (the production bundle, not the Vite dev server): pages, sitemap, robots and media served from local D1/R2; the Studio closed (no dev sign-in in a build).
- ✅ Worker rendering with the edge cache, invalidated by a content version instead of purging (section 2 → Rendering); checked on the built Worker: hit, still a hit after a draft save, miss with the new content after a publish. `robots.txt` as a server route built from `SITE_URL`.
- ✅ Replaced the builder's Vite preset with a plain `vite.config.ts` (TanStack Start, React, Tailwind, tsconfig paths, LightningCSS; Nitro's `cloudflare-module` preset for builds).
- ✅ Lint clean: no errors or warnings (shadcn `ui/` files exempt from the Fast Refresh rule by design).

### Phase 2 — First deployment ✅
Proves the stack on Cloudflare itself before anything else is built on it. Done by hand; staging now deploys from GitHub Actions (section 2 → Environments and content flow).
- ✅ Staging D1 database `cms-core-staging` (Western Europe) and R2 bucket `cms-core-staging-media` created in the MCJames account; the database ID is in `wrangler.jsonc`. R2 had to be enabled once in the dashboard (it needs a payment method on file, even within the free allowance).
- ✅ Migrations applied and fixture content seeded on staging.
- ✅ Staging Worker `cms-core-staging` deployed: https://cms-core-staging.mcotesjames.workers.dev. Checked: pages render from the staging database, sitemap and robots served, edge cache MISS → HIT in Cloudflare's network, no console errors.
- ✅ Staging is never indexed: `SITE_ENV` (a Worker variable) is `staging`, so `robots.txt` disallows everything and every response carries `X-Robots-Tag: noindex, nofollow`; only `SITE_ENV=production` lets search engines in.
- ✅ The Studio is closed on staging (no sign-in until Phase 3).
- ✅ Local development keeps its own database: `preview_database_id: "local-dev"` in `wrangler.jsonc` separates it from staging's ID.

### Phase 3 — Auth ✅
Nothing deployed can be edited until this exists.
- ✅ Better Auth sign-in with email + password (decision 1), on D1 (section 2 → Auth); rate limits per IP on sign-in, sign-up and password change. Per-email limits come with email codes.
- ✅ Roles in use: approved as editor or admin; admins change roles, remove access (signing the person out) and set temporary passwords; the collaborator and your own account can't be changed. Users is admin-only (sidebar and server).
- ✅ Your account: change your own name and password.
- ✅ The collaborator (MCJames) approved automatically when signing up with the site's `COLLABORATOR_EMAIL` while the site has none; `npm run user:collaborator` hands the role over; `SIGNUP_OPEN=false` for invite-only sites. *The client's first admin: they sign up and the collaborator approves them as admin.*
- ✅ The dev sign-in shortcuts kept for local development only (separate seed, compiled out of builds).
- ✅ Staging: migrated, the seeded test accounts removed, `BETTER_AUTH_SECRET` set, deployed; sign-in endpoints checked on Cloudflare.
- ☐ Email codes and password-reset emails, once Resend is set up (decision 1: email + password now; codes later).

### Phase 4 — Split platform and site ✅
- ✅ The original build's features replaced by a plain skeleton site: homepage, pinned hero, Text and Image sections, plain header and footer (2026-11-25).
- ✅ Site code in `src/site/`; platform code stays in place (section 8). `site.config.ts`, `defineSite()` with validation, and the extension points (section 12): sections, templates, routes, theme, brand, media and menu settings.
- ✅ TanStack virtual file routes mount `routes/` and `site/routes/` (confirmed with Start 1.168).
- ✅ Lint rule: platform code never imports from `src/site/` (only through `@/lib/site`).
- ✅ The fixture test site uses the extension points (Callout section, Landing template, `/styleguide` route, theme file); GitHub Actions CI type-checks, lints, tests and builds it.
- ☐ Record types as an extension point: moved to Phase 6, with records.

### Phase 5 — Core scope: what the platform ships with ✅ *(2026-11-25)*
A decision phase, no code. **The platform ships features, not content:** no predefined sections, record types or content types. Each site declares its own (sections, records, content types, forms, settings groups) in `site.config.ts`, and the platform provides the machinery that makes any of them work. Signed off feature by feature; the outcome is section 14 → Made → *Core scope* and is built in Phase 6.

**Already in the platform:** pages (hero + sections, templates) · drafts and Publish · menus · settings · media library · SEO · users and roles · feedback comments · environments and deploys.

**Core, built in Phase 6:** field types · content types · records · repeating items in sections · forms · redirects · configurable Global settings (details in section 14 → Made → Core scope).

**Core, later (Phases 8–9):** Changes screen (everything unpublished, Publish all) · preview links · version history · scheduled publishing · email notifications · analytics dashboard · backups and content sync · reusable sections · form builder · form file uploads · records CSV import/export · drag-to-reorder · client-changeable Studio colours.

**Not in the platform:** a visual content-type builder · site search (site-level when needed) · e-commerce, memberships, payments · complex redirect patterns (regular expressions) · WordPress import as a feature (a one-off script per launch, Phase 7) · **multilingual in v1** (adding it later means a schema change and migration across every site, accepted knowingly).

### Phase 6 — Core features ☐
Builds the core signed off in Phase 5 (section 14 → Made → Core scope), each declared per site through `site.config.ts`; the fixture site uses every one so CI proves them.
- ☐ **Field types:** text, long text, rich text (fixed toolbar, structured data), image, file, link, choice / multiple choice (fixed or Studio-editable option lists), date, number, yes/no, reference, repeating group; label, help, required, default; validation on screen and server from the declaration. Option-list screens in the Studio.
- ☐ **Content types:** `contentTypes` in site config; list, visual entry editor (blocks: rich text, image, quote, video, gallery, divider; body typed on the page with a floating toolbar), Settings screen; detail and archive routes, Content feed section, RSS, sitemap, SEO. The original build's article editor (git history, commit `5b54fbe`) is the starting point.
- ☐ **Records:** `recordTypes` in site config (name, fields, title field, ordering); list, form drawer with preview card, drafts + Publish, comments; record list section; reference fields; delete warns where used.
- ☐ **Repeating items in sections:** a section's repeating group edited on the canvas (add, reorder, delete, min/max), with the page's draft.
- ☐ **Forms:** forms in site config, Form section, Turnstile + honeypot + rate limit, saved then emailed via Resend, optional auto-reply, Submissions inbox (read, handled, delete, CSV export, auto-delete after 12 months by default).
- ☐ **Redirects:** Settings → Redirects (admins and editors), 301/302, simple `*` wildcards, hit counts, loop checks, ask-first redirect on address changes (rules collapse), not-found log with one-click redirects, paste/CSV import.
- ☐ **Global settings:** rename Site settings → Global settings, tabs per group; platform groups (SEO & sharing, forms, contact email, logo + favicon, announcement banner) plus groups declared per site; draft + Publish like everything else.
- ☐ **Media:** drop files onto the Media screen to upload in bulk.
- ☐ Reference handling everywhere: links and cards to entries and records hide when the target is unpublished or deleted.
- ☐ Paste from Google Docs (and Word, Substack) into rich text; legacy Markdown/HTML conversion for imported content.

### Phase 7 — Portfolio (site #1) ☐
- ☐ `site.config.ts` and designed sections for mcotesjames.com (section 15), using the core features it needs.
- ☐ Migrate current content verbatim from the WordPress site; redirects from old addresses.
- ☐ Build the content on staging (client preview), then launch: create the production D1, R2 and Worker (`SITE_ENV=production`), copy the content up with `content:launch` (section 2 → Environments and content flow), and point the custom domain at the production Worker.
- ☐ Track hours per module (to inform per-site pricing).

### Phase 8 — Setup and operations ☐
- ☐ New-site script (section 10), platform update script (merge tag, migrate staging, check), launch checklist, offboarding export.
- ☐ `npm run platform:update -- <tag>`: merges the platform tag, then restores the site's own `src/site/` and `migrations/site/` (`git restore --source=HEAD --staged --worktree`), so the platform repo's fixture site never overwrites a client's site.
- ☐ Client-repo CI guard: fails any change outside `src/site/` and `migrations/site/` unless it's a platform merge; each site records its `PLATFORM_VERSION`.
- ☐ Section field renames are content changes: a backup and a script that copies values to the new field names (removed sections and templates already fall back safely).
- ☐ Deprecation warnings: `defineSite()` and a stylesheet check warn when a site uses a deprecated option, `.site-*` class or token (section 12 → Compatibility contract).
- ☐ Section error boundary: a site section that throws hides itself on the live site and shows an error card in the Studio, instead of breaking the page.
- ☐ Screenshot comparisons on staging after a platform merge (key pages, desktop and mobile), so silent style breaks are seen before production.
- ☐ Production deploys: from a tag or a manual run behind a GitHub `production` environment that needs MCJames's approval, with a database export before any migration.
- ☐ Deploy tokens scoped per site (only that site's Worker, D1 and R2), never one token that can reach every client; depends on decision 8.
- ☐ Once clients review on staging: changes reach `main` through pull requests (checks must pass) rather than direct pushes.
- ☐ Content sync tools (section 2 → Environments and content flow): `content:launch` (staging → production, once; needed first in Phase 7) and `content:pull` (production → staging or local). Content and media only, never users, sessions or (by default) comments; always back up the target first.
- ☐ Cron jobs: daily database backup to the MCJames backup bucket; resolved-comment clean-up.
- ☐ Analytics dashboard in the Studio (visits, top pages, referrers, countries, devices; cookieless).
- ☐ Email notifications via Resend: comments for you, accounts awaiting approval, password resets and email sign-in codes.
- ☐ Error monitoring for deployed Workers.

### Phase 9 — Editor polish and later ☐
- ☐ Changes screen: everything unpublished across the site (pages, entries, records, menus, Global settings) with Publish all and Discard per item.
- ☐ Secret preview links for drafts.
- ☐ Version history: see and restore earlier published versions of a page, entry or record.
- ☐ Scheduled publishing.
- ☐ Reusable sections: one block used on many pages, edited once.
- ☐ Form builder in the Studio (to discuss first); file uploads in forms.
- ☐ Records CSV import and export.
- ☐ Drag and drop: blocks, sections and items on the canvas; reordering in record lists.
- ☐ Client-changeable Studio colours.
- ☐ No layout shift when the panel opens or closes.

### Feature inventory
**In the code now:** shared editor shell (StudioShell) · in-place text · hover outline and ↑ / ↓ / + bar · click to select · panel for the selected thing only · two-level selection colours and flash · draft / Publish / Discard · flexible pages from a section library (Text, Image) · page templates (Standard) · new pages, duplicate any page · editable menus · empty content hidden · feedback comments with exact-spot pins, Alt-click and the Feedback list · page switcher with dots and Cmd/Ctrl+K · shared SEO builder and Settings screens · Studio dark theme · media library on R2 · sign-in placeholder, approval and users.

**Built in the original build, removed in the skeleton, restorable from git history** (last present in commit `5b54fbe`): entry (article) editor with block catalogue, Google Docs paste and legacy conversion · records list with form drawer and tick-box multi-value fields · list items on the canvas with drafts and drill-down · click-to-place positioned items · Interactive section and template (a site feature).

Still unchecked in the browser, for when entries return: replacing an image; adding an entry block with **+**.

---

## 14. Decisions

### Made (platform)
- **Editing model:** one canvas-first visual editor for entries and pages, identical everywhere.
- **Canvas controls:** hover → dashed outline + ↑ / ↓ / + bar; click → solid outline. Deleting from the side panel.
- **Side panel:** only the selected thing's fields, one-column drill-down.
- **Content kinds:** Content, Records, Pages, Settings; no bespoke screens.
- **Lists:** Edit (visual) + Settings (form, saves live) for pages and entries alike.
- **Flexible pages:** pinned hero + sections; any allowed section on any page; text sections repeat; list-fed sections once per page; pages use sections, not entry blocks.
- **Page templates:** rule sets over one section system; switching clears sections with a warning; draft/Discard is the undo.
- **Menus:** on the canvas; links point at targets; no sub-menus in v1.
- **Empty content:** hidden on the live site at every level; placeholder in the editor.
- **Feedback comments:** comment mode, exact-spot pins, required "For", in-app + email notifications, 30-day clean-up of resolved threads.
- **Accounts:** names required; approval before access; sign-up can be turned off per site.
- **SEO:** one shared builder, automatic fallbacks, edited on Settings screens only.
- **Devices:** desktop-only editing; tablet and mobile via the toggle.
- **Drag and drop:** files can be dropped onto the Media screen (Phase 6); never onto canvas elements (images are placed by click or pick). Reordering by drag is Phase 9; ↑ / ↓ until then.
- **Core scope (Phase 5, 2026-11-25):** the platform ships **features, not content**: no predefined sections, record types or content types; each site declares its own in `site.config.ts`, and structure stays in code (no visual content-type builder: designs depend on field names, a schema stored in the database would drift between environments, and field changes need content migrations).
  - **Field types:** text, long text, rich text (fixed toolbar: bold, italic, link, bulleted/numbered lists, H2/H3; stored as structured data, never raw HTML), image (alt text required unless decorative), file, link (the menus' picker: page, section, entry, URL, email), choice / multiple choice, date (optional time), number, yes/no, reference (one or many records or entries; hidden when the target is unpublished or deleted), repeating group. Every field: label, help text, required/optional, default, validation on screen and server generated from the declaration. A choice field is either **fixed** (in code: design choices such as contained / full width) or an **editable option list** (managed in the Studio: categories, tags, services). Not offered: colour pickers, HTML/code fields, per-field styling.
  - **Content types:** entries with their own page. Declared per site: names, address, template (Article by default; sites add their own), extra fields, categories/tags, archive on/off. Built-in fields: title, web address, summary, featured image, publish date, author, SEO, draft/published. Studio: list, visual editor with blocks (rich text, image, quote, video, gallery, divider), Settings screen, a "Content" sidebar group. Site: detail page, paginated archive with category filters, Content feed section, RSS, sitemap, SEO. Body text is typed on the page with a floating toolbar; author is a plain name, or a pick from a people record type when the site has one. Not in v1: visitor comments, approval workflows.
  - **Records:** structured, reusable data without its own page. A record type needs only a name, its fields, a title field and an ordering (manual or by a field); "featured" and "category" are ordinary fields. Studio: list, form drawer with a preview card, drafts + Publish, comments, a "Records" sidebar group. Site: a record list section (all or filtered by any yes/no or choice field, count, optional visitor filters; design per site) and reference fields. Deleting warns and lists where a record is used.
  - **Repeating items in sections:** a section's repeating group (cards, steps, FAQs, stats) edited on the canvas: text in place, other fields in the panel, add / reorder / delete, optional min and max, saved with the page's draft. Items live in one section on one page; when needed on a second page they become a record type. No nesting.
  - **Forms:** declared per site (fields, required, optional steps); clients edit the wording around the form; recipients and auto-reply in Global settings. Submissions are validated on the server, protected by Turnstile, a honeypot and a rate limit, saved first and then emailed via Resend. Submissions inbox: read, mark handled, delete, CSV export, deleted automatically after 12 months by default. Fields stay in code in v1; a Studio form builder is to be discussed later.
  - **Redirects:** Settings → Redirects, for admins and editors: from path → page, entry or address; 301 by default, 302 optional; simple `*` wildcards (optionally carried into the target; exact rules win); hit counts and last used; loops blocked. Changing an address asks whether to add a redirect (yes by default), and rules collapse instead of chaining. A not-found log (address and count only) offers one-click redirects. Launch import by paste or CSV, checked before saving. Whole-domain redirects stay at Cloudflare.
  - **Global settings** (renamed from Site settings; Users, Redirects and Your account stay in the Settings group): tabs per group; platform groups on every site (SEO & sharing, forms, contact email, logo + favicon, announcement banner with optional dates) plus groups each site declares; the same draft + Publish as all content; editable by anyone; empty settings hidden. Colours and fonts stay in code.
  - **Publish scope:** Publish puts live what's being edited (a page plus the shared menus and Global settings drafts made alongside it); other pages' drafts are untouched.
- **Multilingual:** not in v1 (decided 2026-11-25); adding it later needs a schema change and migration across every site.
- **Infrastructure:** Cloudflare Worker + D1 + R2 per site (plus staging), on one MCJames account; data layer as the only database access; Resend for email.
- **Rendering:** public pages render on the Worker and are edge-cached, keyed by build and content version (section 2 → Rendering), so Publish and deploys are live everywhere without purging. No pre-rendering, rebuilds or deploy hooks.
- **Access checks:** every server function starts with one access middleware (`asVisitor`, `asEditor`, `asAdmin`, `asCollaborator`); denied by default, enforced by a test.
- **Auth library:** Better Auth on D1. **Schema and migrations:** Drizzle.
- **Sign-in method (2026-11-25):** email + password now, hashed with PBKDF2 in the Worker; email codes and password-reset emails added once Resend is set up. Until then admins set temporary passwords.
- **Media:** images resized in the browser before upload; stable R2 paths.
- **Interactive embeds:** not in the platform; a site feature.
- **Environments:** local to experiment, staging to preview features to the client, production for the public; each with its own database and bucket. Code goes up, content comes down; content goes up only once, at launch (`content:launch`). Content copies never include users, sessions or (by default) comments.
- **Repo model:** one repo per site, created from the platform repo, pulling releases from a `platform` git remote. Site code only in `src/site/` and `migrations/site/`; the config is the only contract.
- **Multi-value fields:** JSON arrays in the platform (the original build's joined strings are not carried over).

### Open
1. ~~Sign-in method~~ — decided (see Made).
2. ~~Body text editing~~ — decided: typed on the page with a floating toolbar (Made → Core scope).
3. ~~Image drop~~ — decided: not onto canvas elements; bulk drop onto the Media screen (Made → Drag and drop).
4. **Long-distance moves:** repeated ↑ to move a block far up a long entry or page. Acceptable until drag and drop (Phase 9)?
5. ~~Repo model~~ — decided (see Made).
6. ~~Draft previews before publish~~ — decided: secret preview links in Phase 9.
7. ~~Core scope~~ — decided in Phase 5 (Made → Core scope).
8. **Cloudflare account per client, or one for all?** One MCJames account is simplest (one bill, re-charged in the hosting fee; sites still isolated by their own Worker, D1 and R2) but every site shares the account's free allowances; one account per client gives each its own allowance and makes hand-over clean, at the cost of more admin. A deploy token for one account can reach every site in it, so a single account needs tokens scoped to each site's own resources (Phase 8). Either way, real client sites need **Workers Paid** (about $5/month per account): the free plan's ~10 ms CPU per request and 100,000 requests/day across the account won't carry server-rendered client sites. Decide before the Phase 8 new-site script.

---

## 15. Site Appendix: mcotesjames.com (site #1) ☐

*First-pass mapping of the current WordPress portfolio (single page: Hero, About, Selected Work, Current Stack, Contact). To confirm before building (section 6 → template changes proposed as a list).*

| Current part | Kind | Proposed |
|---|---|---|
| Hero (name, role title, location, "Available for work", background portrait) | Page hero (pinned) | Fields: name, role title, location, availability label (empty = hidden), portrait |
| About (intro paragraph) | Section | Platform **Text** |
| Selected Work (6 case studies, paginated carousel) | Record type + section | Record type **Project**: name, short description, services (multi-select), stack (multi-select), images, link, pinned flag, ordering manual. Site section **Selected work** (carousel), fed by Projects. |
| Current Stack (logos grouped by type) | Section with list items | Site section **Stack**: list items with name, logo, group (Languages / Frameworks / CMS / Tools). Promote to a record type only if it appears on a second page. |
| Contact (multi-step form, email, LinkedIn) | Section + Settings | Platform **Form** section (multi-step option); email and LinkedIn in Settings |
| Footer | Site-wide | Footer text + footer menu |

- **Content types:** none at launch. If projects later get their own pages, add a **Case study** content type and link each Project record to it.
- **Built-in pages:** Homepage only (Standard). New pages can be created in the Studio.
- **Settings:** contact email, LinkedIn URL, form recipient, availability default.
- **SEO:** suffix " — MCJames"; Organization / Person structured data on the homepage.
- **Migration:** all six case studies on the live site and all page text copied verbatim from the live WordPress site; images moved into R2.

---

## 16. Lessons (carried from the original build)

### Process
- **Snapshot before moving a project between accounts:** the live database structure, every row, a tested restore, and an offline copy of the code. Test the restore, not just the export.
- **Test switching between editors without a full reload,** not just opening each one fresh.
- **Write standing rules down before building** (this file, `AGENTS.md`, or an AI builder's project knowledge).
- **Ask for template proposals as a list before building.** It surfaces hard-coded text, placeholders and unused data early.
- **Back up before the first migration, not after.**
- **Treat CSS hooks as an API.** A site's theme styles the platform's class names and tokens; renaming one breaks every site silently, with every check still passing.
- **Expect "built but not clicked through".** Keep an explicit untested list and check it.

### CMS design
- **One way to manage every kind of content:** a list with Edit (visual) and Settings (form, saves live).
- **Let built-in pages be duplicated like any other,** converting fixed sections on copy; keep risky actions (address change, delete) off built-in pages.
- **Keep option lists in one place** that both the Studio and the public site read.
- **Give each selection level its own outline colour,** kept as tokens.
- **Model every page as a pinned hero plus sections from day one.**
- **Make page layouts templates, not separate renderers.**
- **A + button needs something to add:** keep at least one repeatable section type in every template.
- **Introduce new structures without moving content:** let the new model read existing fields and fall back to the old layout.
- **One editor for every page type.**
- **Controls on the canvas, fields in the panel.**
- **Keep editorial content apart from reusable records.**
- **Draft/live on everything,** including records and nested lists.
- **Move all visitor-facing text into the CMS early,** including button labels and site-wide text.
- **Menus as canvas blocks, links pointing at targets, defaults that reproduce the hard-coded menus.**
- **Hide empty content by default with one shared helper;** show placeholders in the editor.
- **Feedback lives on the canvas, pinned to the editor's own element addresses;** separate comment mode; required owner.
- **Pin comments to the exact spot** (path + fractional point), with Alt-click to interact.
- **Collect names at sign-up and gate accounts behind approval.**
- **Let editors jump straight to other editors** (page switcher, dots, Cmd/Ctrl+K, context in the URL).
- **Build SEO as one shared builder with automatic fallbacks from day one.**
- **Put page-level settings behind the panel's empty state** (a link to Settings).
- **Let editors create standard pages themselves;** keep development for new layouts.

### Technical gotchas
- **Scope global element styles to the public site** (`body h1 { … }` outranks utilities and leaks into the Studio).
- **Give each field exactly one writer;** when two screens touch the same row, the non-owner preserves the other's fields.
- **Never inset an outline by more than half the element's smallest side.** Inset only elements that fill their container.
- **Draw selection effects as a separate fixed overlay,** never by styling the element.
- **Design panel editors as one column (drill-down)** from the start.
- **Re-apply selection whenever the canvas re-renders** (DOM observer), not just when the message arrives.
- **Normalise third-party / AI-exported HTML before `srcdoc`.**
- **Prefer an auto-height frame for interactives;** measure from the root element's box, and redirect the file's own scrolling to the page.
- **Don't put a live iframe on the editor canvas;** show a placeholder.
- **Scroll-driven sections can't be edited in place;** give them a static editor layout.
- **Give the Studio its own scoped theme.**
- **Decide the media strategy up front:** expiring signed links are a trap (the platform uses stable R2 paths).
- **Don't let whoever signs up first take over a new site;** bind automatic access to the developer's own email (`COLLABORATOR_EMAIL`), and only while the site has no collaborator.
- **Section links need stable id-based anchors** (`section-<id>`).
- **Draw canvas overlays outside `<body>`** when a MutationObserver watches the body.
- **Overlays that track page state** must also watch state attributes (`data-open`, `aria-hidden`, `aria-expanded`) and `transitionend`.
- **Key editors by what they edit.**
- **Don't fire one-off messages at a loading iframe:** re-send until confirmed; the frame ignores repeats. Turn off smooth-scroll libraries in canvases.
- **Update overlay elements in place;** never let an overlay's own transitions trigger its redraw.
- **A focused in-place editor reports its text only if the user typed in it.**
- **Re-apply drafts after background refetches** in a preview canvas.
- **Draw editing canvases in the browser only** (`ssr: "data-only"` for `?studio=1`).
- **Never put a button inside a `<label>`.**
- **Never index config objects by a string key directly** under `noUncheckedIndexedAccess`; go through a lookup that falls back (`sectionDef`, `templateDef`), so content saved under a section or template the site later drops still renders and edits.
- **After changing `vite.config.ts` routing, expect one broken load** while Vite re-optimises dependencies (`504 Outdated Optimize Dep`, an empty Studio); reload before debugging.
- **Key cached HTML by the build as well as the content.** HTML names its CSS and JS by content hash; after a deploy, HTML cached by the previous build points at files that no longer exist and the site loses its styles until content changes (it happened on staging with the first restyle deploy).
- **Keep one copy of zod.** Better Auth needs zod 4; with the project on zod 3 the production bundle resolved Better Auth's imports to zod 3 and every auth request failed (`.loose is not a function`), while `vite dev` worked. Test auth on the built Worker, not just the dev server.
- **A built Worker reads `.dev.vars` from beside its config** (`.output/server/`), not the project root; copy it there for `wrangler dev` tests of a build.
- **The workers.dev address follows the account's subdomain**, which can change (it did when R2 was enabled); use the address `wrangler deploy` prints.
- *Supabase / Lovable only, kept for reference:* column-level SELECT breaks Postgres upserts; Lovable lockfiles point at a private package mirror.

---

## 17. Change Log

Newest first. Each entry: date, what changed, how, and any follow-ups.

- **2026-11-25 · Phase 5: core scope · Claude** — Docs only. Reframed from "which sections and records ship with every site" to "which platform features ship": the platform ships features, not content, and each site declares its own sections, records, content types, forms and settings. Signed off one by one: field types (incl. fixed vs Studio-editable option lists; structure stays in code), content types, records (only name, fields, title field, ordering), repeating items in sections, forms (fields in code; a form builder to discuss later), redirects (admins and editors, ask-first on address changes, not-found log, wildcards), Global settings (renamed, tabs, logo/favicon and announcement banner, draft + Publish throughout). Later list (Phases 8–9) and not-in-platform list agreed; multilingual out of v1. Open decisions 2, 3, 6 and 7 closed. Phase 6 rewritten to build the seven features; Phases 8 and 9 extended. Two stale Made entries corrected (rendering uses version keys, not purges; access middleware names).

- **2026-11-25 · Edge cache keyed by build · Claude** — Fix: after the Studio restyle deployed, staging kept serving cached pages from the previous build, whose CSS and JS files the deploy had removed (`/assets/styles-….css` → 404), because pages were keyed only by path and content version. Pages are now also keyed by a build id (`__BUILD_ID__` via Vite `define`: `GITHUB_SHA` in CI, a fresh value for local builds); `x-edge-cache` shows `HIT|MISS <build> <version>`. Test added (96 tests). Checked on a local Worker with two builds sharing one cache: the second build missed, rendered fresh, then hit.

- **2026-11-25 · Studio restyle ("Panelled") · Claude** — Cosmetic only; no behaviour or data changes. The Studio's dark theme is replaced by the "Panelled" system from `design.md`: `--st-*` tokens under `:root:has(.studio)` (warm grey canvas, white cards, line colours, text greys, primary, blue accent, status colours, shadows for floating layers only, durations and one ease-out curve), mapped onto the shared tokens. Inter (self-hosted, Studio only) at 14/20. App shell: sidebar on the canvas with Lucide icons, group captions and a white-lift active item; each screen's content on one white card with a title and summary line. Pages list: 48px rows, whole row opens the editor, Settings / Duplicate / Delete in a `…` menu. Buttons (primary / secondary / ghost / danger), 40px fields with an inset fill and accent focus halo, status badges with dots (`live`, `changes`, `draft`), dialogs, popovers, selects and toasts (dark, bottom-centre) restyled. Editor: 52px top bar on the canvas (ghost Back, page switcher with chevron, dot-and-word status, save state, icon segmented device control, ghost Comment and Hide panel, secondary Discard, primary Publish), the page on a white sheet, the side panel as a card (stacked under the sheet on narrow screens). Canvas selection colours now blue (sections) / cyan-blue (elements) / purple (comments); 22px round comment pins; the ↑/↓/+ bar a dark rounded toolbar. Small Tailwind text sizes pinned to 14px / 12px inside the Studio (the project's `text-sm` is 16px for the public site). The public site is untouched. Checked in the browser: Pages and its menu, editor (selection, panel), page settings, Users, Site settings, sign-in, phone width.

- **2026-11-25 · Compatibility contract · Claude** — Docs only. Section 12 gains a Compatibility contract (modelled on WordPress's core updates): what sites build on (`defineSite()`, the `.site-*` classes and design tokens, the content model's field names), and the rules for changing it — never edit platform files in a site repo, add rather than change, deprecate for at least a minor release before removing in a major, expand-then-contract migrations, field renames move content, each site tests its own build and staging, failures stay local. Phase 8 gains deprecation warnings, a section error boundary, staging screenshot comparisons, approved production deploys with a backup, per-site deploy tokens and pull requests once clients review on staging. Decision 8 notes token scope; a lesson on CSS hooks.

- **2026-11-25 · Staging deploys from GitHub · Claude** — The CI workflow gains a `deploy-staging` job: on a push to `main` (or a manual run) whose checks pass, it notes the D1 Time Travel restore point, applies staging migrations and deploys the Worker built by the check job (passed on as an artifact, so what deploys is what was tested). Deploys queue rather than cancel; pull request runs never deploy. Cloudflare API token and account ID are GitHub repo secrets; Worker secrets stay on Cloudflare. Production deploys stay manual until Phase 7 (tag or button, approval required). Follow-up: the first run also brings Phase 4 to staging.

- **2026-11-25 · Phase 4: platform and site split · Claude** — Site code now lives in `src/site/` (config, sections, routes, theme); platform code stays where it is (section 8). New contract `src/lib/site-config.ts` (`defineSite()` validates at load, so at build and in tests) and gateway `src/lib/site.ts`; an ESLint rule stops platform code importing `src/site/` directly. Values that came from constants now come from config: site name and address (SEO), wordmark, image resize settings, footer column and main-menu limits, default menus, reserved page addresses. Section types and templates are open strings: site sections render through their own component (`{ values, cms }`) and appear in the + menu and side panel; site templates add `{ hero, required, sections }`; unknown ones fall back safely (`sectionDef`, `templateDef`). Virtual file routes mount `src/site/routes` beside `src/routes`. Platform tokens moved into `@layer base`; the public `.site-*` styles moved to `src/site/theme.css`. Fixture site: Callout section, Landing template (no hero, required Callout), `/styleguide` route (noindex). GitHub Actions CI (type check, lint, tests, build; read-only, no deploys). 95 tests (new: config validation, Landing template, route reservation). Clicked through locally: homepage and `/styleguide`; a Landing page created from + New page (no hero, Callout present without Delete, + menu offers Text, Image and Callout; an added Callout has its fields and Delete). Follow-ups: record types with records (Phase 6); staging not yet redeployed with this code.

- **2026-11-25 · Collaborator role and automatic access · Claude** — The top Studio role is renamed from `owner` to `collaborator` (migration `0002`, data only; `asOwner` → `asCollaborator`, `user:owner` → `user:collaborator`, dev account `dev-collaborator`). The first sign-up whose email matches the site's `COLLABORATOR_EMAIL` (a Worker secret; `.dev.vars` locally) is approved as collaborator automatically, but only while the site has no collaborator; everyone else still waits for approval. Better Auth `databaseHooks.user.create.after`. Checked locally: a non-matching sign-up stays pending, the matching one becomes collaborator. Staging migrated (your account is now collaborator), secret set, deployed. The lesson on first-sign-up access now describes the email-bound version.

- **2026-11-25 · Phase 3: sign-in · Claude** — Better Auth 1.7.20 on D1 with email + password (decision 1): migration `0001_auth` adds sessions, accounts, verifications and rate limits and rebuilds `users` for Better Auth (hand-edited to convert existing dates and to use D1's `defer_foreign_keys`). PBKDF2-SHA256 password hashing via Web Crypto; rate limits in D1; `/api/auth/*` route (never cached); sessions joined to `users` for roles in the access middleware. Studio: real sign-in and sign-up, Users with approve-as-editor/admin, role changes, remove access and temporary passwords (admin-only), Your account (name, password), sidebar shows Users to admins only. `npm run user:owner`. Seed split: content (`db/seed.sql`, every environment) and local-only shortcut accounts (`db/seed.dev-users.sql`). Project moved to zod 4 (one copy; zod 3 broke Better Auth in the production bundle). Staging migrated, test accounts removed, secret set, deployed at its new address https://cms-core-staging.mcotesjames.workers.dev (the account subdomain changed). Checked locally (sign-up → pending, approval, password sign-in, editor limits, rate limit, password change) and on the built Worker; staging endpoints respond. 84 tests. Follow-ups: email codes and reset emails with Resend; CPU time of password hashing on the free Workers plan (decision 8).

- **2026-11-25 · Environments and content flow · Claude** — Docs only. Section 2 now defines the three environments (local to experiment, staging to preview features to the client, production for the public), the rule "code goes up, content comes down" with launch as the one upward content copy, what a content copy includes and excludes (never users, sessions or, by default, comments), and two sync tools: `content:launch` (staging → empty production, once, with a backup) and `content:pull` (production → staging or local). Added to Phase 7 (launch steps) and Phase 8 (the tools); recorded under Decisions → Made.

- **2026-11-25 · Phase 2: first deployment · Claude** — Staging is live at https://cms-core-staging.mcotesjames.workers.dev: D1 `cms-core-staging` (migrated, fixture seed), R2 `cms-core-staging-media` (R2 enabled in the dashboard), Worker `cms-core-staging` deployed from the build with `wrangler deploy --config .output/server/wrangler.json`. Added `SITE_ENV` (anything but `production` → `robots.txt` blocks everything and every response is `X-Robots-Tag: noindex, nofollow`). Local development keeps its own database (`preview_database_id: "local-dev"`); the existing local data was copied across. Checked on Cloudflare: pages from the staging database, sitemap, robots, edge cache MISS → HIT, Studio closed. New open decision 8 (one Cloudflare account or one per client; Workers Paid for real client sites). Follow-ups: staging has no media yet (uploads need sign-in, Phase 3); the deploy is manual until the Phase 8 scripts.

- **2026-11-25 · Phase 1 finished · Claude** — Replaced the Lovable Vite preset with a plain `vite.config.ts` (and removed the package). Tested the built Worker under `wrangler dev`: pages, sitemap, robots and media from local D1/R2, Studio closed. Added the edge cache (`src/data/cache.server.ts`, wired in `src/server.ts`): public pages keyed by a content version (`site_content.updated_at`, now written only when live content changes), media by address, Studio / server functions / canvas never cached, browsers always revalidate pages; verified hit → still a hit after a draft save → miss with new content after a publish. The spec's purge-on-publish plan changed to version keys, because the Cache API is per data centre (section 2 → Rendering). `robots.txt` is a server route from `SITE_URL`. Lint clean: the remaining `any` types typed through the page model's `Doc`, hook dependencies made explicit, Studio helpers (`meQuery`, `useSignOut`, `adminHead`) moved from `AdminGate.tsx` to `adminUser.ts`. 79 tests (5 new: cacheable requests, robots). Follow-ups: lazy images take no space until loaded (store image dimensions with Image sections); a real deployment is Phase 2.

- **2026-11-25 · Roadmap rewritten · Claude** — Docs only. New order: finish Phase 1 (built-Worker test, edge cache, plain Vite config, lint) → Phase 2 First deployment (staging by hand, reusing the merged phase's number) → Phase 3 Auth → Phase 4 platform/site split → **Phase 5 Core scope** (a decision phase: which content types, record types, sections and Studio features ship with every site, with a candidate list and criteria; pages alone aren't enough) → Phase 6 Core features (rebuilding entries, records and list items on the platform, with the original build's code in commit `5b54fbe` as the starting point) → Phase 7 Portfolio → Phase 8 Setup and operations (now including backups, error monitoring and the analytics dashboard) → Phase 9 Editor polish and drag and drop. Stale items from the skeleton cut removed (record and article gaps, the shader motion item, the already-deleted error-reporting hook); the feature inventory now separates what's in the code from what's restorable from git history. Open decisions: 2–4 tied to the entry editor's return, 6 points at Phase 1 / Phase 9, new decision 7 (core scope).

- **2026-11-25 · Skeleton site · Claude** — The original build's public features are removed: insights (routes, article editor and settings, block editor, Google Docs paste and legacy conversion), investments and publications (records screens), pillars / stacking cards / biography hotspots (list items and their drafts), the Interactive section and template, the WebGL background, page transitions, smooth scrolling and letter reveals. The public site is now a plain, neutral skeleton: one built-in page (Homepage) built like every page from a pinned hero (`intro.title` / `intro.summary`) and two section types, Text (heading, body) and Image (image, alt, caption, contained / full width), rendered by one `PageView` for the homepage and created pages. Header (site name, main menu, mobile Menu toggle) and footer (heading, text, menu columns, copyright) are plain; menus lose the "insight" link kind and default to Home + a Contact column. The Studio keeps drafts and publishing, comments, menus, SEO, media, users and page creation; `/admin` opens on Pages; the page switcher lists pages only; comments live on pages only. SEO: the homepage's automatic title is the site name, every page's automatic description its hero intro. The data layer drops the entries, records and list functions (their tables stay in the schema). Stylesheet rewritten: tokens + `.site-*` skeleton rules + the unchanged Studio rules (970 → 300 lines). Removed packages: three, @react-three/fiber, gsap, lenis, video.js, @vimeo/player, react-markdown, rehype-raw. Replaced the leftover favicon, which was the original client's wordmark. Follow-ups: a sample image in the seed; the fixture's custom section, record type, template and bespoke route (Phase 4); the platform features that replace what was removed (content types, records, list items in sections).

- **2026-11-25 · Spec tidy · Claude** — Docs only. Phase 0 marked done (its remaining lint items are tracked once, under Phase 1). The "unchecked in the browser" note updated with what the Phase 1 click-through covered. Open decision 6 now points at Phase 1 / Phase 7 instead of the merged Phase 2. Removed the references to `cms-platform-plan.md`, which isn't in the repo.

- **2026-11-25 · Phase 1: data layer on D1 + R2 (merged with former Phase 2) · Claude** — The site and Studio now run on Cloudflare D1 and R2 through `src/data/`; Supabase is gone. Added `wrangler.jsonc` (D1 `DB`, R2 `MEDIA`), the Drizzle schema (`src/data/schema.ts`: site_content, entries, records, list_items, media, users, comments) with its first migration (`migrations/platform/0000_init.sql`), a fixture seed and `db:*` scripts. Access is denied by default: every server function starts with `asVisitor` / `asEditor` / `asAdmin` / `asCollaborator` (a test enforces it). Public reads (`content.ts`) return only live columns; Studio modules cover entries, site rows and list publishing (one D1 batch), records, media, comments and users. Components keep their shapes (`shapes.ts` maps generic rows). Sign-in is a dev-only placeholder (pick a seeded account); a built Worker has no signed-in user. Media: browser resize (2400px / 0.82), R2 under `library/…`, served at `/media/<key>` with immutable caching; share images made absolute. Approving a user now sets role `admin` (as every approved account was before). Records are sorted A–Z by name in the Studio (previously Z–A). Checks: type check, 110 tests and the build pass; every area clicked through locally (see roadmap). Follow-ups: the remaining `any` types and hook warnings; Worker rendering with the edge cache; a smoke test of the built Worker; replacing the builder's Vite preset.

- **2026-11-25 · Phase 0: fork and tidy · Claude** — This repo is now the platform repo, cut off from the original client build: its GitHub remote, `.env`, `supabase/`, `.lovable/`, build output, Drizzle/Postgres migrations and Lovable migration config are gone, so nothing here can reach that build's database, Lovable project or Worker. The original client's name, logo, symbol, copy, people and addresses are removed: placeholder wordmarks (`src/assets/brand/wordmark-{dark,light}.svg`) and `BrandSymbol`; `SITE_NAME` / `SITE_URL` / `SITE_HOST` in `lib/seo.ts` (mcotesjames.com, until site config exists); the original CSS class prefix replaced by `studio` / `studio-*` (Studio, per section 4 → Studio theme) and `site-*` (public site). The original features (investments, publications, pillars, biography, Interactive) stay as neutral fixtures until Phase 4. Lint formatting fixed, unused UI components and packages removed, `package-lock.json` replaces `bun.lock`. Checks: type check, 110 tests and build pass; not clicked through in a browser (no database until Phase 2). Follow-ups: the `any` types and hook warnings (Phase 1); `@lovable.dev/vite-tanstack-config` is still the Vite preset — replace with a plain TanStack Start + Nitro config when the Worker config is written (Phase 2).

- **2026-11-25 · Platform spec v1.1 · Claude** — Rendering changed from pre-rendering with rebuilds to Worker rendering with an edge cache cleared on Publish (no deploy hook). Data layer access is now denied by default via `studioFn` / `publicFn` wrappers with a bypass test; validation generated from site config; Drizzle for schema and migrations; Better Auth for sign-in; local dev and staging added. Images are resized in the browser before upload. Interactive section and template removed from the platform (a site feature). Added the platform/site boundary, extension points and platform update flow (section 12); repo model decided (open decision 5). Roadmap reordered so each phase leaves a working site: tidy, data layer on Supabase, swap to D1/R2, auth, then the platform/site split. Follow-ups: confirm TanStack virtual file routes with Start; open decisions 1–4 and 6.

- **2026-11-25 · Platform spec v1 · Claude** — generalised from the original build's Content Studio plan. Client-specific content (sectors, publication types, pillars, biography, page names, people) removed; editor behaviour, Studio structure, templates and lessons kept. Added: platform architecture (Cloudflare Worker + D1 + R2 per site, data layer, roles, pre-rendering, email, cron), generic records and list items, site configuration, new-site setup and offboarding, platform section library (Content feed, Record grid / list, Form), roadmap from fork to site #1, and the mcotesjames.com appendix. Follow-ups: open decisions 1–6; confirm the portfolio mapping before building.
