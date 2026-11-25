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
            { path: "footer_heading", label: "Heading" },
            { path: "footer_tagline", label: "Text", type: "textarea" },
            { path: "contact_email", label: "Contact email (used by the footer menu's default)" },
          ],
        },
        {
          title: "SEO",
          note: 'Used on every page unless a page sets its own (Page settings in the editor). Leave blank for the defaults: the site name and "— <site name>" after each page\'s title.',
          fields: [
            { path: "seo.site_name", label: "Site name" },
            { path: "seo.title_suffix", label: "Title ending (added after each page's title)" },
            { path: "seo.default_image", label: "Default share image (1200 × 630)", type: "image" },
          ],
        },
      ]}
    />
  );
}
