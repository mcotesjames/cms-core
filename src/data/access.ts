/**
 * Access checks for every server function (spec section 2 → Data layer): denied by default.
 *
 * Each `createServerFn` in `src/data/` starts its chain with exactly one of these middlewares,
 * `.middleware([asVisitor])` for public reads of live content, or `asEditor` / `asAdmin` /
 * `asOwner` for Studio functions, which run only for a signed-in user with at least that role
 * and receive it as `context.user`. `src/test/server-fns.test.ts` fails if a server function
 * skips them or is defined outside `src/data/`.
 *
 * (The spec's `publicFn(handler)` / `studioFn(role, handler)` are these middlewares: TanStack
 * Start's compiler needs each `createServerFn(…).handler(…)` chain written out in place.)
 */
import { createMiddleware } from "@tanstack/react-start";
import type { Role } from "./schema";

export type StudioUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
};

const RANK: Record<Role, number> = { pending: 0, editor: 1, admin: 2, owner: 3 };
export const hasRole = (user: Pick<StudioUser, "role"> | null | undefined, role: Role) =>
  !!user && RANK[user.role] >= RANK[role];

/** Public reads: live content only, no user. Drafts are never returned from these functions. */
export const asVisitor = createMiddleware({ type: "function" }).server(({ next }) => next());

const requireRole = (role: Role) =>
  createMiddleware({ type: "function" }).server(async ({ next }) => {
    const { currentUser } = await import("./session.server");
    const user = await currentUser();
    if (!hasRole(user, role)) throw new Error("Not allowed");
    return next({ context: { user: user! } });
  });

/** Any approved Studio user (editor and up). */
export const asEditor = requireRole("editor");
/** Admins and the owner: users, owner-only settings. */
export const asAdmin = requireRole("admin");
export const asOwner = requireRole("owner");
