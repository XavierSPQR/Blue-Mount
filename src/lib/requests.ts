import { addDoc, collection, doc, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { RequestType } from "@/types/request";

export interface SubmitRequestInput {
  supplierId: string;
  type: RequestType;
  description: string;
  quantity: number;
}

export async function submitRequest(input: SubmitRequestInput): Promise<string> {
  const ref = await addDoc(collection(db, "requests"), {
    ...input,
    status: "pending",
    requestedAt: serverTimestamp(),
    decidedAt: null,
    decidedBy: null,
    fulfilledAt: null,
    fulfilledBy: null,
    deductionId: null,
  });
  return ref.id;
}

export async function decideRequest(
  id: string,
  status: "approved" | "rejected",
  decidedBy: string,
): Promise<void> {
  await updateDoc(doc(db, "requests", id), { status, decidedAt: serverTimestamp(), decidedBy });
}

/**
 * Marks an approved request as fulfilled (the item was actually handed
 * over) and records its cost as a deduction in the same transaction — the
 * two writes always land together, never one without the other.
 */
export async function fulfillRequest(
  request: { id: string; supplierId: string; type: RequestType },
  amount: number,
  fulfilledBy: string,
): Promise<void> {
  const deductionRef = doc(collection(db, "deductions"));
  const requestRef = doc(db, "requests", request.id);

  await runTransaction(db, async (tx) => {
    tx.set(deductionRef, {
      supplierId: request.supplierId,
      type: request.type,
      amount,
      sourceId: request.id,
      appliedToPayslipId: null,
      createdAt: serverTimestamp(),
    });
    tx.update(requestRef, {
      status: "fulfilled",
      fulfilledAt: serverTimestamp(),
      fulfilledBy,
      deductionId: deductionRef.id,
    });
  });
}
