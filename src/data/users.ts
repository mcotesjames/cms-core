/**
 * Studio accounts: who is signed in, names, approval. Sign-in itself is a dev-only placeholder
 * until Better Auth (spec Phase 3): see session.server.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { asAdmin, asEditor, asVisitor, hasRole, type StudioUser } from "./access";

export type Me = {
  user: StudioUser | null;
  /** Seeded accounts to sign in as — only in `vite dev`, where sign-in is a placeholder. */
  devAccounts: { id: string; email: string; name: string; role: string }[] | null;
};

/** The signed-in user (or null), and in dev the accounts that can be signed in as. */
export const getMe = createServerFn({ method: "GET" })
  .middleware([asVisitor])
  .handler(async (): Promise<Me> => {
    const { currentUser } = await import("./session.server");
    const user = await currentUser();
    if (!import.meta.env.DEV) return { user, devAccounts: null };
    const { db } = await import("./db.server");
    const { users } = await import("./schema");
    const rows = await (await db()).select().from(users).orderBy(asc(users.createdAt));
    return {
      user,
      devAccounts: rows.map((r) => ({
        id: r.id,
        email: r.email,
        name: `${r.firstName} ${r.lastName}`.trim() || r.email,
        role: r.role,
      })),
    };
  });

/** Dev only: sign in as a seeded account (`null` signs out). */
export const devSignIn = createServerFn({ method: "POST" })
  .middleware([asVisitor])
  .inputValidator(z.object({ id: z.string().nullable() }))
  .handler(async ({ data }) => {
    if (!import.meta.env.DEV) throw new Error("Sign-in arrives with Better Auth (Phase 3).");
    const { setCookie } = await import("@tanstack/react-start/server");
    const { DEV_USER_COOKIE } = await import("./session.server");
    setCookie(DEV_USER_COOKIE, data.id ?? "none", { path: "/", sameSite: "lax", httpOnly: true });
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
      .set({ firstName: data.first, lastName: data.last })
      .where(eq(users.id, me.id));
    return { ok: true };
  });

export type StudioProfile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
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
      approved: hasRole(r, "editor"),
      created_at: r.createdAt,
    }));
  });

/**
 * Approves an account. Approved accounts get the admin role, as every approved account had
 * before roles were split; choosing editor / admin per user arrives with Phase 3.
 */
export const approveUser = createServerFn({ method: "POST" })
  .middleware([asAdmin])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { db, nowIso } = await import("./db.server");
    const { users } = await import("./schema");
    await (
      await db()
    )
      .update(users)
      .set({ role: "admin", approvedAt: nowIso() })
      .where(eq(users.id, data.id));
    return { ok: true };
  });

/** Removes someone's Studio access (back to pending). Never your own, never the owner's. */
export const removeUserAccess = createServerFn({ method: "POST" })
  .middleware([asAdmin])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    if (data.id === context.user.id) throw new Error("You can't remove your own access.");
    const { db } = await import("./db.server");
    const { users } = await import("./schema");
    const d = await db();
    const [target] = await d.select().from(users).where(eq(users.id, data.id)).limit(1);
    if (target?.role === "owner") throw new Error("The owner's access can't be removed.");
    await d.update(users).set({ role: "pending", approvedAt: null }).where(eq(users.id, data.id));
    return { ok: true };
  });
