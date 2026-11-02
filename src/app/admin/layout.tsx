"use client";

import { RoleGuard } from "@/components/RoleGuard";
import { DashboardShell, type NavLink } from "@/components/DashboardShell";
import { useAuth } from "@/context/AuthContext";
import { useAllRequests } from "@/hooks/useRequests";
import { useAllAdvances } from "@/hooks/useAdvances";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Pending counts surface on the nav itself so "something needs a decision"
  // is visible without opening Requests/Advances to check. Gated on the
  // confirmed admin role so a session that isn't admin yet (or never will
  // be) never opens a listener Firestore rules would just reject.
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin" && appUser.active;
  const { requests } = useAllRequests(isAdmin);
  const { advances } = useAllAdvances(isAdmin);
  const pendingRequests = requests.filter((r) => r.status === "pending").length;
  const pendingAdvances = advances.filter((a) => a.status === "pending").length;

  // Grouped into clusters (roster / pricing / money flow) rather than one
  // flat row of nine links — `newGroup` draws a divider before that link.
  const navLinks: NavLink[] = [
    { href: "/admin/dashboard", label: "Dashboard" },
    { href: "/admin/suppliers", label: "Suppliers", newGroup: true },
    { href: "/admin/collectors", label: "Collectors" },
    { href: "/admin/grades", label: "Grades", newGroup: true },
    { href: "/admin/rates", label: "Rates" },
    { href: "/admin/requests", label: "Requests", badge: pendingRequests, newGroup: true },
    { href: "/admin/advances", label: "Advances", badge: pendingAdvances },
    { href: "/admin/deductions", label: "Deductions" },
    { href: "/admin/payslips", label: "Pay Slips" },
  ];

  return (
    <RoleGuard role="admin">
      <DashboardShell navLinks={navLinks}>{children}</DashboardShell>
    </RoleGuard>
  );
}
