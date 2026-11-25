import { createContext, useContext } from "react";

export type AdminUser = { id: string; email: string; first_name: string; last_name: string };

/** The signed-in, approved admin. Provided by AdminGate around every admin screen. */
export const AdminUserContext = createContext<AdminUser | null>(null);

export function useAdminUser(): AdminUser {
  const u = useContext(AdminUserContext);
  if (!u) throw new Error("useAdminUser must be used inside AdminGate");
  return u;
}
