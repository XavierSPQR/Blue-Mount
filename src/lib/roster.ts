import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { generateSequentialId } from "@/lib/generateId";

export type RosterCollection = "suppliers" | "collectors";
export type RosterKind = "supplier" | "collector";

export interface RosterFormInput {
  name: string;
  contact: string;
  address: string;
  joinDate: string; // ISO date (yyyy-mm-dd)
}

export interface RosterRecord extends RosterFormInput {
  id: string;
  active: boolean;
  /** Firebase Auth uid this record's login (if any) is linked to. */
  authUid: string | null;
}

/**
 * Suppliers and Collectors share the same registration/edit/status/login
 * shape (see IMPLEMENTATION_PLAN.md Phase 2) — this factory avoids writing
 * near-identical CRUD twice. Behavioral differences between the two roles
 * live in the callers (e.g. who's allowed to read the collection, enforced
 * in firestore.rules).
 */
export function createRosterApi(collectionName: RosterCollection, idKind: RosterKind) {
  async function register(input: RosterFormInput): Promise<string> {
    const id = await generateSequentialId(idKind);
    await setDoc(doc(db, collectionName, id), {
      ...input,
      active: true,
      authUid: null,
      createdAt: serverTimestamp(),
    });
    return id;
  }

  async function update(id: string, input: RosterFormInput): Promise<void> {
    await updateDoc(doc(db, collectionName, id), { ...input });
  }

  async function setActive(id: string, active: boolean): Promise<void> {
    await updateDoc(doc(db, collectionName, id), { active });
  }

  async function linkAuthUid(id: string, authUid: string): Promise<void> {
    await updateDoc(doc(db, collectionName, id), { authUid });
  }

  return { register, update, setActive, linkAuthUid };
}
