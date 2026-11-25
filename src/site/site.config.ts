/**
 * This site's configuration (spec section 9): everything that varies per site. The platform reads
 * it through src/lib/site.ts and checks it with defineSite() when the code loads.
 *
 * In the platform repo this is the fixture test site: it uses every extension point (a custom
 * section, a custom template, a bespoke route in ./routes, a theme in ./theme.css) so CI proves
 * a site can extend the platform without touching platform files.
 */
import { defineSite } from "@/lib/site-config";
import { Callout } from "./sections/Callout";

export default defineSite({
  name: "MCJames",
  url: "https://mcotesjames.com",
  brand: { wordmark: "MCJames" },
  media: { maxDimension: 2400, quality: 0.82 },
  menus: {
    footerColumns: 3,
    mainMax: 5,
    // Used until the Studio edits the menus.
    defaults: (settings) => ({
      main: [{ id: "m-home", label: "Home", target: { kind: "page", page: "home" } }],
      footer: [
        {
          id: "c-contact",
          heading: "Contact",
          links: [
            {
              id: "f-email",
              label: settings?.contact_email ?? "",
              target: { kind: "email", email: settings?.contact_email ?? "" },
            },
          ],
        },
      ],
    }),
  },
  sections: {
    callout: {
      label: "Callout",
      repeatable: true,
      fields: [
        { name: "heading", label: "Heading" },
        { name: "text", label: "Text", multi: true },
        { name: "button_label", label: "Button label" },
        { name: "button_url", label: "Button link (https://… or /page)" },
      ],
      defaults: {
        heading: "A callout",
        text: "A short message with a button.",
        button_label: "Find out more",
        button_url: "",
      },
      component: Callout,
    },
  },
  // The site's own routes (src/site/routes): Studio pages can't take these addresses.
  routes: ["styleguide"],
  templates: {
    landing: {
      label: "Landing",
      description: "No page hero: starts with a Callout, then callouts, text and images.",
      hero: false,
      required: ["callout"],
      sections: ["callout", "text", "image"],
    },
  },
});
