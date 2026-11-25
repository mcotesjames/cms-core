import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SITE_NAME } from "@/lib/seo";
import brandLogo from "@/assets/brand/wordmark-dark.svg";
import { AdminUserContext, type AdminUser } from "./adminUser";

function SignIn() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [form, setForm] = useState({ first: "", last: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
        : await supabase.auth.signUp({
            email: form.email,
            password: form.password,
            options: {
              data: { first_name: form.first.trim(), last_name: form.last.trim() },
              emailRedirectTo: `${window.location.origin}/admin`,
            },
          });
    setBusy(false);
    if (error) toast.error(error.message);
    else if (mode === "up") setSent(true);
  };
  if (sent)
    return (
      <Centered>
        <BrandLogo />
        <h1 className="text-lg">Check your email</h1>
        <p className="text-muted-foreground">
          We've sent a link to {form.email} to confirm your account. After that, an admin needs to
          approve it before you can use the Content Studio.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setSent(false);
            setMode("in");
          }}
        >
          Back to sign in
        </Button>
      </Centered>
    );
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <BrandLogo />
        <h1 className="text-lg">
          {mode === "in" ? "Sign in to the Content Studio" : "Create an account"}
        </h1>
        {mode === "up" && (
          <div className="grid grid-cols-2 gap-3">
            <Input
              required
              placeholder="First name"
              aria-label="First name"
              autoComplete="given-name"
              value={form.first}
              onChange={set("first")}
            />
            <Input
              required
              placeholder="Last name"
              aria-label="Last name"
              autoComplete="family-name"
              value={form.last}
              onChange={set("last")}
            />
          </div>
        )}
        <Input
          type="email"
          required
          placeholder="Email"
          aria-label="Email"
          autoComplete="email"
          value={form.email}
          onChange={set("email")}
        />
        <Input
          type="password"
          required
          minLength={mode === "up" ? 8 : undefined}
          placeholder="Password"
          aria-label="Password"
          autoComplete={mode === "in" ? "current-password" : "new-password"}
          value={form.password}
          onChange={set("password")}
        />
        <Button type="submit" className="w-full" disabled={busy}>
          {mode === "in" ? "Sign in" : "Create account"}
        </Button>
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
        {mode === "up" && (
          <p className="text-xs text-muted-foreground">
            New accounts are approved by an admin before they can use the Content Studio.
          </p>
        )}
      </form>
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
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ first_name: first.trim(), last_name: last.trim() })
      .eq("id", data.user.id);
    if (error) toast.error(error.message);
    else onSaved(first.trim(), last.trim());
  };
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={save} className="w-full max-w-sm space-y-4">
        <BrandLogo />
        <h1 className="text-lg">What's your name?</h1>
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

/** The site wordmark (the one used in the site footer), shown white on the dark Studio screens. */
function BrandLogo() {
  return <img src={brandLogo} alt={SITE_NAME} className="block h-auto w-32 brightness-0 invert" />;
}

/** Marks a Content Studio screen so the admin dark theme in styles.css applies (`:root:has(.studio)`). */
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
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<{ first_name: string; last_name: string } | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      if (data.user) {
        const [{ data: r }, { data: p }] = await Promise.all([
          supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" }),
          supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", data.user.id)
            .maybeSingle(),
        ]);
        setIsAdmin(!!r);
        setProfile(p ?? { first_name: "", last_name: "" });
      } else setIsAdmin(null);
      setReady(true);
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange((ev) => {
      if (ev === "SIGNED_IN" || ev === "SIGNED_OUT" || ev === "USER_UPDATED") check();
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  const value = useMemo<AdminUser | null>(
    () => (user && profile ? { id: user.id, email: user.email ?? "", ...profile } : null),
    [user, profile],
  );
  if (!ready) return null;
  if (!user) return <SignIn />;
  if (!isAdmin)
    return (
      <Centered>
        <h1 className="text-lg">Waiting for approval</h1>
        <p className="text-muted-foreground">
          Your account ({user.email}) has been created. An admin needs to approve it in Settings →
          Users before you can use the Content Studio.
        </p>
        <Button variant="outline" onClick={() => supabase.auth.signOut()}>
          Sign out
        </Button>
      </Centered>
    );
  if (profile && !profile.first_name.trim())
    return (
      <NamePrompt onSaved={(first_name, last_name) => setProfile({ first_name, last_name })} />
    );
  return <AdminUserContext.Provider value={value}>{children}</AdminUserContext.Provider>;
}

export const adminHead = (title: string) => ({
  meta: [
    { title: `${title} — Content Studio` },
    { name: "description", content: `${SITE_NAME} content administration.` },
    { property: "og:title", content: `${title} — Content Studio` },
    { property: "og:description", content: `${SITE_NAME} content administration.` },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ],
});
