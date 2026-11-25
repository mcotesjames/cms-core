import { createFileRoute } from "@tanstack/react-router";
import { TableEditor } from "@/components/admin/TableEditor";
import { commentSearch } from "@/lib/comments";
import { PUBLICATION_TYPES } from "@/lib/publications";

export const Route = createFileRoute("/admin/publications")({
  component: Page,
  validateSearch: commentSearch,
});

const YEARS = Array.from({ length: 30 }, (_, i) => String(new Date().getFullYear() - i));
const MONTHS = ["", ...Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"))];

function Page() {
  const focus = Route.useSearch();
  return (
    <div>
      <h1 className="mb-8 text-xl">Publications</h1>
      <TableEditor
        table="publications"
        comments="publications"
        focus={focus}
        titleKey="title"
        defaults={{
          title: "",
          kind: "Paper",
          outlet: "",
          year: String(new Date().getFullYear()),
          month: "",
          coauthors: "",
          summary: "",
          url: "",
          featured: false,
          is_placeholder: false,
        }}
        fields={[
          { key: "title", label: "Title", type: "text" },
          { key: "kind", label: "Type", type: "select", options: PUBLICATION_TYPES },
          { key: "outlet", label: "Outlet / publisher", type: "text" },
          { key: "year", label: "Year", type: "select", options: YEARS },
          { key: "month", label: "Month (optional)", type: "select", options: MONTHS },
          { key: "coauthors", label: "Co-authors (optional)", type: "text" },
          { key: "summary", label: "One-line summary (optional)", type: "textarea" },
          { key: "url", label: "Link to the piece", type: "text" },
          { key: "featured", label: "Pin to Selected work", type: "bool" },
          { key: "is_placeholder", label: "Illustrative placeholder", type: "bool" },
        ]}
      />
    </div>
  );
}
