/**
 * The D1 (SQLite) schema — spec section 2 → Database schema. Only `src/data/` imports this.
 *
 * JSON is stored as TEXT (Drizzle's `mode: "json"` parses it); IDs are generated in code
 * (`crypto.randomUUID()`); dates are ISO 8601 text. Live columns are what visitors see; `draft`
 * holds unpublished changes and is only ever read by Studio functions.
 *
 * Change this file, then run `npm run db:generate` and commit the new SQL file in
 * migrations/platform/. Never edit a migration that has been applied anywhere.
 */
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { Json, JsonObject } from "./shapes";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;
const json = <T>(name: string) => text(name, { mode: "json" }).$type<T>();

/** One row per page (`home`, `page_<letters>` …) plus `settings`, `menus`, `lists`, `pages`. */
export const siteContent = sqliteTable("site_content", {
  key: text("key").primaryKey(),
  data: json<JsonObject>("data")
    .notNull()
    .default(sql`'{}'`),
  draft: json<JsonObject>("draft"),
  /** When the live content last changed (never on draft-only saves): the edge cache's version. */
  updatedAt: text("updated_at").notNull().default(now),
});

/** Content entries of every content type (insights, …), each with its own page. */
export const entries = sqliteTable(
  "entries",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull().default(""),
    standfirst: text("standfirst").notNull().default(""),
    cover: text("cover").notNull().default(""),
    author: text("author").notNull().default(""),
    publishedAt: text("published_at"),
    published: integer("published", { mode: "boolean" }).notNull().default(false),
    blocks: json<Json[]>("blocks")
      .notNull()
      .default(sql`'[]'`),
    /** Imported Markdown/HTML, kept until its conversion to blocks is confirmed. */
    legacyBody: text("legacy_body").notNull().default(""),
    seo: json<JsonObject>("seo"),
    draft: json<JsonObject>("draft"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("entries_type_slug").on(t.type, t.slug),
    index("entries_type_published").on(t.type, t.published),
  ],
);

/** Records of every record type; a type's fields live in `data` (no migration per type). */
export const records = sqliteTable(
  "records",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    data: json<JsonObject>("data")
      .notNull()
      .default(sql`'{}'`),
    position: integer("position").notNull().default(0),
    draft: json<JsonObject>("draft"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [index("records_type_position").on(t.type, t.position)],
);

/** Items inside sections (cards, accordions, positioned items …), published from list drafts. */
export const listItems = sqliteTable(
  "list_items",
  {
    id: text("id").primaryKey(),
    list: text("list").notNull(),
    position: integer("position").notNull().default(0),
    data: json<JsonObject>("data")
      .notNull()
      .default(sql`'{}'`),
  },
  (t) => [index("list_items_list_position").on(t.list, t.position)],
);

/** The media library: one row per file in the site's R2 bucket. */
export const media = sqliteTable("media", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  bytes: integer("bytes").notNull().default(0),
  width: integer("width"),
  height: integer("height"),
  alt: text("alt").notNull().default(""),
  previousKey: text("previous_key"),
  uploadedBy: text("uploaded_by"),
  createdAt: text("created_at").notNull().default(now),
});

export const ROLES = ["pending", "editor", "admin", "owner"] as const;
export type Role = (typeof ROLES)[number];

/** Studio accounts. Sign-in sessions arrive with Better Auth (Phase 3). */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  role: text("role", { enum: ROLES }).notNull().default("pending"),
  createdAt: text("created_at").notNull().default(now),
  approvedAt: text("approved_at"),
});

/** Feedback comments: a thread is a row with no `thread_id`; replies point at it. */
export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id"),
    /** The element address the thread is pinned to (`data-cms…` value, or `page`). */
    anchor: text("anchor").notNull(),
    /** Where the thread was opened: `page:<key>`, `post:<id>` or `record:<table>:<id>`. */
    openedOn: text("opened_on").notNull(),
    device: text("device").notNull().default("desktop"),
    body: text("body").notNull(),
    authorId: text("author_id").notNull(),
    assigneeId: text("assignee_id"),
    position: json<JsonObject>("position"),
    resolvedAt: text("resolved_at"),
    resolvedBy: text("resolved_by"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [index("comments_thread").on(t.threadId), index("comments_opened_on").on(t.openedOn)],
);
