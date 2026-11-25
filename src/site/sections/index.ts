import type { ComponentType } from "react";
import type { SiteSectionProps } from "@/lib/site-config";
import { Callout } from "./Callout";
import { Features } from "./Features";
import { Team } from "./Team";

/**
 * This site's section components, keyed like site.config.ts `sections` (a test checks every
 * declared section has one). Rendered by the platform on the live site and in the Studio canvas;
 * each must hide its empty fields (useShow).
 */
export const sectionComponents: Record<string, ComponentType<SiteSectionProps>> = {
  callout: Callout,
  features: Features,
  team: Team,
};
