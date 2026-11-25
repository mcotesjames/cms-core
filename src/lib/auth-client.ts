/**
 * Better Auth's browser client for the Studio's sign-in, sign-up, sign-out and password change.
 * Talks to /api/auth on the same site (src/routes/api.auth.$.ts).
 */
import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  basePath: "/api/auth",
  // The CMS's sign-up fields (src/data/auth.server.ts → user.additionalFields).
  plugins: [
    inferAdditionalFields({
      user: { firstName: { type: "string" }, lastName: { type: "string" } },
    }),
  ],
});

/** Better Auth's error for a failed call, as a sentence for a toast. */
export function authError(
  error: { message?: string | undefined; status?: number | undefined } | null | undefined,
) {
  if (!error) return null;
  if (error.status === 429) return "Too many attempts. Wait a minute and try again.";
  return error.message || "Something went wrong. Try again.";
}
