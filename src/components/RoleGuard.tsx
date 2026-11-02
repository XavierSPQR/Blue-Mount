"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { DASHBOARD_PATH_BY_ROLE, type UserRole } from "@/types/user";

/**
 * Client-side route protection. There's no middleware in a static export
 * (no server to run it), so every role-restricted route tree is wrapped in
 * this guard instead. It's a UX convenience, NOT the security boundary —
 * that's Firestore Security Rules (firestore.rules), which enforce the same
 * role checks server-side regardless of what the client renders.
 */
export function RoleGuard({ role, children }: { role: UserRole; children: ReactNode }) {
  const { firebaseUser, appUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.replace("/login");
      return;
    }
    if (!appUser) {
      router.replace("/login?error=no-profile");
      return;
    }
    if (!appUser.active) {
      // AuthContext also calls signOut() for this case, but that resolves
      // asynchronously — redirect immediately rather than rendering
      // protected content for the moment it takes to land.
      router.replace("/login?error=inactive");
      return;
    }
    if (appUser.role !== role) {
      router.replace(DASHBOARD_PATH_BY_ROLE[appUser.role]);
    }
  }, [loading, firebaseUser, appUser, role, router]);

  const authorized =
    !loading && firebaseUser && appUser && appUser.active && appUser.role === role;

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
