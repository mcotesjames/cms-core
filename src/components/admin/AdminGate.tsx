import { useMemo, useState, type ReactNode } from "react";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SITE_NAME } from "@/lib/seo";
import { devSignIn, getMe, setMyName } from "@/data/users";
import { Logo } from "@/components/SiteChrome";
import { AdminUserContext, type AdminUser } from "./adminUser";

export const meQuery = queryOptions({ queryKey: ["admin", "me"], queryFn: () => getMe() });

/** Signs out (dev placeholder) and returns to the sign-in screen. */
export function useSignOut() {
  const qc = useQueryClient();
  return async () => {
    await devSignIn({ data: { id: null } });
    // Refetch who's signed in first (the gate swaps to the sign-in screen), then drop the
    // previous user's Studio data so nothing of theirs is shown to the next one.
    await qc.invalidateQueries({ queryKey: meQuery.queryKey });
    qc.removeQueries({ predicate: (q) => q.queryKey[0] === "admin" && q.queryKey[1] !== "me" });
  };
}

/**
 * Sign-in placeholder until Better Auth (spec Phase 3). In `vite dev` you sign in as one of the
 * seeded accounts (db/seed.sql); a built site has no sign-in yet, so the Studio stays closed.
 */
function SignIn({
  accounts,
}: {
  accounts: NonNullable<Awaited<ReturnType<typeof getMe>>["devAccounts"]> | null;
}) {
  const qc = useQueryClient();
  const signIn = async (id: string) => {
    try {
      await devSignIn({ data: { id } });
      await qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  if (!accounts)
    return (
      <Centered>
        <BrandLogo />
        <h1 className="text-lg">The Content Studio is closed</h1>
        <p className="text-muted-foreground">
          Sign-in isn't available on this site yet. It arrives with the next release.
        </p>
      </Centered>
    );
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-4">
        <BrandLogo />
        <h1 className="text-lg">Sign in to the Content Studio</h1>
        <p className="text-sm text-muted-foreground">
          Local development: choose a seeded account. Real sign-in arrives with Better Auth.
        </p>
        <ul className="space-y-2">
          {accounts.map((a) => (
            <li key={a.id}>
              <Button
                variant="outline"
                className="h-auto w-full justify-between py-3"
                onClick={() => signIn(a.id)}
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

/** The site's wordmark on the sign-in screens (the text logo until a site's own comes from its configuration). */
function BrandLogo() {
  return <Logo className="block" />;
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
  const qc = useQueryClient();
  const signOut = useSignOut();
  const { data, isPending } = useQuery(meQuery);
  const user = data?.user ?? null;
  const value = useMemo<AdminUser | null>(
    () =>
      user
        ? { id: user.id, email: user.email, first_name: user.firstName, last_name: user.lastName }
        : null,
    [user],
  );
  if (isPending) return null;
  if (!user) return <SignIn accounts={data?.devAccounts ?? null} />;
  if (user.role === "pending")
    return (
      <Centered>
        <h1 className="text-lg">Waiting for approval</h1>
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
