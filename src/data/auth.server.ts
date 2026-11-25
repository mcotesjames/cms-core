/**
 * Sign-in (spec section 2 → Auth): Better Auth on the site's own D1 database, email + password.
 * Server-only; only src/data/ and the /api/auth route use it.
 *
 * - Built per request: the D1 binding and the site's address come from the request, so the same
 *   code runs on localhost, staging and production.
 * - Sign-up creates a `pending` user; the CMS (Users screen) approves it and sets its role.
 *   Sign-up never sets `role` or `approvedAt`.
 * - Sessions are HTTP-only cookies (Secure on https). Sign-in and sign-up are rate-limited per
 *   IP (Cloudflare's `cf-connecting-ip`), counted in D1 so the limit holds across Workers.
 * - The collaborator (the site's developer) gets in without waiting: the first sign-up whose email
 *   matches `COLLABORATOR_EMAIL` is approved as collaborator automatically, as long as the site
 *   has no collaborator yet. Anyone else, including a stranger who finds a new site first, waits.
 * - Secrets: `BETTER_AUTH_SECRET` and `COLLABORATOR_EMAIL` (Worker secrets; `.dev.vars` locally).
 *   `SIGNUP_OPEN=false` turns sign-up off (invite-only).
 */
import { betterAuth } from "better-auth";
import { eq } from "drizzle-orm";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bindings } from "./env.server";
import { db as getDb, nowIso } from "./db.server";
import { hashPassword, verifyPassword } from "./password.server";
import { accounts, rateLimits, sessions, users, verifications } from "./schema";

export const MIN_PASSWORD = 10;

export async function authFor(request: Request) {
  const env = await bindings();
  if (!env.BETTER_AUTH_SECRET) throw new Error("BETTER_AUTH_SECRET is not set for this site.");
  const origin = new URL(request.url).origin;
  return betterAuth({
    appName: "Content Studio",
    baseURL: origin,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [origin],
    database: drizzleAdapter(await getDb(), {
      provider: "sqlite",
      schema: { users, sessions, accounts, verifications, rateLimits },
    }),
    user: {
      modelName: "users",
      additionalFields: {
        firstName: { type: "string", required: true },
        lastName: { type: "string", required: true },
      },
    },
    session: { modelName: "sessions" },
    account: { modelName: "accounts" },
    verification: { modelName: "verifications" },
    emailAndPassword: {
      enabled: true,
      disableSignUp: env.SIGNUP_OPEN === "false",
      minPasswordLength: MIN_PASSWORD,
      maxPasswordLength: 200,
      autoSignIn: true,
      password: { hash: hashPassword, verify: verifyPassword },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "rateLimits",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 3600, max: 5 },
        "/change-password": { window: 60, max: 5 },
      },
    },
    databaseHooks: {
      user: { create: { after: (user) => grantCollaborator(user, env.COLLABORATOR_EMAIL) } },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"] },
      useSecureCookies: origin.startsWith("https://"),
    },
  });
}

/** Approves a new account as collaborator if it's the site's collaborator email and none exists yet. */
async function grantCollaborator(user: { id: string; email: string }, email: string | undefined) {
  if (!email || user.email.trim().toLowerCase() !== email.trim().toLowerCase()) return;
  const d = await getDb();
  const [existing] = await d
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "collaborator"))
    .limit(1);
  if (existing) return;
  await d
    .update(users)
    .set({ role: "collaborator", approvedAt: nowIso() })
    .where(eq(users.id, user.id));
}

/** The signed-in user's id for this request, or null. */
export async function sessionUserId(request: Request): Promise<string | null> {
  const auth = await authFor(request);
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user.id ?? null;
}
