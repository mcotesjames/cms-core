import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
const leafRoute = (path: string) => {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
  return router.matchRoutes(path).at(-1)?.routeId;
};

describe("App routing", () => {
  it("matches the homepage for / instead of falling back to not found", () => {
    expect(leafRoute("/")).toBe("/");
  });

  it("serves created pages from their web address", () => {
    expect(leafRoute("/about")).toBe("/$slug");
  });

  it("keeps the sitemap and the Studio on their own routes", () => {
    expect(leafRoute("/sitemap.xml")).not.toBe("/$slug");
    expect(leafRoute("/admin")).not.toBe("/$slug");
    expect(leafRoute("/admin")).not.toBe(rootRouteId);
  });
});
