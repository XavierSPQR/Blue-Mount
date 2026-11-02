import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface CollectionEntryInput {
  supplierId: string;
  collectorId: string;
  date: string;
  gradeId: string;
  quantityKg: number;
  createdBy: string;
}

/** Collection entries are an append-only ledger — no update/delete in the app or the rules (yet). */
export async function addCollectionEntry(input: CollectionEntryInput): Promise<string> {
  const ref = await addDoc(collection(db, "collections"), {
    ...input,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}
