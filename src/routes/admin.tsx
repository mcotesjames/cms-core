import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/SiteChrome";
import { AdminGate, adminHead, useSignOut } from "@/components/admin/AdminGate";
import { useComments, useProfiles } from "@/components/admin/useComments";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => adminHead("Admin"),
  component: AdminLayout,
});

const GROUPS = [
  { label: "Feedback", items: [{ to: "/admin/feedback", label: "Feedback" }] },
  { label: "Pages", items: [{ to: "/admin/pages", label: "Pages" }] },
  { label: "Library", items: [{ to: "/admin/media", label: "Media" }] },
  {
    label: "Settings",
    items: [
      { to: "/admin/settings", label: "Site settings" },
      { to: "/admin/users", label: "Users" },
    ],
  },
] as const;

/** Badge after a sidebar link: open comments for the signed-in user, or accounts waiting for approval. */
function Count({ to }: { to: string }) {
  if (to === "/admin/feedback") return <ForYou />;
  if (to === "/admin/users") return <Waiting />;
  return null;
}
function ForYou() {
  const n = useComments().forMe;
  return n ? (
    <span className="studio-count" aria-label={`${n} for you`}>
      {n}
    </span>
  ) : null;
}
function Waiting() {
  const n = useProfiles().list.filter((p) => !p.approved).length;
  return n ? (
    <span className="studio-count" aria-label={`${n} waiting for approval`}>
      {n}
    </span>
  ) : null;
}

function AdminLayout() {
  const signOut = useSignOut();
  return (
    <AdminGate>
      <div className="grid min-h-screen md:grid-cols-[232px_1fr]">
        <aside className="border-b border-border p-6 md:border-b-0 md:border-r">
          <div className="mb-8 flex items-center gap-3">
            <Logo />
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Studio</span>
          </div>
          <nav aria-label="Content Studio" className="space-y-6">
            {GROUPS.map((g) => (
              <div key={g.label}>
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {g.label}
                </p>
                <ul className="space-y-1">
                  {g.items.map((it) => (
                    <li key={it.label}>
                      <Link
                        to={it.to}
                        activeOptions={{ includeSearch: false }}
                        className="flex items-center justify-between gap-2 rounded-sm px-3 py-1.5 text-sm hover:bg-accent data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
                      >
                        {it.label}
                        <Count to={it.to} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <div className="mt-10 space-y-2 text-sm">
            <Link to="/" className="block hover:text-primary">
              View site
            </Link>
            <Button variant="outline" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </aside>
        <main className="min-w-0 p-6 md:p-10">
          <Outlet />
        </main>
      </div>
    </AdminGate>
  );
}
