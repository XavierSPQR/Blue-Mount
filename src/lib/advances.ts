import { addDoc, collection, doc, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface SubmitAdvanceInput {
  supplierId: string;
  amount: number;
  notes: string;
}

export async function submitAdvance(input: SubmitAdvanceInput): Promise<string> {
  const ref = await addDoc(collection(db, "advances"), {
    ...input,
    status: "pending",
    createdAt: serverTimestamp(),
    decidedAt: null,
    decidedBy: null,
    deductionId: null,
  });
  return ref.id;
}

export async function rejectAdvance(id: string, decidedBy: string): Promise<void> {
  await updateDoc(doc(db, "advances", id), {
    status: "rejected",
    decidedAt: serverTimestamp(),
    decidedBy,
  });
}

/**
 * Approving an advance IS the disbursement — unlike a fertilizer/tea-powder
 * request (which needs a separate later "fulfilled" step once the physical
 * item is handed over), the money changes hands at approval time, so the
 * deduction is created in the same transaction as the approval itself.
 */
export async function approveAdvance(
  advance: { id: string; supplierId: string; amount: number },
  decidedBy: string,
): Promise<void> {
  const deductionRef = doc(collection(db, "deductions"));
  const advanceRef = doc(db, "advances", advance.id);

  await runTransaction(db, async (tx) => {
    tx.set(deductionRef, {
      supplierId: advance.supplierId,
      type: "advance",
      amount: advance.amount,
      sourceId: advance.id,
      appliedToPayslipId: null,
      createdAt: serverTimestamp(),
    });
    tx.update(advanceRef, {
      status: "approved",
      decidedAt: serverTimestamp(),
      decidedBy,
      deductionId: deductionRef.id,
    });
  });
}
