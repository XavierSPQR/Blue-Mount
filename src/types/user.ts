export type UserRole = "admin" | "collector" | "supplier";

export interface AppUser {
  uid: string;
  role: UserRole;
  displayName: string;
  /** supplierId / collectorId this account is linked to; unused for admin. */
  linkedId: string;
  active: boolean;
}

export const DASHBOARD_PATH_BY_ROLE: Record<UserRole, string> = {
  admin: "/admin/dashboard",
  collector: "/collector/dashboard",
  supplier: "/supplier/dashboard",
};
