/**
 * Who is signed in. Placeholder until Better Auth (spec Phase 3):
 *
 * - In `vite dev`, the user is one of the seeded accounts (db/seed.sql), chosen by the
 *   `cms_dev_user` cookie and defaulting to the owner, so the Studio can be clicked through
 *   locally without a sign-in system.
 * - Anywhere else (a built Worker), nobody is signed in: every Studio function is denied.
 */
import { eq } from "drizzle-orm";
import { getCookie } from "@tanstack/react-start/server";
import { db } from "./db.server";
import { users } from "./schema";
import type { StudioUser } from "./access";

export const DEV_USER_COOKIE = "cms_dev_user";
const DEV_DEFAULT_USER = "dev-owner";

export async function currentUser(): Promise<StudioUser | null> {
  if (!import.meta.env.DEV) return null;
  const id = getCookie(DEV_USER_COOKIE) || DEV_DEFAULT_USER;
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
