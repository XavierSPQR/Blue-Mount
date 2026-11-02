import { deleteApp, initializeApp, type FirebaseOptions } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { UserRole } from "@/types/user";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export interface CreateLinkedUserInput {
  email: string;
  tempPassword: string;
  role: UserRole;
  displayName: string;
  /** supplierId / collectorId this login is linked to. */
  linkedId: string;
}

/**
 * Lets a signed-in Admin create a brand-new Supplier/Collector login
 * WITHOUT losing their own session.
 *
 * `createUserWithEmailAndPassword` signs in as the new user on whatever
 * Auth instance you call it on. We're on the Spark (free) plan with no
 * Cloud Functions, so there's no Admin SDK to do this server-side instead.
 * The workaround: spin up a second, throwaway Firebase App + Auth instance,
 * create the account there (signing in the secondary instance only), write
 * the Firestore profile doc using the PRIMARY app's `db` (still
 * authenticated as the admin, since only the secondary instance's session
 * changed), then tear the secondary instance down entirely.
 */
export async function createLinkedUser(input: CreateLinkedUserInput): Promise<string> {
  const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      input.email,
      input.tempPassword,
    );
    const uid = credential.user.uid;

    // Written via the primary `db` — i.e. as the admin, per Firestore rules.
    await setDoc(doc(db, "users", uid), {
      role: input.role,
      displayName: input.displayName,
      linkedId: input.linkedId,
      active: true,
      createdAt: serverTimestamp(),
    });

    await signOut(secondaryAuth);
    return uid;
  } finally {
    await deleteApp(secondaryApp);
  }
}
