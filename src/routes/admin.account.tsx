import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setMyName } from "@/data/users";
import { authClient, authError } from "@/lib/auth-client";
import { meQuery, useAdminUser } from "@/components/admin/adminUser";

export const Route = createFileRoute("/admin/account")({ component: Account });

const MIN_PASSWORD = 10;
const FIELD = "block space-y-1.5 text-sm";

/** The signed-in user's own name and password. */
function Account() {
  const me = useAdminUser();
  const qc = useQueryClient();
  const [name, setName] = useState({ first: me.first_name, last: me.last_name });
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setMyName({ data: { first: name.first.trim(), last: name.last.trim() } });
      await qc.invalidateQueries({ queryKey: meQuery.queryKey });
      toast.success("Name saved");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.next !== pw.confirm) {
      toast.error("The new passwords don't match.");
      return;
    }
    setBusy(true);
    const { error } = await authClient.changePassword({
      currentPassword: pw.current,
      newPassword: pw.next,
      // Anyone else signed in as you (another browser, a shared device) is signed out.
      revokeOtherSessions: true,
    });
    setBusy(false);
    if (error) toast.error(authError(error));
    else {
      setPw({ current: "", next: "", confirm: "" });
      toast.success("Password changed. Other sessions were signed out.");
    }
  };

  return (
    <div className="max-w-md space-y-10">
      <h1 className="text-xl">Your account</h1>
      <p className="text-sm text-muted-foreground">{me.email}</p>

      <form onSubmit={saveName} className="space-y-4">
        <h2 className="text-lg">Name</h2>
        <p className="text-xs text-muted-foreground">Shown on your feedback comments.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className={FIELD}>
            <span>First name</span>
            <Input
              required
              value={name.first}
              onChange={(e) => setName({ ...name, first: e.target.value })}
            />
          </label>
          <label className={FIELD}>
            <span>Last name</span>
            <Input value={name.last} onChange={(e) => setName({ ...name, last: e.target.value })} />
          </label>
        </div>
        <Button type="submit" size="sm">
          Save name
        </Button>
      </form>

      <form onSubmit={changePassword} className="space-y-4">
        <h2 className="text-lg">Password</h2>
        <label className={FIELD}>
          <span>Current password</span>
          <Input
            type="password"
            required
            autoComplete="current-password"
            value={pw.current}
            onChange={(e) => setPw({ ...pw, current: e.target.value })}
          />
        </label>
        <label className={FIELD}>
          <span>New password</span>
          <Input
            type="password"
            required
            minLength={MIN_PASSWORD}
            autoComplete="new-password"
            value={pw.next}
            onChange={(e) => setPw({ ...pw, next: e.target.value })}
          />
          <span className="block text-xs text-muted-foreground">
            At least {MIN_PASSWORD} characters.
          </span>
        </label>
        <label className={FIELD}>
          <span>New password again</span>
          <Input
            type="password"
            required
            minLength={MIN_PASSWORD}
            autoComplete="new-password"
            value={pw.confirm}
            onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
          />
        </label>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "One moment…" : "Change password"}
        </Button>
      </form>
    </div>
  );
}
