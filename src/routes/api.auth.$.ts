import { createFileRoute } from "@tanstack/react-router";

/** Better Auth's endpoints (sign-in, sign-up, sign-out, session, change password): /api/auth/*. */
async function handle({ request }: { request: Request }) {
  const { authFor } = await import("@/data/auth.server");
  return (await authFor(request)).handler(request);
}

export const Route = createFileRoute("/api/auth/$")({
  server: { handlers: { GET: handle, POST: handle } },
});
