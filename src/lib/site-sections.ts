/**
 * The platform's way in to the site's section components (src/site/sections/index.ts), used only by
 * the page renderer. Separate from lib/site.ts so reading the site's config never loads components,
 * which import platform helpers themselves.
 */
export { sectionComponents as siteSectionComponents } from "@/site/sections";
