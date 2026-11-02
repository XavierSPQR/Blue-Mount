import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PayslipDeductionLine, PayslipGradeLine } from "@/types/payslip";

export interface GeneratePayslipInput {
  supplierId: string;
  supplierName: string;
  periodStart: string;
  periodEnd: string;
  gradeBreakdown: PayslipGradeLine[];
  grossKg: number;
  grossAmount: number;
  deductions: PayslipDeductionLine[];
  deductionTotal: number;
  generatedBy: string;
}

/**
 * Writes the pay slip and marks every deduction it absorbed as applied —
 * as one batch, so a deduction can never be left dangling (applied to a
 * payslip that failed to save) or double-counted (applied to two).
 */
export async function generatePayslip(input: GeneratePayslipInput): Promise<string> {
  const payslipRef = doc(collection(db, "payslips"));
  const netAmount = input.grossAmount - input.deductionTotal;
  const batch = writeBatch(db);

  batch.set(payslipRef, {
    supplierId: input.supplierId,
    supplierName: input.supplierName,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    gradeBreakdown: input.gradeBreakdown,
    grossKg: input.grossKg,
    grossAmount: input.grossAmount,
    deductions: input.deductions,
    deductionTotal: input.deductionTotal,
    netAmount,
    generatedAt: serverTimestamp(),
    generatedBy: input.generatedBy,
  });

  for (const d of input.deductions) {
    batch.update(doc(db, "deductions", d.deductionId), { appliedToPayslipId: payslipRef.id });
  }

  await batch.commit();
  return payslipRef.id;
}
