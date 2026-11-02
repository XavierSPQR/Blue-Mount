"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { DASHBOARD_PATH_BY_ROLE } from "@/types/user";

/** Root route: not a page of its own, just routes to /login or the right role's dashboard. */
export default function Home() {
  const { firebaseUser, appUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.replace("/login");
      return;
    }
    if (appUser) {
      router.replace(appUser.active ? DASHBOARD_PATH_BY_ROLE[appUser.role] : "/login?error=inactive");
    }
  }, [loading, firebaseUser, appUser, router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
      Loading…
    </div>
  );
}
