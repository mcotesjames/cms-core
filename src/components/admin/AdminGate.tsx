import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SITE_NAME } from "@/lib/seo";
import { devSignIn, type getMe, setMyName } from "@/data/users";
import { authClient, authError } from "@/lib/auth-client";
import { Logo } from "@/components/SiteChrome";
const MIN_PASSWORD = 10;
import { AdminUserContext, meQuery, useSignOut, type AdminUser } from "./adminUser";

type DevAccounts = NonNullable<Awaited<ReturnType<typeof getMe>>["devAccounts"]>;

const FIELD = "studio-field space-y-1.5 text-sm";

/**
 * Sign in or create an account (Better Auth, email + password). New accounts wait for an admin's
 * approval. In local development the seeded accounts are also offered as one-click shortcuts.
 */
function SignIn({
  signupOpen,
  devAccounts,
}: {
  signupOpen: boolean;
  devAccounts: DevAccounts | null;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [form, setForm] = useState({ first: "", last: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });
  const done = () => qc.invalidateQueries({ queryKey: meQuery.queryKey });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const email = form.email.trim();
    const { error } =
      mode === "in"
        ? await authClient.signIn.email({ email, password: form.password })
        : await authClient.signUp.email({
            email,
            password: form.password,
            name: `${form.first.trim()} ${form.last.trim()}`.trim(),
            firstName: form.first.trim(),
            lastName: form.last.trim(),
          });
    setBusy(false);
    if (error) toast.error(authError(error));
    else await done();
  };

  const devSignInAs = async (id: string) => {
    try {
      await devSignIn({ data: { id } });
      await qc.invalidateQueries();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="studio-sheet w-full max-w-md space-y-8">
        <form onSubmit={submit} className="space-y-4">
          <BrandLogo />
          <h1 className="studio-display">
            {mode === "in" ? "Sign in to the Content Studio" : "Create an account"}
          </h1>
          {mode === "up" && (
            <div className="grid grid-cols-2 gap-3">
              <label className={FIELD}>
                <span>First name</span>
                <Input
                  required
                  autoComplete="given-name"
                  value={form.first}
                  onChange={set("first")}
                />
              </label>
              <label className={FIELD}>
                <span>Last name</span>
                <Input
                  required
                  autoComplete="family-name"
                  value={form.last}
                  onChange={set("last")}
                />
              </label>
            </div>
          )}
          <label className={`block ${FIELD}`}>
            <span>Email</span>
            <Input
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={set("email")}
            />
          </label>
          <label className={`block ${FIELD}`}>
            <span>Password</span>
            <Input
              type="password"
              required
              minLength={mode === "up" ? MIN_PASSWORD : undefined}
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              value={form.password}
              onChange={set("password")}
            />
            {mode === "up" && (
              <span className="block text-xs text-muted-foreground">
                At least {MIN_PASSWORD} characters.
              </span>
            )}
          </label>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "One moment…" : mode === "in" ? "Sign in" : "Create account"}
          </Button>
          {signupOpen && (
            <p className="text-center text-sm text-muted-foreground">
              {mode === "in" ? "New here? " : "Already have an account? "}
              <button
                type="button"
                className="text-foreground underline underline-offset-4"
                onClick={() => setMode(mode === "in" ? "up" : "in")}
              >
                {mode === "in" ? "Create an account" : "Sign in"}
              </button>
            </p>
          )}
          {mode === "up" && (
            <p className="text-xs text-muted-foreground">
              New accounts are approved by an admin before they can use the Content Studio.
            </p>
          )}
          {mode === "in" && (
            <p className="text-xs text-muted-foreground">
              Forgotten your password? Ask an admin to set a temporary one for you.
            </p>
          )}
        </form>
        {devAccounts && devAccounts.length > 0 && (
          <section className="space-y-2 border-t border-border pt-6">
            <h2 className="studio-section-title">Local development shortcuts</h2>
            <p className="text-xs text-muted-foreground">
              Seeded accounts without passwords. Only in <code>npm run dev</code>; never on a
              deployed site.
            </p>
            <ul className="space-y-2">
              {devAccounts.map((a) => (
                <li key={a.id}>
                  <Button
                    variant="outline"
                    className="h-auto w-full justify-between py-2.5"
                    onClick={() => devSignInAs(a.id)}
                  >
                    <span className="text-left">
                      <span className="block">{a.name}</span>
                      <span className="block text-xs text-muted-foreground">{a.email}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{a.role}</span>
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      {children}
    </div>
  );
}

/** Accounts created before names were collected are asked for one, so comments can show who wrote them. */
function NamePrompt({ onSaved }: { onSaved: (first: string, last: string) => void }) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setMyName({ data: { first: first.trim(), last: last.trim() } });
      onSaved(first.trim(), last.trim());
    } catch (err) {
      toast.error((err as Error).message);
    }
  };
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={save} className="w-full max-w-sm space-y-4">
        <BrandLogo />
        <h1 className="studio-display">What's your name?</h1>
        <p className="text-sm text-muted-foreground">
          It's shown on feedback comments, so everyone knows who left them.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Input
            required
            placeholder="First name"
            aria-label="First name"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
          />
          <Input
            required
            placeholder="Last name"
            aria-label="Last name"
            value={last}
            onChange={(e) => setLast(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full">
          Continue
        </Button>
      </form>
    </div>
  );
}

/** The site's wordmark on the sign-in screens (the text logo until a site's own comes from its configuration). */
function BrandLogo() {
  return <Logo className="studio-wordmark block" />;
}

/** Marks a Content Studio screen so the Studio theme in styles.css applies (`:root:has(.studio)`). */
function AdminTheme({ children }: { children?: ReactNode }) {
  return <div className="studio min-h-screen">{children}</div>;
}

/**
 * Signed-in, approved admins only. Anyone can create an account (with first and last name);
 * it can't use the Studio until an admin approves it in Settings → Users.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  return (
    <AdminTheme>
      <AdminAccess>{children}</AdminAccess>
    </AdminTheme>
  );
}

function AdminAccess({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const signOut = useSignOut();
  const { data, isPending } = useQuery(meQuery);
  const user = data?.user ?? null;
  const value = useMemo<AdminUser | null>(
    () =>
      user
        ? {
            id: user.id,
            email: user.email,
            first_name: user.firstName,
            last_name: user.lastName,
            role: user.role,
          }
        : null,
    [user],
  );
  if (isPending) return null;
  if (!user)
    return <SignIn signupOpen={data?.signupOpen ?? true} devAccounts={data?.devAccounts ?? null} />;
  if (user.role === "pending")
    return (
      <Centered>
        <h1 className="studio-display">Waiting for approval</h1>
        <p className="text-muted-foreground">
          Your account ({user.email}) has been created. An admin needs to approve it in Settings →
          Users before you can use the Content Studio.
        </p>
        <Button variant="outline" onClick={signOut}>
          Sign out
        </Button>
      </Centered>
    );
  if (!user.firstName.trim())
    return <NamePrompt onSaved={() => qc.invalidateQueries({ queryKey: meQuery.queryKey })} />;
  return <AdminUserContext.Provider value={value}>{children}</AdminUserContext.Provider>;
}
