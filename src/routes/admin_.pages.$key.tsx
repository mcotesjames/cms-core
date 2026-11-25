import { createFileRoute, notFound } from "@tanstack/react-router";
import { AdminGate, adminHead } from "@/components/admin/AdminGate";
import { PageCanvas } from "@/components/admin/PageCanvas";
import { isPageKey, type PageKey } from "@/lib/page-sections";
import { commentSearch } from "@/lib/comments";

export const Route = createFileRoute("/admin_/pages/$key")({
  ssr: false,
  loader: ({ params }) => {
    if (!isPageKey(params.key)) throw notFound();
  },
  head: () => adminHead("Edit page"),
  validateSearch: commentSearch,
  component: EditPage,
});

function EditPage() {
  const { key } = Route.useParams();
  const { comment, device, mode } = Route.useSearch();
  return (
    <AdminGate>
      <PageCanvas
        key={key}
        pageKey={key as PageKey}
        focusComment={comment}
        initial={{ device, commenting: mode === "comment" }}
      />
    </AdminGate>
  );
}
