export interface RateEntry {
  id: string;
  gradeId: string;
  ratePerKg: number;
  /** ISO date (yyyy-mm-dd) this rate takes effect from — rates are an append-only ledger, never edited in place, so a pay slip computed for a past period always uses the rate that was actually in effect then. */
  effectiveFrom: string;
  setBy: string;
}
