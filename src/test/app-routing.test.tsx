import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { NAV_LINKS } from "@/components/SiteChrome";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("matches a page for /publications", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/publications");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });
});

describe("Main navigation", () => {
  it("offers only Investments, Publications and Insights before the Substack button", () => {
    expect(NAV_LINKS.map((link) => link.label)).toEqual([
      "Investments",
      "Publications",
      "Insights",
    ]);
    expect(NAV_LINKS.map((link) => link.to)).toEqual([
      "/investments",
      "/publications",
      "/insights",
    ]);
  });
});
