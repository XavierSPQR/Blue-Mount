"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut, type User as FirebaseUser } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { AppUser } from "@/types/user";

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  /** The users/{uid} Firestore profile — role, active flag, etc. Null until loaded, or if the account has no profile doc yet. */
  appUser: AppUser | null;
  /** True until we've resolved BOTH the Auth state and (if signed in) the profile doc. */
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  appUser: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  // uid the profile subscription below has actually resolved data for —
  // compared against firebaseUser.uid to know whether `appUser` is stale
  // (e.g. right after switching accounts, before the new snapshot arrives).
  const [resolvedForUid, setResolvedForUid] = useState<string | null>(null);

  // Track Firebase Auth session.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthResolved(true);
      if (!user) {
        setAppUser(null);
      }
    });
    return unsubscribe;
  }, []);

  // Track the matching users/{uid} profile doc (role, active status).
  useEffect(() => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    const ref = doc(db, "users", uid);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Omit<AppUser, "uid">;
          setAppUser({ uid, ...data });
          // An admin can deactivate an account (e.g. a former supplier);
          // enforce it immediately rather than waiting for next login.
          if (data.active === false) {
            void signOut(auth);
          }
        } else {
          // Authenticated but no profile doc — e.g. mid-provisioning, or
          // an account that was never linked. Treat as "not provisioned".
          setAppUser(null);
        }
        setResolvedForUid(uid);
      },
      () => {
        // Rules denied the read (shouldn't normally happen for one's own doc).
        setAppUser(null);
        setResolvedForUid(uid);
      },
    );
    return unsubscribe;
  }, [firebaseUser]);

  const loading = !authResolved || (!!firebaseUser && resolvedForUid !== firebaseUser.uid);

  return (
    <AuthContext.Provider value={{ firebaseUser, appUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
