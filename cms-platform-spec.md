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
| Environments | Production Worker + a staging Worker with its own D1 and R2 |

A site's code can only reach its own bindings, so client data is separated by infrastructure, not by filters in code.

### Data layer (`src/data/`)
- **The only code that talks to D1 or R2.** Routes, components and the Studio call named functions (`getPage`, `saveDraft`, `publishEntry`, `listRecords`, `uploadMedia`…), never the database directly.
- **Access is denied by default.** Every server function lives in `src/data/` and starts its chain with one access middleware from `src/data/access.ts`: `asVisitor` for public reads (live columns only, never `draft`), or `asEditor` / `asAdmin` / `asOwner` for Studio functions, which check the session and role before the handler runs and pass the user on as `context.user`. (These are the `publicFn` / `studioFn` wrappers: TanStack Start's compiler needs each `createServerFn(…).handler(…)` chain written out in place, so the wrapper is a middleware rather than a factory.) `src/test/server-fns.test.ts` lists every server function and fails if one is defined elsewhere or skips the middleware. These checks replace Supabase's RLS policies: drafts, unapproved accounts and the media library are protected here.
- **Each field has exactly one writer** (section 5 → Page settings). The data layer enforces it: Publish preserves live values of fields it doesn't own.
- **Validation from config:** each record type's `data`, each section's fields and each list item are checked against a schema (zod) generated from the declarations in `site.config.ts`. The Studio form, the data layer and the public site share that one definition.
- **Schema and migrations with Drizzle** (D1 / SQLite dialect); generated SQL migration files are committed.
- Functions run server-side only (TanStack server functions). No database credentials or bindings ever reach the browser.

### Rendering
- **Public pages render on the Worker** from live columns in D1, and the response is stored in Cloudflare's edge cache (Cache API) by `src/data/cache.server.ts`.
- **Cached pages are keyed by a content version**, not purged: the key is the page's path plus the time live site content last changed (`site_content.updated_at`, written by Publish and Settings saves, never by draft autosaves). Any live change makes every data centre miss on its next request and render fresh, so publishing is live everywhere within seconds (the version is re-read at most every 2 seconds per Worker instance). *Why not purge: the Cache API is per data centre, so deleting entries only clears one; a global purge needs Cloudflare's purge API, a zone and a token per site.* Query strings are ignored for public pages.
- **Never cached:** the Studio (`/admin`), server functions (`/_serverFn`) and the Studio canvas (`?studio=1`). Media (`/media/<key>`) is cached by address, since a key's file never changes.
- **Browsers always revalidate pages** with the edge (`cache-control: public, max-age=0, must-revalidate`); media keeps a one-year immutable lifetime. Responses carry `x-edge-cache: HIT|MISS <version>` for diagnosis.
- **The Studio and its canvas run on the same Worker** and read drafts through the data layer, never from the cache. Studio canvases render in the browser only (`?studio=1`, TanStack `ssr: "data-only"`) to avoid hydration mismatches when drafts arrive.
- **Sitemap and robots** are server routes built from published content and cached like pages.

### Media
- Uploads go to the site's R2 bucket under `library/<timestamp>-<name>`, served from a stable public path (`/media/<key>` via the Worker, `cache-control: public, max-age=31536000, immutable`, ETag / 304). **No expiring signed links.** Content stores the path; share tags make it absolute.
- **Images are resized and compressed in the browser before upload** (canvas / `createImageBitmap`; max dimension and quality set in site config). Workers can't run `sharp`, and this keeps uploads small and free. The original file is not kept.
- SVG and non-image files upload unchanged.

### Auth
- **Better Auth** on D1 (no hand-rolled sessions). Sessions are HTTP-only, `SameSite=Lax` cookies.
- Sign-in method: open decision 1 (leaning email one-time code). Code requests and sign-in attempts are rate-limited per email and per IP.

### Local development
- `wrangler dev` with a local D1 database and R2 bucket, seeded from `db/seed.sql` (fixture content only, never client data).

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
| `users` | Studio accounts | `id`, `email`, `first_name`, `last_name`, `role` (`pending` / `editor` / `admin` / `owner`), `created_at`, `approved_at` |
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
| `editor` | Everything in the Studio except Users and site settings marked owner-only. |
| `admin` | Everything, including approving and removing users (never their own access). |
| `owner` | MCJames. Same as admin; can't be removed. Created by the setup script. |

There is no "first sign-up becomes admin" rule; the setup script creates the owner and the client's first admin.

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
- **Two selection levels, two colours:** sections (and entry blocks) in one colour, elements inside them (text, images, list items) in another. Dashed on hover, solid when selected; an inner element's outline sits inside its section's. Colours are tokens (site config `studio.selectionColours`; default green / light blue).
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
- The whole Studio (sign-in, lists, forms, editor chrome) uses its **own neutral dark theme**, separate from the site.
- The site's **brand colour is the accent** (site config `studio.accent`): primary buttons, active sidebar item, Live badge.
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

Config shape: `{ label, description, hero: boolean, starting: SectionType[], required: SectionType[], allowed: (type) => boolean }`. New layouts ("Landing page", "Long-form report", the original build's "Interactive") are site templates declared in site config, not new routes. A site section can declare that it is only allowed on its own template.

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

```text
src/
  data/                 ← the only code touching D1 / R2 (section 2)
    entries.ts records.ts pages.ts lists.ts menus.ts settings.ts
    media.ts users.ts comments.ts publish.ts auth.ts
  platform/             ← shared CMS code, identical on every site
    studio/             ← shell, top bar, page switcher, side panel, lists, forms, Users, Feedback
    canvas/             ← frame bridge, outlines, selection, in-place text, comment pins
    blocks/             ← entry block renderers + panel editors (shared by canvas and live site)
    sections/           ← platform section library
    lib/                ← seo, templates, empty-content helper, blocks-convert, menus
    routes/             ← platform routes: root, /admin, /$slug, content routes, sitemap, robots
  site/                 ← this site only
    site.config.ts      ← section 9
    sections/           ← the site's designed sections (renderer + fields + editor layout)
    routes/             ← the site's bespoke routes, if any
    theme/              ← brand tokens, fonts
  routes.ts             ← mounts platform/routes and site/routes (TanStack virtual file routes)
migrations/
  platform/ site/
```

- **Shared renderers:** the same block and section components render on the live site and the canvas.
- **`platform/` never imports from `site/`** except through `site.config.ts`, enforced by a lint rule. This is what lets a platform update ship to every site.
- **Routes from both folders** are mounted with TanStack's virtual file routes (`physical()`), so platform and site routes never share a folder. ☐ Confirm this works with TanStack Start in Phase 4.
- **Editors are keyed by what they edit** (`<Editor key={id} />`).

---

## 9. Site Configuration ☐

Everything that varies per site is declared in `src/site/site.config.ts`. Shared components read it; they never hard-code site values.

```typescript
export default defineSite({
  name: "{{SITE_NAME}}",
  domain: "{{DOMAIN}}",
  brand: { logo, accent, fonts, selectionColours },
  studio: { home: "pages" /* or a content type key */ },
  auth: { openSignup: true, method: "email-code" },

  contentTypes: {
    // key: { label, plural, path: "/insights", template: "article", blocks?, defaultAuthor? }
  },

  recordTypes: {
    // key: { label, plural, fields: { name: text(), sector: multiSelect(OPTIONS) … },
    //        ordering: "manual" | { field, direction }, placeholderFlag: true, pinnable?: true }
  },

  sections: {
    // key: { label, fields, items?, positionedItems?, repeats, templates, options,
    //        editorLayout?: "static", from?: { recordType | contentType | list } }
  },

  pages: {
    // built-in pages: { key, name, path (fixed), hero: { fields }, defaultSections, seoDefaults }
  },

  templates: { /* site-specific page templates, added to Standard */ },

  settings: { /* site-wide fields: contact email, social links, form recipient, disclaimers … */ },

  menus: { mainMax: 5, footerColumns: 3, defaults: { main: [...], footer: [...] } },

  seo: { titleSuffix: " — {{SITE_NAME}}", organization: { … } },

  media: { maxDimension: 2400, quality: 82 },   // applied in the browser before upload
});
```

`defineSite()` validates the config at build time against the platform version's config contract. A release that renames or reshapes something fails the site's build with a clear message, never at runtime.

**Field types:** `text`, `longText`, `richText`, `image`, `file`, `link` (points at a target, as menus do), `select`, `multiSelect`, `date`, `number`, `boolean`, `reference` (to a record or entry), `list` (repeating group).

---

## 10. New Site Setup ☐

The setup script (`scripts/new-site`) does, in order:
1. Create the site repo from the platform repo and add the `platform` remote.
2. Create the D1 databases and R2 buckets for production and staging.
3. Write the site's Worker config with **those** binding IDs (never copied from another site).
4. Apply migrations (platform, then site).
5. Seed: owner account (MCJames), the client's first admin, default settings and menus from site config.
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
- **Platform repo:** `platform/`, `data/`, `migrations/platform/`, scripts, this spec, and a **test site** (a fixture `src/site/`).
- **Each site:** its own repo, created from the platform repo, with the platform added as a second git remote (`platform`). It holds the platform plus its own `src/site/` and `migrations/site/`, deployed as its own Worker.
- A platform package is reconsidered only if the number of sites makes merging updates a burden.

### Platform vs site: the boundary
**The platform owns everything outside `src/site/` and `migrations/site/`. The site owns everything inside them. They meet only through `site.config.ts`.**

- **Content made in the Studio is never at risk from a code update.** Created pages, records, entries, menus and comments are rows in the site's own D1. Only a platform migration touches data, and it follows the content-safety rules (section 11).
- **Site code plugs in through extension points:**

| A site adds | Where | How the platform picks it up |
|---|---|---|
| A section type | `src/site/sections/` + `config.sections` | Merged into the section library, the + menu, the renderer and the side panel |
| A record type | `config.recordTypes` | List, form drawer, validation and record grid built from its field declarations |
| A page template | `config.templates` | Offered in + New page after Standard |
| A bespoke route or feature | `src/site/routes/` | Mounted alongside platform routes (section 8) |
| Brand, fonts, theme | `src/site/theme/` | Read by the public site and the Studio accent |
| A site-only table (rare) | `migrations/site/` | Applied after platform migrations |

- **Never patch platform files in a site repo.** If a site needs the platform to behave differently, the change goes into the platform for every site, behind a config option if needed.
- **Default to the site.** Build a feature in `src/site/` first; promote it to the platform only when a second site needs it.

### Platform updates
1. **Build and test in the platform repo.** CI builds the test site, which uses every extension point (a custom section, a record type, a template, a bespoke route). A change that would break a site's additions fails here first.
2. **Release:** tag a version (`v1.4.0`) with a changelog entry. A change to the config contract is a major version, with upgrade notes.
3. **Roll out per site:** merge the tag from the `platform` remote (only platform files change, so conflicts are rare), run the site's checks, back up and migrate staging, check staging, then production.
4. **Know who's behind:** each site records its platform version (`PLATFORM_VERSION`), so outdated sites are visible.

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
Proves the stack on Cloudflare itself before anything else is built on it. Done by hand; Phase 8 scripts it.
- ✅ Staging D1 database `cms-core-staging` (Western Europe) and R2 bucket `cms-core-staging-media` created in the MCJames account; the database ID is in `wrangler.jsonc`. R2 had to be enabled once in the dashboard (it needs a payment method on file, even within the free allowance).
- ✅ Migrations applied and fixture content seeded on staging.
- ✅ Staging Worker `cms-core-staging` deployed: https://cms-core-staging.mcotesjames-f69.workers.dev. Checked: pages render from the staging database, sitemap and robots served, edge cache MISS → HIT in Cloudflare's network, no console errors.
- ✅ Staging is never indexed: `SITE_ENV` (a Worker variable) is `staging`, so `robots.txt` disallows everything and every response carries `X-Robots-Tag: noindex, nofollow`; only `SITE_ENV=production` lets search engines in.
- ✅ The Studio is closed on staging (no sign-in until Phase 3).
- ✅ Local development keeps its own database: `preview_database_id: "local-dev"` in `wrangler.jsonc` separates it from staging's ID.

### Phase 3 — Auth ☐
Nothing deployed can be edited until this exists.
- ☐ Better Auth sign-in (open decision 1), rate limiting per email and IP.
- ☐ Roles in use: editor / admin chosen on approval; owner-only settings; Users screen updated.
- ☐ Owner and the client's first admin seeded by script; open sign-up switchable per site.
- ☐ The dev sign-in placeholder removed (or kept for local development only).

### Phase 4 — Split platform and site ◐
- ✅ The original build's features replaced by a plain skeleton site: homepage, pinned hero, Text and Image sections, plain header and footer (2026-11-25).
- ☐ Split shared code into `platform/` and site code into `site/`; introduce `site.config.ts`, `defineSite()` and the extension points (section 12).
- ☐ Confirm TanStack virtual file routes mount `platform/routes` and `site/routes`.
- ☐ Lint rule: `platform/` never imports from `site/`.
- ☐ The fixture test site uses every extension point (a custom section, a record type, a template, a bespoke route), built fresh; CI builds it.

### Phase 5 — Core scope: decide what every site ships with ☐
A decision phase, no code. Pages alone aren't enough: the core ships with a small set of **content types**, **record types** and **sections** that most client sites need, each one switched on, off or renamed in `site.config.ts` rather than rebuilt per site. The outcome is recorded in section 14 → Made and built in Phase 6.

**Criteria for the core:** needed by most client sites · generic enough to rename without code (labels, paths, fields) · no client-specific design · worth maintaining for every site.

**Candidates to decide** (proposals, not decisions):

| Kind | Candidate | What it is | Notes |
|---|---|---|---|
| Content type | **Articles** | News, blog or insights posts with their own page, block editor, author and date | Proven in the original build (restorable from git history, commit `5b54fbe`) |
| Content type | **Case studies** | Project write-ups with their own page | Could be Articles with a different template, or Projects records with detail pages |
| Content type | **Events** | Dated entries with a location and an archive of past events | Less common; maybe site-level |
| Record type | **Team members** | Name, role, photo, bio, links | Very common |
| Record type | **Testimonials** | Quote, name, role, company, photo | Very common |
| Record type | **Logos / clients / partners** | Name, logo, link | Common |
| Record type | **FAQs** | Question, answer, category | Common |
| Record type | **Projects** | Name, summary, images, services, link | Needed by the portfolio (section 15) |
| Section | **Content feed** | Latest entries of a content type | Needed with any content type |
| Section | **Record grid / list** | Records of a type, optional filters | Needed with any record type |
| Section | **Form** | Contact or enquiry form emailed via Resend | Nearly every site |
| Section | **Call to action** | Heading, text, button link | Common, small |
| Section | **Gallery** | Several images in a grid or carousel | Common |
| Section | **Quote** | A pull quote with attribution | Small; also an Article block |
| Section | **Video** | Vimeo / YouTube / uploaded, with caption | Common |
| Section | **Cards** | Items edited inside the section (list items) | Restores the list-item system |
| Studio | **Analytics dashboard** | Visits, top pages, referrers, countries, devices (Workers Analytics Engine, cookieless, admin-only) | See Phase 8 |
| Studio | **Redirects** | Old address → new address, for launches and renamed pages | Important when replacing an old site |

Questions to settle alongside: which items are **on by default** vs **available but off**; the **default names and addresses** (e.g. Articles at `/articles`, renamable); whether **Case studies** is its own content type or a template of Articles.

### Phase 6 — Core features ☐
Builds the core decided in Phase 5, each through the platform extension points so sites can switch them on, off or rename them.
- ☐ Content types: entries, the visual entry editor and block catalogue (section 6), Settings screens, list screens, public archive and detail routes, sitemap and SEO for entries. The original build's article editor (git history, commit `5b54fbe`) is the starting point.
- ☐ Records: list with a form drawer, fields from config, option lists, manual or field ordering, record comments, with the draft step and preview cards the original build lacked.
- ☐ List items inside sections (cards, accordions, positioned items), with drafts.
- ☐ The sections decided in Phase 5 (at least Content feed, Record grid / list and Form).
- ☐ Reference handling: links and cards to entries and records hide when the target is unpublished or deleted.
- ☐ Paste from Google Docs (and Word, Substack) into entries; legacy Markdown/HTML conversion for imported content.

### Phase 7 — Portfolio (site #1) ☐
- ☐ `site.config.ts` and designed sections for mcotesjames.com (section 15), using the core features it needs.
- ☐ Migrate current content verbatim from the WordPress site; redirects from old addresses.
- ☐ Staging, then production on the custom domain.
- ☐ Track hours per module (to inform per-site pricing).

### Phase 8 — Setup and operations ☐
- ☐ New-site script (section 10), platform update script (merge tag, migrate staging, check), launch checklist, offboarding export.
- ☐ Cron jobs: daily database backup to the MCJames backup bucket; resolved-comment clean-up.
- ☐ Analytics dashboard in the Studio (if not in the Phase 5 core).
- ☐ Error monitoring for deployed Workers.

### Phase 9 — Editor polish and later ☐
- ☐ Secret preview links for drafts (open decision 6).
- ☐ No layout shift when the panel opens or closes.
- ☐ Drag and drop: blocks and sections on the canvas; reordering in record lists.
- ☐ Revisit open decisions 2–4 once the entry editor is back.

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
- **Drag and drop:** deferred to Phase 9.
- **Infrastructure:** Cloudflare Worker + D1 + R2 per site (plus staging), on one MCJames account; data layer as the only database access; Resend for email.
- **Rendering:** public pages render on the Worker and are edge-cached; Publish clears the affected URLs. No pre-rendering, rebuilds or deploy hooks.
- **Access checks:** every server function goes through `studioFn` / `publicFn`; denied by default, enforced by a test.
- **Auth library:** Better Auth on D1. **Schema and migrations:** Drizzle.
- **Media:** images resized in the browser before upload; stable R2 paths.
- **Interactive embeds:** not in the platform; a site feature.
- **Repo model:** one repo per site, created from the platform repo, pulling releases from a `platform` git remote. Site code only in `src/site/` and `migrations/site/`; the config is the only contract.
- **Multi-value fields:** JSON arrays in the platform (the original build's joined strings are not carried over).

### Open
1. **Sign-in method:** email + password (passwords hashed in the Worker), or a one-time code by email (no passwords stored; needs Resend working before anyone can sign in). *Leaning: email code.*
2. **Body text editing:** body text is written in the side panel rather than typed on the page. Keep it, or move it onto the canvas to match the canvas-first principle? *Applies to the entry editor and the Text section; settle when entries return (Phase 6).*
3. **Image drop:** dropping an image onto an entry was lost in the original build when the editors were unified. Restore it? *Settle in Phase 6.*
4. **Long-distance moves:** repeated ↑ to move a block far up a long entry or page. Acceptable until drag and drop (Phase 9)?
5. ~~Repo model~~ — decided (see Made).
6. **Draft previews before publish:** the Studio canvas is the only preview. With Worker rendering, secret preview links are now cheap (render drafts for a signed token, never cached). Build them with the edge cache (Phase 1), or leave them for Phase 9?
7. **Core scope:** which content types, record types, sections and Studio features ship with every site, which are on by default, and their default names and addresses. Candidates and criteria are in section 13 → Phase 5; the outcome moves to Made and is built in Phase 6.
8. **Cloudflare account per client, or one for all?** One MCJames account is simplest (one bill, re-charged in the hosting fee; sites still isolated by their own Worker, D1 and R2) but every site shares the account's free allowances; one account per client gives each its own allowance and makes hand-over clean, at the cost of more admin. Either way, real client sites need **Workers Paid** (about $5/month per account): the free plan's ~10 ms CPU per request and 100,000 requests/day across the account won't carry server-rendered client sites. Decide before the Phase 8 new-site script.

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
- **Don't use first-sign-up-becomes-admin triggers;** seed the owner instead.
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
- *Supabase / Lovable only, kept for reference:* column-level SELECT breaks Postgres upserts; Lovable lockfiles point at a private package mirror.

---

## 17. Change Log

Newest first. Each entry: date, what changed, how, and any follow-ups.

- **2026-11-25 · Phase 2: first deployment · Claude** — Staging is live at https://cms-core-staging.mcotesjames-f69.workers.dev: D1 `cms-core-staging` (migrated, fixture seed), R2 `cms-core-staging-media` (R2 enabled in the dashboard), Worker `cms-core-staging` deployed from the build with `wrangler deploy --config .output/server/wrangler.json`. Added `SITE_ENV` (anything but `production` → `robots.txt` blocks everything and every response is `X-Robots-Tag: noindex, nofollow`). Local development keeps its own database (`preview_database_id: "local-dev"`); the existing local data was copied across. Checked on Cloudflare: pages from the staging database, sitemap, robots, edge cache MISS → HIT, Studio closed. New open decision 8 (one Cloudflare account or one per client; Workers Paid for real client sites). Follow-ups: staging has no media yet (uploads need sign-in, Phase 3); the deploy is manual until the Phase 8 scripts.

- **2026-11-25 · Phase 1 finished · Claude** — Replaced the Lovable Vite preset with a plain `vite.config.ts` (and removed the package). Tested the built Worker under `wrangler dev`: pages, sitemap, robots and media from local D1/R2, Studio closed. Added the edge cache (`src/data/cache.server.ts`, wired in `src/server.ts`): public pages keyed by a content version (`site_content.updated_at`, now written only when live content changes), media by address, Studio / server functions / canvas never cached, browsers always revalidate pages; verified hit → still a hit after a draft save → miss with new content after a publish. The spec's purge-on-publish plan changed to version keys, because the Cache API is per data centre (section 2 → Rendering). `robots.txt` is a server route from `SITE_URL`. Lint clean: the remaining `any` types typed through the page model's `Doc`, hook dependencies made explicit, Studio helpers (`meQuery`, `useSignOut`, `adminHead`) moved from `AdminGate.tsx` to `adminUser.ts`. 79 tests (5 new: cacheable requests, robots). Follow-ups: lazy images take no space until loaded (store image dimensions with Image sections); a real deployment is Phase 2.

- **2026-11-25 · Roadmap rewritten · Claude** — Docs only. New order: finish Phase 1 (built-Worker test, edge cache, plain Vite config, lint) → Phase 2 First deployment (staging by hand, reusing the merged phase's number) → Phase 3 Auth → Phase 4 platform/site split → **Phase 5 Core scope** (a decision phase: which content types, record types, sections and Studio features ship with every site, with a candidate list and criteria; pages alone aren't enough) → Phase 6 Core features (rebuilding entries, records and list items on the platform, with the original build's code in commit `5b54fbe` as the starting point) → Phase 7 Portfolio → Phase 8 Setup and operations (now including backups, error monitoring and the analytics dashboard) → Phase 9 Editor polish and drag and drop. Stale items from the skeleton cut removed (record and article gaps, the shader motion item, the already-deleted error-reporting hook); the feature inventory now separates what's in the code from what's restorable from git history. Open decisions: 2–4 tied to the entry editor's return, 6 points at Phase 1 / Phase 9, new decision 7 (core scope).

- **2026-11-25 · Skeleton site · Claude** — The original build's public features are removed: insights (routes, article editor and settings, block editor, Google Docs paste and legacy conversion), investments and publications (records screens), pillars / stacking cards / biography hotspots (list items and their drafts), the Interactive section and template, the WebGL background, page transitions, smooth scrolling and letter reveals. The public site is now a plain, neutral skeleton: one built-in page (Homepage) built like every page from a pinned hero (`intro.title` / `intro.summary`) and two section types, Text (heading, body) and Image (image, alt, caption, contained / full width), rendered by one `PageView` for the homepage and created pages. Header (site name, main menu, mobile Menu toggle) and footer (heading, text, menu columns, copyright) are plain; menus lose the "insight" link kind and default to Home + a Contact column. The Studio keeps drafts and publishing, comments, menus, SEO, media, users and page creation; `/admin` opens on Pages; the page switcher lists pages only; comments live on pages only. SEO: the homepage's automatic title is the site name, every page's automatic description its hero intro. The data layer drops the entries, records and list functions (their tables stay in the schema). Stylesheet rewritten: tokens + `.site-*` skeleton rules + the unchanged Studio rules (970 → 300 lines). Removed packages: three, @react-three/fiber, gsap, lenis, video.js, @vimeo/player, react-markdown, rehype-raw. Replaced the leftover favicon, which was the original client's wordmark. Follow-ups: a sample image in the seed; the fixture's custom section, record type, template and bespoke route (Phase 4); the platform features that replace what was removed (content types, records, list items in sections).

- **2026-11-25 · Spec tidy · Claude** — Docs only. Phase 0 marked done (its remaining lint items are tracked once, under Phase 1). The "unchecked in the browser" note updated with what the Phase 1 click-through covered. Open decision 6 now points at Phase 1 / Phase 7 instead of the merged Phase 2. Removed the references to `cms-platform-plan.md`, which isn't in the repo.

- **2026-11-25 · Phase 1: data layer on D1 + R2 (merged with former Phase 2) · Claude** — The site and Studio now run on Cloudflare D1 and R2 through `src/data/`; Supabase is gone. Added `wrangler.jsonc` (D1 `DB`, R2 `MEDIA`), the Drizzle schema (`src/data/schema.ts`: site_content, entries, records, list_items, media, users, comments) with its first migration (`migrations/platform/0000_init.sql`), a fixture seed and `db:*` scripts. Access is denied by default: every server function starts with `asVisitor` / `asEditor` / `asAdmin` / `asOwner` (a test enforces it). Public reads (`content.ts`) return only live columns; Studio modules cover entries, site rows and list publishing (one D1 batch), records, media, comments and users. Components keep their shapes (`shapes.ts` maps generic rows). Sign-in is a dev-only placeholder (pick a seeded account); a built Worker has no signed-in user. Media: browser resize (2400px / 0.82), R2 under `library/…`, served at `/media/<key>` with immutable caching; share images made absolute. Approving a user now sets role `admin` (as every approved account was before). Records are sorted A–Z by name in the Studio (previously Z–A). Checks: type check, 110 tests and the build pass; every area clicked through locally (see roadmap). Follow-ups: the remaining `any` types and hook warnings; Worker rendering with the edge cache; a smoke test of the built Worker; replacing the builder's Vite preset.

- **2026-11-25 · Phase 0: fork and tidy · Claude** — This repo is now the platform repo, cut off from the original client build: its GitHub remote, `.env`, `supabase/`, `.lovable/`, build output, Drizzle/Postgres migrations and Lovable migration config are gone, so nothing here can reach that build's database, Lovable project or Worker. The original client's name, logo, symbol, copy, people and addresses are removed: placeholder wordmarks (`src/assets/brand/wordmark-{dark,light}.svg`) and `BrandSymbol`; `SITE_NAME` / `SITE_URL` / `SITE_HOST` in `lib/seo.ts` (mcotesjames.com, until site config exists); the original CSS class prefix replaced by `studio` / `studio-*` (Studio, per section 4 → Studio theme) and `site-*` (public site). The original features (investments, publications, pillars, biography, Interactive) stay as neutral fixtures until Phase 4. Lint formatting fixed, unused UI components and packages removed, `package-lock.json` replaces `bun.lock`. Checks: type check, 110 tests and build pass; not clicked through in a browser (no database until Phase 2). Follow-ups: the `any` types and hook warnings (Phase 1); `@lovable.dev/vite-tanstack-config` is still the Vite preset — replace with a plain TanStack Start + Nitro config when the Worker config is written (Phase 2).

- **2026-11-25 · Platform spec v1.1 · Claude** — Rendering changed from pre-rendering with rebuilds to Worker rendering with an edge cache cleared on Publish (no deploy hook). Data layer access is now denied by default via `studioFn` / `publicFn` wrappers with a bypass test; validation generated from site config; Drizzle for schema and migrations; Better Auth for sign-in; local dev and staging added. Images are resized in the browser before upload. Interactive section and template removed from the platform (a site feature). Added the platform/site boundary, extension points and platform update flow (section 12); repo model decided (open decision 5). Roadmap reordered so each phase leaves a working site: tidy, data layer on Supabase, swap to D1/R2, auth, then the platform/site split. Follow-ups: confirm TanStack virtual file routes with Start; open decisions 1–4 and 6.

- **2026-11-25 · Platform spec v1 · Claude** — generalised from the original build's Content Studio plan. Client-specific content (sectors, publication types, pillars, biography, page names, people) removed; editor behaviour, Studio structure, templates and lessons kept. Added: platform architecture (Cloudflare Worker + D1 + R2 per site, data layer, roles, pre-rendering, email, cron), generic records and list items, site configuration, new-site setup and offboarding, platform section library (Content feed, Record grid / list, Form), roadmap from fork to site #1, and the mcotesjames.com appendix. Follow-ups: open decisions 1–6; confirm the portfolio mapping before building.
