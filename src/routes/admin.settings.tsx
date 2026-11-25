import { createFileRoute } from "@tanstack/react-router";
import { DraftForm } from "@/components/admin/DraftForm";

export const Route = createFileRoute("/admin/settings")({ component: Settings });

function Settings() {
  return (
    <DraftForm
      contentKey="settings"
      title="Site settings"
      sections={[
        {
          title: "Footer",
          fields: [
            { path: "footer_heading", name: "footer_heading", label: "Heading", type: "text" },
            { path: "footer_tagline", name: "footer_tagline", label: "Text", type: "longText" },
            {
              path: "contact_email",
              name: "contact_email",
              label: "Contact email",
              help: "Used by the footer menu's default Contact link.",
              type: "text",
            },
          ],
        },
        {
          title: "SEO",
          note: 'Used on every page unless a page sets its own (Page settings in the editor). Leave blank for the defaults: the site name and "— <site name>" after each page\'s title.',
          fields: [
            { path: "seo.site_name", name: "site_name", label: "Site name", type: "text" },
            {
              path: "seo.title_suffix",
              name: "title_suffix",
              label: "Title ending",
              help: "Added after each page's title.",
              type: "text",
            },
            {
              path: "seo.default_image",
              name: "default_image",
              label: "Default share image",
              help: "1200 × 630 pixels.",
              type: "image",
            },
          ],
        },
      ]}
    />
  );
}
