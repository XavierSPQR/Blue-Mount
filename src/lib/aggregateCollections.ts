import type { CollectionEntry } from "@/types/collectionEntry";

export interface PeriodTotals {
  today: number;
  week: number;
  month: number;
  /** % change vs. the prior comparable period (yesterday / the 7 days before / same day-of-month last
   *  month). Null when there's no baseline to compare against (previous period totalled zero). */
  todayTrend: number | null;
  weekTrend: number | null;
  monthTrend: number | null;
}

export interface MonthlyPoint {
  month: string; // yyyy-mm
  label: string; // e.g. "Mar 2026"
  totalKg: number;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function startOfMonthIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Same day-of-month range in the previous calendar month, clamped to that month's length
 *  (so Mar 31 compares against Feb's last day, not an overflowed March 3rd). Keeps the "this
 *  month" trend an apples-to-apples month-to-date vs. month-to-date comparison. */
function previousMonthToDateRange(): { start: string; end: string } {
  const now = new Date();
  const prevMonthLastDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const day = Math.min(now.getDate(), prevMonthLastDay);
  const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const m = now.getMonth() === 0 ? 12 : now.getMonth();
  const mStr = String(m).padStart(2, "0");
  return { start: `${y}-${mStr}-01`, end: `${y}-${mStr}-${String(day).padStart(2, "0")}` };
}

/** % change of current vs. previous. Null (no baseline) rather than an infinite/undefined
 *  percentage when the previous period totalled zero. */
function trendPercent(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Today / rolling-7-day / month-to-date totals — the stat-tile row every dashboard shows —
 *  each paired with its % change against the prior comparable period. */
export function computePeriodTotals(entries: CollectionEntry[]): PeriodTotals {
  const today = todayIso();
  const yesterday = daysAgoIso(1);
  const weekStart = daysAgoIso(6); // rolling 7-day window including today
  const prevWeekStart = daysAgoIso(13);
  const prevWeekEnd = daysAgoIso(7);
  const monthStart = startOfMonthIso();
  const prevMonth = previousMonthToDateRange();

  let todayTotal = 0;
  let yesterdayTotal = 0;
  let weekTotal = 0;
  let prevWeekTotal = 0;
  let monthTotal = 0;
  let prevMonthTotal = 0;

  for (const e of entries) {
    if (e.date === today) todayTotal += e.quantityKg;
    if (e.date === yesterday) yesterdayTotal += e.quantityKg;
    if (e.date >= weekStart) weekTotal += e.quantityKg;
    if (e.date >= prevWeekStart && e.date <= prevWeekEnd) prevWeekTotal += e.quantityKg;
    if (e.date >= monthStart) monthTotal += e.quantityKg;
    if (e.date >= prevMonth.start && e.date <= prevMonth.end) prevMonthTotal += e.quantityKg;
  }

  return {
    today: todayTotal,
    week: weekTotal,
    month: monthTotal,
    todayTrend: trendPercent(todayTotal, yesterdayTotal),
    weekTrend: trendPercent(weekTotal, prevWeekTotal),
    monthTrend: trendPercent(monthTotal, prevMonthTotal),
  };
}

/** 6 trailing calendar months (oldest first), monthly totals — see IMPLEMENTATION_PLAN.md assumption #3. */
export function computeTrailingSixMonths(entries: CollectionEntry[]): MonthlyPoint[] {
  const now = new Date();
  const months: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    months.push({ key, label });
  }

  const totalsByMonth = new Map<string, number>();
  for (const e of entries) {
    const key = e.date.slice(0, 7);
    totalsByMonth.set(key, (totalsByMonth.get(key) ?? 0) + e.quantityKg);
  }

  return months.map((m) => ({ month: m.key, label: m.label, totalKg: totalsByMonth.get(m.key) ?? 0 }));
}

/** Sum quantityKg grouped by a chosen key (supplierId or collectorId), for a given date range —
 *  backs the admin dashboard's supplier-wise/collector-wise breakdown, whichever month is selected. */
export function groupQuantityByRange(
  entries: CollectionEntry[],
  key: "supplierId" | "collectorId",
  start: string,
  end: string,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const e of entries) {
    if (e.date < start || e.date > end) continue;
    const id = e[key];
    totals.set(id, (totals.get(id) ?? 0) + e.quantityKg);
  }
  return totals;
}

/** yyyy-mm -> the first/last ISO date in that calendar month. Shared by the admin dashboard's
 *  period picker and the pay slip generator's period picker. */
export function monthToRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const lastDay = new Date(y, m, 0).getDate(); // day 0 of next month = last day of this month
  const end = `${month}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export function currentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Last `count` months (most recent first) as {value, label} pairs, for a month-picker <select>. */
export function recentMonths(count: number): { value: string; label: string }[] {
  const now = new Date();
  const months: { value: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ value, label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }) });
  }
  return months;
}
