import { createContext, useContext } from "react";
import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { devSignIn, getMe } from "@/data/users";
import { SITE_NAME } from "@/lib/seo";

export type AdminUser = { id: string; email: string; first_name: string; last_name: string };

/** The signed-in, approved admin. Provided by AdminGate around every admin screen. */
export const AdminUserContext = createContext<AdminUser | null>(null);

export function useAdminUser(): AdminUser {
  const u = useContext(AdminUserContext);
  if (!u) throw new Error("useAdminUser must be used inside AdminGate");
  return u;
}

/** Who is signed in (and, in dev, the accounts to sign in as). */
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

/** The <head> of every Studio screen: titled, never indexed. */
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
