/**
 * This site's configuration (spec section 9): everything that varies per site. The platform reads
 * it through src/lib/site.ts and checks it with defineSite() when the code loads.
 *
 * Plain data only: section components are registered in ./sections/index.ts.
 *
 * In the platform repo this is the fixture test site: it uses every extension point (a custom
 * section, a custom template, a bespoke route in ./routes, a theme in ./theme.css) so CI proves
 * a site can extend the platform without touching platform files.
 */
import { defineSite } from "@/lib/site-config";

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
        { name: "heading", label: "Heading", type: "text" },
        { name: "text", label: "Text", type: "longText" },
        { name: "button_label", label: "Button label", type: "text" },
        { name: "button_link", label: "Button links to", type: "link" },
      ],
      defaults: {
        heading: "A callout",
        text: "A short message with a button.",
        button_label: "Find out more",
        button_link: { kind: "page", page: "home" },
      },
    },
    // Exercises the richer field types: rich text and a repeating group.
    features: {
      label: "Features",
      repeatable: true,
      fields: [
        { name: "heading", label: "Heading", type: "text", maxLength: 80 },
        { name: "intro", label: "Intro", type: "richText" },
        {
          name: "items",
          label: "Features",
          type: "group",
          min: 1,
          max: 6,
          itemLabel: "title",
          fields: [
            { name: "title", label: "Title", type: "text", required: true },
            { name: "text", label: "Text", type: "longText" },
            { name: "highlight", label: "Highlight", type: "boolean" },
          ],
        },
      ],
      defaults: {
        heading: "What you get",
        items: [
          { id: "f1", title: "Fast", text: "Pages are served from the edge.", highlight: false },
          {
            id: "f2",
            title: "Editable",
            text: "Change anything on the page itself.",
            highlight: true,
          },
          {
            id: "f3",
            title: "Safe",
            text: "Drafts stay private until you publish.",
            highlight: false,
          },
        ],
      },
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
      sections: ["callout", "features", "text", "image"],
    },
  },
});
