/**
 * Shared number and date formatting so every screen renders the same figure the
 * same way — before this, StatTile used toLocaleString (thousands separators)
 * while every table and pay slip used raw toFixed(2) (none). Both wrap
 * toLocaleString so large quantities/amounts always get separators.
 */

export function formatKg(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function formatCurrency(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * `2026-09-01` -> `1 Sep 2026`.
 *
 * Dates were displayed as raw ISO strings in fourteen places, including the
 * generated pay slip PDF — the one document a supplier actually holds. ISO is
 * the right storage and sort format (it sorts lexicographically, which several
 * range filters rely on) but it is a machine format to read.
 *
 * Parsed as UTC parts rather than `new Date(iso)` so a stored date never shifts
 * a day for a user west of UTC.
 */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** `2026-09` -> `September 2026`. */
export function formatMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split("-").map(Number);
  if (!year || !month) return yyyyMm;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * A pay-slip period. Whole calendar months are the overwhelmingly common case
 * and read far better named than as two endpoints, so `2026-09-01`–`2026-09-30`
 * becomes "September 2026" rather than "1 Sep 2026 – 30 Sep 2026".
 */
export function formatPeriod(start: string, end: string): string {
  const startParts = start.split("-").map(Number);
  const endParts = end.split("-").map(Number);
  const sameMonth = startParts[0] === endParts[0] && startParts[1] === endParts[1];
  const lastDayOfMonth = new Date(Date.UTC(endParts[0], endParts[1], 0)).getUTCDate();

  if (sameMonth && startParts[2] === 1 && endParts[2] === lastDayOfMonth) {
    return formatMonth(start.slice(0, 7));
  }
  return `${formatDate(start)} – ${formatDate(end)}`;
}
