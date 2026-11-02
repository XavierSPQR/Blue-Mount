import type { Timestamp } from "firebase/firestore";
import type { RequestType } from "@/types/request";

export interface PayslipGradeLine {
  gradeId: string;
  gradeName: string;
  quantityKg: number;
  amount: number;
}

export interface PayslipDeductionLine {
  deductionId: string;
  type: RequestType | "advance";
  amount: number;
}

/**
 * A pay slip is a point-in-time snapshot, not a live view — it carries its
 * own copy of supplier name, grade names, and every line's amount, so it
 * stays correct forever even if the supplier is renamed, a grade is
 * renamed, or rates change later. Once written it's never edited (see
 * firestore.rules); a correction is a new pay slip, not a silent update.
 */
export interface Payslip {
  id: string;
  supplierId: string;
  supplierName: string;
  periodStart: string;
  periodEnd: string;
  gradeBreakdown: PayslipGradeLine[];
  grossKg: number;
  grossAmount: number;
  deductions: PayslipDeductionLine[];
  deductionTotal: number;
  netAmount: number;
  generatedBy: string;
  generatedAt: Timestamp | null;
}
