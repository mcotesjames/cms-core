import { createFileRoute } from "@tanstack/react-router";
import { DraftForm } from "@/components/admin/DraftForm";

export const Route = createFileRoute("/admin/settings")({ component: Settings });

function Settings() {
  return (
    <DraftForm
      contentKey="settings"
      title="Site settings"
      sections={[
        { title: "Navigation", fields: [{ path: "substack_url", label: "Substack link" }] },
        {
          title: "Footer",
          fields: [
            { path: "footer_heading", label: "Heading" },
            { path: "footer_tagline", label: "Tagline", type: "textarea" },
            { path: "contact_email", label: "Contact email" },
          ],
        },
        {
          title: "Enquiries",
          fields: [{ path: "enquiry_recipient", label: "Enquiry recipient email" }],
        },
        {
          title: "Disclaimers",
          fields: [
            { path: "investments_disclaimer", label: "Investments disclaimer", type: "textarea" },
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
