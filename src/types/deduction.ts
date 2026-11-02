export type DeductionType = "fertilizer" | "teaPowder" | "advance";

export interface Deduction {
  id: string;
  supplierId: string;
  type: DeductionType;
  amount: number;
  /** requests/{id} or advances/{id} this deduction was generated from. */
  sourceId: string;
  /** Set once a pay slip (Phase 6) has absorbed this deduction; null = outstanding. */
  appliedToPayslipId: string | null;
}
