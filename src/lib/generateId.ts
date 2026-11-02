import { doc, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";

type IdKind = "supplier" | "collector";

const PREFIX: Record<IdKind, string> = { supplier: "SUP", collector: "COL" };

/**
 * Firestore has no auto-increment, so IDs like SUP-0001 are generated via a
 * transaction against a counters/{kind} doc — safe under concurrent admins
 * creating records at the same time (the transaction retries on conflict).
 */
export async function generateSequentialId(kind: IdKind): Promise<string> {
  const counterRef = doc(db, "counters", kind);
  const nextNumber = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = (snap.data()?.lastNumber as number | undefined) ?? 0;
    const next = current + 1;
    tx.set(counterRef, { lastNumber: next }, { merge: true });
    return next;
  });
  return `${PREFIX[kind]}-${String(nextNumber).padStart(4, "0")}`;
}
