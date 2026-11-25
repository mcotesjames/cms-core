import { lazy, Suspense } from "react";
import { ClientOnly, useRouterState } from "@tanstack/react-router";
import { hasPageBackground } from "@/lib/background-ready";

const FluidBackground = lazy(() => import("@/components/FluidBackground"));

/**
 * The WebGL gradient behind every public page. Rendered once in the root
 * layout (never inside a route) so it keeps running across route changes
 * instead of rebuilding its canvas, which showed the static CSS gradient
 * until the new canvas painted.
 */
export function PageBackground() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (!hasPageBackground(pathname)) return null;
  return (
    <div className="site-gradient-background fixed inset-0 -z-10" aria-hidden="true">
      <ClientOnly fallback={null}>
        <Suspense fallback={null}>
          <FluidBackground />
        </Suspense>
      </ClientOnly>
    </div>
  );
}
