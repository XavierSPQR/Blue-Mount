import type { CollectionEntry } from "@/types/collectionEntry";
import type { RateEntry } from "@/types/rate";
import { findEffectiveRate } from "@/lib/rates";

export interface GradeTotal {
  gradeId: string;
  quantityKg: number;
  amount: number;
}

export interface GrossPayComputation {
  grossKg: number;
  grossAmount: number;
  gradeTotals: GradeTotal[];
  /** Grades that appeared in this period with no rate yet in effect on their entry's date — generation should be blocked until these are set. */
  missingRateGradeIds: string[];
}

/**
 * Each entry's amount uses the rate in effect on ITS OWN date, not the
 * period end or "current" rate — so a rate change mid-period is handled
 * correctly without special-casing.
 */
export function computeGrossPay(entries: CollectionEntry[], rates: RateEntry[]): GrossPayComputation {
  let grossKg = 0;
  let grossAmount = 0;
  const gradeTotals = new Map<string, GradeTotal>();
  const missingRateGradeIds = new Set<string>();

  for (const e of entries) {
    const rate = findEffectiveRate(rates, e.gradeId, e.date);
    if (rate == null) missingRateGradeIds.add(e.gradeId);
    const amount = (rate ?? 0) * e.quantityKg;

    grossKg += e.quantityKg;
    grossAmount += amount;

    const existing = gradeTotals.get(e.gradeId) ?? { gradeId: e.gradeId, quantityKg: 0, amount: 0 };
    existing.quantityKg += e.quantityKg;
    existing.amount += amount;
    gradeTotals.set(e.gradeId, existing);
  }

  return {
    grossKg,
    grossAmount,
    gradeTotals: Array.from(gradeTotals.values()),
    missingRateGradeIds: Array.from(missingRateGradeIds),
  };
}

/** Whether two [start, end] date ranges (inclusive, ISO strings) share any day. */
export function periodsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}
