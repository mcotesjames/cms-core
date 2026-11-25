import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { profilesQuery, useProfiles } from "@/components/admin/useComments";
import { useAdminUser } from "@/components/admin/adminUser";
import { profileName } from "@/lib/comments";

export const Route = createFileRoute("/admin/users")({ component: Users });

/** Everyone who has signed up. New accounts wait here until an admin approves them. */
function Users() {
  const qc = useQueryClient();
  const me = useAdminUser();
  const { list } = useProfiles();
  const pending = list.filter((p) => !p.approved);
  const approved = list.filter((p) => p.approved);
  const refresh = () => qc.invalidateQueries({ queryKey: profilesQuery.queryKey });
  const approve = async (id: string) => {
    const { error } = await supabase.from("user_roles").insert({ user_id: id, role: "admin" });
    if (error) toast.error(error.message);
    else toast.success("Approved — they can now use the Content Studio");
    refresh();
  };
  const removeAccess = async (id: string, name: string) => {
    if (!confirm(`Remove ${name}'s access to the Content Studio? Their comments stay.`)) return;
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", id)
      .eq("role", "admin");
    if (error) toast.error(error.message);
    refresh();
  };
  const Row = ({ p, children }: { p: (typeof list)[number]; children?: React.ReactNode }) => (
    <li className="flex flex-wrap items-center gap-3 border-b border-border py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          {profileName(p)} {p.id === me.id && <span className="text-muted-foreground">(you)</span>}
        </p>
        <p className="truncate text-xs text-muted-foreground">{p.email}</p>
      </div>
      {children}
    </li>
  );
  return (
    <div className="max-w-3xl space-y-10">
      <h1 className="text-xl">Users</h1>
      <section className="space-y-3">
        <h2 className="text-lg">
          Waiting for approval{" "}
          {pending.length > 0 && <Badge className="ml-2">{pending.length}</Badge>}
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No one is waiting. New sign-ups appear here.
          </p>
        ) : (
          <ul>
            {pending.map((p) => (
              <Row key={p.id} p={p}>
                <Button size="sm" onClick={() => approve(p.id)}>
                  Approve
                </Button>
              </Row>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg">Approved</h2>
        <p className="text-sm text-muted-foreground">
          Approved users can edit everything in the Content Studio and can be picked as the person a
          comment is for.
        </p>
        <ul>
          {approved.map((p) => (
            <Row key={p.id} p={p}>
              {p.id !== me.id && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => removeAccess(p.id, profileName(p))}
                >
                  Remove access
                </Button>
              )}
            </Row>
          ))}
        </ul>
      </section>
    </div>
  );
}
