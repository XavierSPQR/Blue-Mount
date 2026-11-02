export type AdvanceStatus = "pending" | "approved" | "rejected";

export interface Advance {
  id: string;
  supplierId: string;
  amount: number;
  notes: string;
  status: AdvanceStatus;
  decidedBy: string | null;
  /** Set once approved — approving an advance IS the disbursement, so the deduction is created at the same time. */
  deductionId: string | null;
}
