import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  approveUser,
  removeUserAccess,
  setUserPassword,
  setUserRole,
  type StudioProfile,
} from "@/data/users";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { profilesQuery, useProfiles } from "@/components/admin/useComments";
import { isAdmin, useAdminUser } from "@/components/admin/adminUser";
import { profileName } from "@/lib/comments";

export const Route = createFileRoute("/admin/users")({ component: Users });

const ROLE_LABEL: Record<string, string> = {
  collaborator: "Collaborator",
  admin: "Admin",
  editor: "Editor",
  pending: "Waiting",
};
const SELECT = "h-8 rounded-lg border border-input bg-[var(--st-card-inset)] px-2 text-sm";
const MIN_PASSWORD = 10;

/**
 * Everyone with an account. New accounts wait here until an admin approves them as an Editor
 * (everything except Users) or an Admin (also this screen). The collaborator, and your own account,
 * can't be changed here.
 */
function Users() {
  const qc = useQueryClient();
  const me = useAdminUser();
  const { list } = useProfiles();
  const [passwordFor, setPasswordFor] = useState<StudioProfile | null>(null);
  if (!isAdmin(me))
    return (
      <div className="max-w-3xl space-y-3">
        <h1>Users</h1>
        <p className="text-sm text-muted-foreground">Only admins can manage users.</p>
      </div>
    );

  const pending = list.filter((p) => !p.approved);
  const approved = list.filter((p) => p.approved);
  const run = async (action: Promise<unknown>, success?: string) => {
    try {
      await action;
      if (success) toast.success(success);
    } catch (e) {
      toast.error((e as Error).message);
    }
    await qc.invalidateQueries({ queryKey: profilesQuery.queryKey });
  };
  const locked = (p: StudioProfile) => p.id === me.id || p.role === "collaborator";

  const Row = ({ p, children }: { p: StudioProfile; children?: React.ReactNode }) => (
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
      <h1>Users</h1>
      <section className="space-y-3">
        <h2 className="studio-section-title">
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
                <Button
                  size="sm"
                  onClick={() =>
                    run(
                      approveUser({ data: { id: p.id, role: "editor" } }),
                      "Approved as an editor",
                    )
                  }
                >
                  Approve as editor
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    run(approveUser({ data: { id: p.id, role: "admin" } }), "Approved as an admin")
                  }
                >
                  Approve as admin
                </Button>
              </Row>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="studio-section-title">Approved</h2>
        <p className="text-sm text-muted-foreground">
          Editors can edit everything in the Content Studio except Users. Admins can also approve
          accounts, change roles and set passwords. Everyone approved can be picked as the person a
          comment is for.
        </p>
        <ul>
          {approved.map((p) => (
            <Row key={p.id} p={p}>
              {locked(p) ? (
                <span className="text-xs text-muted-foreground">{ROLE_LABEL[p.role]}</span>
              ) : (
                <>
                  <select
                    className={SELECT}
                    aria-label={`Role for ${profileName(p)}`}
                    value={p.role}
                    onChange={(e) =>
                      run(
                        setUserRole({
                          data: { id: p.id, role: e.target.value as "editor" | "admin" },
                        }),
                        "Role changed",
                      )
                    }
                  >
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                  <Button size="sm" variant="ghost" onClick={() => setPasswordFor(p)}>
                    Set password
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (
                        confirm(
                          `Remove ${profileName(p)}'s access to the Content Studio? They're signed out everywhere; their comments stay.`,
                        )
                      )
                        void run(removeUserAccess({ data: { id: p.id } }), "Access removed");
                    }}
                  >
                    Remove access
                  </Button>
                </>
              )}
            </Row>
          ))}
        </ul>
      </section>

      {passwordFor && (
        <SetPassword
          who={passwordFor}
          onDone={() => setPasswordFor(null)}
          onSave={(password) =>
            run(
              setUserPassword({ data: { id: passwordFor.id, password } }),
              "Password set. Share it with them privately; they can change it under Your account.",
            ).then(() => setPasswordFor(null))
          }
        />
      )}
    </div>
  );
}

/** A temporary password for someone (until password-reset emails exist). */
function SetPassword({
  who,
  onSave,
  onDone,
}: {
  who: StudioProfile;
  onSave: (password: string) => void;
  onDone: () => void;
}) {
  const [password, setPassword] = useState("");
  return (
    <section className="max-w-md space-y-3 rounded-lg border border-border p-4">
      <h2 className="studio-section-title">Set a temporary password for {profileName(who)}</h2>
      <p className="text-xs text-muted-foreground">
        They'll be signed out everywhere. Share the password privately; they can change it under
        Your account.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(password);
        }}
      >
        <Input
          type="text"
          autoComplete="off"
          aria-label="Temporary password"
          minLength={MIN_PASSWORD}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" size="sm">
          Set
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </form>
    </section>
  );
}
