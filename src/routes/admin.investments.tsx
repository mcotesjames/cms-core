import { createFileRoute } from "@tanstack/react-router";
import { TableEditor } from "@/components/admin/TableEditor";
import { commentSearch } from "@/lib/comments";
import { INVESTMENT_STAGES, SECTOR_OPTIONS } from "@/lib/investments";

export const Route = createFileRoute("/admin/investments")({
  component: Page,
  validateSearch: commentSearch,
});

function Page() {
  const focus = Route.useSearch();
  return (
    <div>
      <h1 className="mb-8 text-xl">Investments</h1>
      <TableEditor
        table="investments"
        comments="investments"
        focus={focus}
        titleKey="name"
        order="name"
        defaults={{
          name: "",
          sector: "",
          stage: "",
          description: "",
          logo_url: "",
          website_url: "",
          is_placeholder: false,
        }}
        fields={[
          { key: "name", label: "Company name", type: "text" },
          {
            key: "sector",
            label: "Sector (tick all that apply)",
            type: "checkboxes",
            options: [...SECTOR_OPTIONS],
          },
          {
            key: "stage",
            label: "Stage (tick all that apply)",
            type: "checkboxes",
            options: [...INVESTMENT_STAGES],
          },
          { key: "description", label: "Short description", type: "textarea" },
          { key: "logo_url", label: "Company logo", type: "image" },
          { key: "website_url", label: "Company website", type: "text" },
          { key: "is_placeholder", label: "Illustrative placeholder", type: "bool" },
        ]}
      />
    </div>
  );
}
