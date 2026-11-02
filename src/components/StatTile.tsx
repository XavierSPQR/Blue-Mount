export function StatTile({
  label,
  value,
  unit,
  prefix,
  trend,
  loading,
}: {
  label: string;
  value: number;
  unit?: string;
  /** Rendered before the figure, e.g. "LKR". Keeps currency placement consistent. */
  prefix?: string;
  /** % change vs. the prior comparable period. Undefined/null hides the trend row (e.g. no prior data yet). */
  trend?: number | null;
  loading?: boolean;
}) {
  const rising = trend != null && trend >= 0;

  // While the listener is still resolving, `value` is 0 — and "Today: 0 kg" is a
  // meaningful, wrong statement rather than a neutral blank. A supplier reading
  // it has been told they delivered nothing today. Show a placeholder instead.
  if (loading) {
    return (
      <div className="rounded-card border border-gray-200 bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
        <span className="skeleton mt-2 h-7 w-24" aria-hidden />
        <span className="sr-only">Loading {label}</span>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">
        {prefix && <span className="mr-1 text-sm font-normal text-gray-500">{prefix}</span>}
        {value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
        {unit && <span className="ml-1 text-sm font-normal text-gray-500">{unit}</span>}
      </p>
      {trend != null && (
        /* The direction glyph is decorative and the colour alone can't carry
           the meaning (WCAG 1.4.1), so the direction is also stated in text
           that only a screen reader reads. A fall now reads red rather than
           grey — previously only a rise was coloured, so a decline looked
           like "no change". */
        <p className={`mt-1 flex items-center gap-1 text-xs ${rising ? "text-green-700" : "text-red-700"}`}>
          <span aria-hidden>{rising ? "▲" : "▼"}</span>
          <span className="sr-only">{rising ? "Up" : "Down"}</span>
          <span className="tabular-nums">{Math.abs(trend).toFixed(0)}%</span>
          <span className="text-gray-500">vs. prior period</span>
        </p>
      )}
    </div>
  );
}
