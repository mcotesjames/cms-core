import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import { physical, rootRoute } from "@tanstack/virtual-file-routes";

/**
 * Vite config for the site: TanStack Start (SSR + server functions), React, Tailwind, and for
 * builds Nitro's Cloudflare preset, which packages everything as a Worker in .output/ with a
 * wrangler.json generated from wrangler.jsonc (spec section 2).
 *
 * In `vite dev` there is no Worker: the data layer reaches a local D1 and R2 through Wrangler's
 * platform proxy (src/data/env.server.ts), so Nitro is only used for builds.
 */
/**
 * Identifies this build: the commit in CI (GITHUB_SHA), otherwise a fresh value per build. The edge
 * cache keys pages by it, so a deploy never serves HTML that points at the previous build's assets.
 */
const BUILD_ID = (process.env["GITHUB_SHA"] ?? `local-${Date.now().toString(36)}`).slice(0, 12);

export default defineConfig(({ command }) => ({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // src/server.ts wraps TanStack Start's server entry with the SSR error page.
      server: { entry: "server" },
      // Platform routes (src/routes) and the site's own routes (src/site/routes) are mounted side
      // by side under one root, so neither folder ever edits the other (spec section 12).
      router: {
        routesDirectory: ".",
        virtualRouteConfig: rootRoute("routes/__root.tsx", [
          physical("", "routes"),
          physical("", "site/routes"),
        ]),
      },
      // Server-only code must never reach the browser bundle.
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    command === "build" &&
      nitro({
        preset: "cloudflare-module",
        cloudflare: { nodeCompat: true, deployConfig: true },
      }),
    viteReact(),
  ],
  css: { transformer: "lightningcss" },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  server: { port: 8080 },
}));
