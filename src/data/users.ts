/**
 * Studio accounts (spec section 5 → Users and sign-up): who is signed in, names, approval and
 * roles, and admin-set passwords. Sign-in itself is Better Auth (auth.server.ts, /api/auth).
 *
 * Roles: `pending` (signed up, waiting) · `editor` (everything except Users) · `admin`
 * (also approves, changes roles, removes access, sets passwords) · `owner` (an admin who can't
 * be removed or demoted; set with `npm run user:owner`). Nobody changes their own role or access.
 */
import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { asAdmin, asEditor, asVisitor, hasRole, type StudioUser } from "./access";

export type Me = {
  user: StudioUser | null;
  /** Whether the sign-in screen offers "Create an account". */
  signupOpen: boolean;
  /** Local development only: seeded accounts to sign in as without a password. */
  devAccounts: { id: string; email: string; name: string; role: string }[] | null;
};

/** The signed-in user (or null), whether sign-up is open, and in dev the shortcut accounts. */
export const getMe = createServerFn({ method: "GET" })
  .middleware([asVisitor])
  .handler(async (): Promise<Me> => {
    const { currentUser } = await import("./session.server");
    const { bindings } = await import("./env.server");
    const user = await currentUser();
    const signupOpen = (await bindings()).SIGNUP_OPEN !== "false";
    if (!import.meta.env.DEV) return { user, signupOpen, devAccounts: null };
    const { db } = await import("./db.server");
    const { users } = await import("./schema");
    const rows = await (await db()).select().from(users).orderBy(asc(users.createdAt));
    return {
      user,
      signupOpen,
      devAccounts: rows
        .filter((r) => r.email.endsWith("@example.test"))
        .map((r) => ({
          id: r.id,
          email: r.email,
          name: `${r.firstName} ${r.lastName}`.trim() || r.email,
          role: r.role,
        })),
    };
  });

/** Local development only: sign in as a seeded account (`null` clears the shortcut). */
export const devSignIn = createServerFn({ method: "POST" })
  .middleware([asVisitor])
  .inputValidator(z.object({ id: z.string().nullable() }))
  .handler(async ({ data }) => {
    if (!import.meta.env.DEV) throw new Error("Not available on this site.");
    const { setCookie, deleteCookie } = await import("@tanstack/react-start/server");
    const { DEV_USER_COOKIE } = await import("./session.server");
    if (data.id)
      setCookie(DEV_USER_COOKIE, data.id, { path: "/", sameSite: "lax", httpOnly: true });
    else deleteCookie(DEV_USER_COOKIE, { path: "/" });
    return { ok: true };
  });

/** Saves the signed-in user's own name (asked for when it's missing). Pending users can too. */
export const setMyName = createServerFn({ method: "POST" })
  .middleware([asVisitor])
  .inputValidator(z.object({ first: z.string().trim().min(1), last: z.string().trim() }))
  .handler(async ({ data }) => {
    const { currentUser } = await import("./session.server");
    const me = await currentUser();
    if (!me) throw new Error("Not signed in");
    const { db } = await import("./db.server");
    const { users } = await import("./schema");
    await (
      await db()
    )
      .update(users)
      .set({
        firstName: data.first,
        lastName: data.last,
        name: `${data.first} ${data.last}`.trim(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, me.id));
    return { ok: true };
  });

export type StudioProfile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  approved: boolean;
  created_at: string;
};

/** Everyone with an account, and whether they're approved (for "For" pickers and Users). */
export const listProfiles = createServerFn({ method: "GET" })
  .middleware([asEditor])
  .handler(async (): Promise<StudioProfile[]> => {
    const { db } = await import("./db.server");
    const { users } = await import("./schema");
    const rows = await (await db()).select().from(users).orderBy(asc(users.createdAt));
    return rows.map((r) => ({
      id: r.id,
      first_name: r.firstName,
      last_name: r.lastName,
      email: r.email,
      role: r.role,
      approved: hasRole(r, "editor"),
      created_at: r.createdAt.toISOString(),
    }));
  });

const assignable = z.enum(["editor", "admin"]);

/** Loads another user for an admin action; refuses your own account and the owner's. */
async function otherUser(id: string, me: StudioUser) {
  if (id === me.id) throw new Error("You can't change your own access.");
  const { db } = await import("./db.server");
  const { users } = await import("./schema");
  const d = await db();
  const [target] = await d.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) throw new Error("That account no longer exists.");
  if (target.role === "owner") throw new Error("The owner's access can't be changed.");
  return { d, users, target };
}

/** Approves a waiting account as an editor or an admin. */
export const approveUser = createServerFn({ method: "POST" })
  .middleware([asAdmin])
  .inputValidator(z.object({ id: z.string(), role: assignable }))
  .handler(async ({ data, context }) => {
    const { d, users } = await otherUser(data.id, context.user);
    const { nowIso } = await import("./db.server");
    await d
      .update(users)
      .set({ role: data.role, approvedAt: nowIso(), updatedAt: new Date() })
      .where(eq(users.id, data.id));
    return { ok: true };
  });

/** Changes an approved account between editor and admin. */
export const setUserRole = createServerFn({ method: "POST" })
  .middleware([asAdmin])
  .inputValidator(z.object({ id: z.string(), role: assignable }))
  .handler(async ({ data, context }) => {
    const { d, users, target } = await otherUser(data.id, context.user);
    if (target.role === "pending") throw new Error("Approve the account first.");
    await d
      .update(users)
      .set({ role: data.role, updatedAt: new Date() })
      .where(eq(users.id, data.id));
    return { ok: true };
  });

/** Removes someone's Studio access (back to pending) and signs them out everywhere. */
export const removeUserAccess = createServerFn({ method: "POST" })
  .middleware([asAdmin])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const { d, users } = await otherUser(data.id, context.user);
    const { sessions } = await import("./schema");
    await d.batch([
      d
        .update(users)
        .set({ role: "pending", approvedAt: null, updatedAt: new Date() })
        .where(eq(users.id, data.id)),
      d.delete(sessions).where(eq(sessions.userId, data.id)),
    ]);
    return { ok: true };
  });

/**
 * Sets a temporary password for someone (until email password resets exist) and signs them out
 * everywhere; they can change it under Your account.
 */
export const setUserPassword = createServerFn({ method: "POST" })
  .middleware([asAdmin])
  .inputValidator(z.object({ id: z.string(), password: z.string().min(10).max(200) }))
  .handler(async ({ data, context }) => {
    const { d } = await otherUser(data.id, context.user);
    const { accounts, sessions } = await import("./schema");
    const { hashPassword } = await import("./password.server");
    const { newId } = await import("./db.server");
    const hash = await hashPassword(data.password);
    const now = new Date();
    const [existing] = await d
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.userId, data.id), eq(accounts.providerId, "credential")))
      .limit(1);
    await d.batch([
      existing
        ? d
            .update(accounts)
            .set({ password: hash, updatedAt: now })
            .where(eq(accounts.id, existing.id))
        : d.insert(accounts).values({
            id: newId(),
            accountId: data.id,
            providerId: "credential",
            userId: data.id,
            password: hash,
            createdAt: now,
            updatedAt: now,
          }),
      d.delete(sessions).where(eq(sessions.userId, data.id)),
    ]);
    return { ok: true };
  });
