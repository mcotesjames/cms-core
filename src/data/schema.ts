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

/** Timestamps Better Auth writes (stored as milliseconds; it reads and writes Date objects). */
const ms = (name: string) => integer(name, { mode: "timestamp_ms" });
const msNow = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

/**
 * Studio accounts: Better Auth's user model (`name`, `email`, `emailVerified`, `image`,
 * `createdAt`, `updatedAt`) plus the CMS's own fields. Sign-up sets `firstName` / `lastName`;
 * `role` and `approvedAt` are only ever written by the CMS (approval, roles), never by sign-up.
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default(""),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  role: text("role", { enum: ROLES }).notNull().default("pending"),
  createdAt: ms("created_at").notNull().default(msNow),
  updatedAt: ms("updated_at").notNull().default(msNow),
  approvedAt: text("approved_at"),
});

/** Better Auth: signed-in sessions (an HTTP-only cookie holds the token). */
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: ms("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: ms("created_at").notNull(),
    updatedAt: ms("updated_at").notNull(),
  },
  (t) => [index("sessions_user").on(t.userId)],
);

/** Better Auth: sign-in methods per user. Email + password is provider "credential". */
export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Password hash (src/data/password.server.ts), for provider "credential". */
    password: text("password"),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ms("access_token_expires_at"),
    refreshTokenExpiresAt: ms("refresh_token_expires_at"),
    scope: text("scope"),
    createdAt: ms("created_at").notNull(),
    updatedAt: ms("updated_at").notNull(),
  },
  (t) => [index("accounts_user").on(t.userId)],
);

/** Better Auth: one-time tokens (password resets, email codes once email sending exists). */
export const verifications = sqliteTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: ms("expires_at").notNull(),
  createdAt: ms("created_at"),
  updatedAt: ms("updated_at"),
});

/** Better Auth: rate-limit counters (sign-in and sign-up attempts per IP). */
export const rateLimits = sqliteTable("rate_limits", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: integer("last_request").notNull(),
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
