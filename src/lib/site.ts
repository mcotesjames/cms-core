/**
 * The platform's one way in to the site's configuration. Platform code imports site values from
 * here, never from `src/site/` directly (an ESLint rule enforces it), so a platform update never
 * depends on how one site is built.
 */
import config from "@/site/site.config";

export const site = config;
