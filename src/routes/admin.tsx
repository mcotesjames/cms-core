import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import {
  CircleUser,
  Database,
  ExternalLink,
  Image,
  LayoutTemplate,
  LogOut,
  MessageSquare,
  Settings,
  Users,
} from "lucide-react";
import { Logo } from "@/components/SiteChrome";
import { AdminGate } from "@/components/admin/AdminGate";
import { adminHead, isAdmin, useAdminUser, useSignOut } from "@/components/admin/adminUser";
import { useComments, useProfiles } from "@/components/admin/useComments";
import { recordTypes } from "@/lib/records";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => adminHead("Admin"),
  component: AdminLayout,
});

const GROUPS = [
  {
    label: "Feedback",
    items: [{ to: "/admin/feedback", label: "Feedback", icon: MessageSquare }],
  },
  { label: "Pages", items: [{ to: "/admin/pages", label: "Pages", icon: LayoutTemplate }] },
  { label: "Library", items: [{ to: "/admin/media", label: "Media", icon: Image }] },
  {
    label: "Settings",
    items: [
      { to: "/admin/settings", label: "Global settings", icon: Settings },
      { to: "/admin/users", label: "Users", icon: Users, adminOnly: true },
      { to: "/admin/account", label: "Your account", icon: CircleUser },
    ],
  },
] as const;

type NavItem = { to: string; label: string; icon: typeof Database; adminOnly?: boolean };

/** The sidebar groups, with a Records group listing the site's record types (when it has any). */
function groups(): Array<{ label: string; items: readonly NavItem[] }> {
  const types = recordTypes();
  if (!types.length) return [...GROUPS];
  const records = {
    label: "Records",
    items: types.map((t) => ({ to: `/admin/records/${t.key}`, label: t.plural, icon: Database })),
  };
  return [...GROUPS.slice(0, 2), records, ...GROUPS.slice(2)];
}

/** Badge after a sidebar link: open comments for the signed-in user, or accounts waiting for approval. */
function Count({ to }: { to: string }) {
  if (to === "/admin/feedback") return <ForYou />;
  if (to === "/admin/users") return <Waiting />;
  return null;
}
function ForYou() {
  const n = useComments().forMe;
  return n ? (
    <span className="studio-count studio-count-comment" aria-label={`${n} for you`}>
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
  return (
    <AdminGate>
      <div className="grid min-h-screen md:grid-cols-[240px_1fr]">
        <Sidebar />
        <main className="studio-main min-w-0">
          <div className="studio-card">
            <Outlet />
          </div>
        </main>
      </div>
    </AdminGate>
  );
}

/** The Studio sidebar, on the canvas. Users is shown to admins only (editors can't manage accounts). */
function Sidebar() {
  const signOut = useSignOut();
  const me = useAdminUser();
  return (
    <aside className="studio-sidebar">
      <div className="studio-site">
        <Logo className="studio-wordmark" />
      </div>
      <nav aria-label="Content Studio">
        {groups().map((g) => (
          <div key={g.label} className="studio-group">
            <p className="studio-caption">{g.label}</p>
            <ul className="space-y-px">
              {g.items
                .filter((it) => !("adminOnly" in it && it.adminOnly) || isAdmin(me))
                .map((it) => (
                  <li key={it.label}>
                    <Link
                      to={it.to}
                      activeOptions={{ includeSearch: false }}
                      className="studio-nav-link"
                    >
                      <it.icon aria-hidden="true" />
                      {it.label}
                      <Count to={it.to} />
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="studio-group border-t border-border pt-4">
        <p className="studio-help mb-1 truncate px-2">Signed in as {me.first_name || me.email}</p>
        <Link to="/" className="studio-nav-link">
          <ExternalLink aria-hidden="true" />
          View site
        </Link>
        <button type="button" onClick={signOut} className="studio-nav-link w-full">
          <LogOut aria-hidden="true" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
