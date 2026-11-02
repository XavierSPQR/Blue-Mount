"use client";

import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

export function SignOutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={async () => {
        await signOut(auth);
        router.replace("/login");
      }}
      className="btn btn-secondary btn-sm"
    >
      Sign out
    </button>
  );
}
