/**
 * Who is signed in (spec section 2 → Auth): the Better Auth session for this request, joined to
 * the CMS's `users` row for its role.
 *
 * Local development also has a shortcut: in `vite dev` only, the `cms_dev_user` cookie signs you
 * in as one of the seeded local accounts (db/seed.dev-users.sql), which have no passwords. It's
 * compiled out of builds, so staging and production only ever use real sessions.
 */
import { eq } from "drizzle-orm";
import { getCookie, getRequest } from "@tanstack/react-start/server";
import { db } from "./db.server";
import { users } from "./schema";
import type { StudioUser } from "./access";

export const DEV_USER_COOKIE = "cms_dev_user";

export async function currentUser(): Promise<StudioUser | null> {
  let id: string | null = null;
  if (import.meta.env.DEV) id = getCookie(DEV_USER_COOKIE) || null;
  if (!id) {
    const { sessionUserId } = await import("./auth.server");
    id = await sessionUserId(getRequest());
  }
  if (!id) return null;
  const [row] = await (await db()).select().from(users).where(eq(users.id, id)).limit(1);
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    role: row.role,
  };
}
