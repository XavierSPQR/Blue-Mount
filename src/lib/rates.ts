import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface AddRateInput {
  gradeId: string;
  ratePerKg: number;
  effectiveFrom: string;
  setBy: string;
}

export async function addRate(input: AddRateInput): Promise<string> {
  const ref = await addDoc(collection(db, "rateHistory"), { ...input, createdAt: serverTimestamp() });
  return ref.id;
}

/** The rate in effect for a grade on a given date — the entry with the latest effectiveFrom <= date. */
export function findEffectiveRate(
  rates: { gradeId: string; ratePerKg: number; effectiveFrom: string }[],
  gradeId: string,
  date: string,
): number | null {
  let best: { ratePerKg: number; effectiveFrom: string } | null = null;
  for (const r of rates) {
    if (r.gradeId !== gradeId || r.effectiveFrom > date) continue;
    if (!best || r.effectiveFrom > best.effectiveFrom) best = r;
  }
  return best ? best.ratePerKg : null;
}
