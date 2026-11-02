"use client";

import { useMemo, useState } from "react";
import { useAllCollections } from "@/hooks/useAllCollections";
import { useRosterList } from "@/hooks/useRoster";
import {
  computePeriodTotals,
  computeTrailingSixMonths,
  groupQuantityByRange,
  monthToRange,
  currentMonthStr,
  recentMonths,
} from "@/lib/aggregateCollections";
import { StatTile } from "@/components/StatTile";
import { SixMonthChart } from "@/components/SixMonthChart";
import { formatKg } from "@/lib/format";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/ResponsiveTable";

export default function AdminDashboardPage() {
  const { entries, loading } = useAllCollections();
  const { records: suppliers } = useRosterList("suppliers");
  const { records: collectors } = useRosterList("collectors");

  const totals = useMemo(() => computePeriodTotals(entries), [entries]);
  const sixMonth = useMemo(() => computeTrailingSixMonths(entries), [entries]);

  // Breakdown tables default to the current month but aren't locked to it —
  // the stat tiles above already frame Today/Week/Month, so "which month am
  // I looking at" should be a choice here too, not just "this month, always".
  const monthOptions = useMemo(() => recentMonths(6), []);
  const [period, setPeriod] = useState(currentMonthStr());
  const range = useMemo(() => monthToRange(period), [period]);

  const supplierBreakdown = useMemo(() => {
    const totalsById = groupQuantityByRange(entries, "supplierId", range.start, range.end);
    return suppliers
      .map((s) => ({ id: s.id, name: s.name, totalKg: totalsById.get(s.id) ?? 0 }))
      .filter((row) => row.totalKg > 0)
      .sort((a, b) => b.totalKg - a.totalKg);
  }, [entries, suppliers, range]);

  const collectorBreakdown = useMemo(() => {
    const totalsById = groupQuantityByRange(entries, "collectorId", range.start, range.end);
    return collectors
      .map((c) => ({ id: c.id, name: c.name, totalKg: totalsById.get(c.id) ?? 0 }))
      .filter((row) => row.totalKg > 0)
      .sort((a, b) => b.totalKg - a.totalKg);
  }, [entries, collectors, range]);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Company Tea Leaf Overview</h1>
      <p className="mt-1 max-w-prose text-sm text-gray-600">
        Across all suppliers and collectors.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Today" value={totals.today} unit="kg" trend={totals.todayTrend} loading={loading} />
        <StatTile label="Last 7 days" value={totals.week} unit="kg" trend={totals.weekTrend} loading={loading} />
        <StatTile label="This month" value={totals.month} unit="kg" trend={totals.monthTrend} loading={loading} />
      </div>

      <h2 className="mt-8 text-base font-semibold text-gray-900">Last 6 months (company-wide)</h2>
      <div className="mt-2">
        <SixMonthChart data={sixMonth} />
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Breakdown</h2>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          Period
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="field w-auto"
          >
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BreakdownTable title="Supplier-wise" rows={supplierBreakdown} loading={loading} />
        <BreakdownTable title="Collector-wise" rows={collectorBreakdown} loading={loading} />
      </div>
    </div>
  );
}

interface BreakdownRow {
  id: string;
  name: string;
  totalKg: number;
}

const breakdownColumns: ResponsiveTableColumn<BreakdownRow>[] = [
  { key: "id", header: "ID", render: (r) => r.id, hideOnCard: true },
  { key: "name", header: "Name", render: (r) => r.name },
  {
    key: "qty",
    header: "Quantity (kg)",
    align: "right",
    render: (r) => <span className="tabular-nums">{formatKg(r.totalKg)}</span>,
  },
];

/**
 * Was a raw <table> in an overflow-x-auto div while every other list in the app
 * used ResponsiveTable — so on a phone these two sideways-scrolled and nothing
 * else did. h3, not h2: the section above is already headed "Breakdown", and
 * the original skipped straight back to h2 here.
 */
function BreakdownTable({ title, rows, loading }: { title: string; rows: BreakdownRow[]; loading: boolean }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <div className="mt-2">
        <ResponsiveTable
          columns={breakdownColumns}
          rows={rows}
          rowKey={(r) => r.id}
          loading={loading}
          cardTitle={(r) => r.name}
          emptyMessage="No collections in this period."
        />
      </div>
    </div>
  );
}
