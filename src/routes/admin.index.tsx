import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * /admin opens on the site's primary list (spec section 4 → Studio dashboard): Pages, since the
 * skeleton site has no content type yet.
 */
export const Route = createFileRoute("/admin/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/pages" });
  },
});
