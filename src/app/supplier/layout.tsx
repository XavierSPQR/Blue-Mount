"use client";

import { RoleGuard } from "@/components/RoleGuard";
import { DashboardShell } from "@/components/DashboardShell";

const NAV_LINKS = [
  { href: "/supplier/dashboard", label: "Dashboard" },
  { href: "/supplier/payslips", label: "Pay Slips" },
  { href: "/supplier/requests", label: "Requests" },
  { href: "/supplier/advances", label: "Advances" },
  { href: "/supplier/deductions", label: "Deductions" },
];

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role="supplier">
      <DashboardShell navLinks={NAV_LINKS}>{children}</DashboardShell>
    </RoleGuard>
  );
}
