"use client";

import { RoleGuard } from "@/components/RoleGuard";
import { DashboardShell } from "@/components/DashboardShell";

const NAV_LINKS = [
  { href: "/collector/dashboard", label: "Dashboard" },
  { href: "/collector/collections/add", label: "Add Collection" },
  { href: "/collector/collections", label: "History" },
  { href: "/collector/suppliers", label: "Suppliers" },
];

export default function CollectorLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role="collector">
      <DashboardShell navLinks={NAV_LINKS}>{children}</DashboardShell>
    </RoleGuard>
  );
}
