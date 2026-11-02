"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCollectorCollections } from "@/hooks/useCollectorCollections";
import { useRosterList } from "@/hooks/useRoster";
import { useGrades } from "@/hooks/useGrades";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/ResponsiveTable";
import { formatKg, formatDate, formatMonth } from "@/lib/format";

interface MonthlyRow {
  month: string;
  totalKg: number;
}

const monthlyColumns: ResponsiveTableColumn<MonthlyRow>[] = [
  // Was the raw `2026-09` key.
  { key: "month", header: "Month", render: (m) => formatMonth(m.month), hideOnCard: true },
  {
    key: "total",
    header: "Total (kg)",
    align: "right",
    render: (m) => <span className="tabular-nums">{formatKg(m.totalKg)}</span>,
  },
];
import type { CollectionEntry } from "@/types/collectionEntry";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function CollectorCollectionsPage() {
  const { appUser } = useAuth();
  const { entries, loading } = useCollectorCollections(appUser?.linkedId ?? null);
  const { records: suppliers } = useRosterList("suppliers");
  const supplierNameById = useMemo(() => new Map(suppliers.map((s) => [s.id, s.name])), [suppliers]);
  const { grades } = useGrades();
  const gradeNameById = useMemo(() => new Map(grades.map((g) => [g.id, g.name])), [grades]);

  const [view, setView] = useState<"daily" | "monthly">("daily");
  const [from, setFrom] = useState(firstOfMonthIso());
  const [to, setTo] = useState(todayIso());

  const filtered = useMemo(
    () => entries.filter((e) => e.date >= from && e.date <= to),
    [entries, from, to],
  );
  const filteredTotal = filtered.reduce((sum, e) => sum + e.quantityKg, 0);

  // Grouped across ALL of the collector's history, not just the daily-view date range.
  const monthly = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of entries) {
      const month = e.date.slice(0, 7); // yyyy-mm
      totals.set(month, (totals.get(month) ?? 0) + e.quantityKg);
    }
    return Array.from(totals.entries())
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([month, totalKg]) => ({ month, totalKg }));
  }, [entries]);

  const dailyColumns = useMemo<ResponsiveTableColumn<CollectionEntry>[]>(
    () => [
      { key: "date", header: "Date", render: (e) => formatDate(e.date), hideOnCard: true },
      { key: "supplier", header: "Supplier", render: (e) => supplierNameById.get(e.supplierId) ?? e.supplierId },
      { key: "grade", header: "Grade", render: (e) => gradeNameById.get(e.gradeId) ?? e.gradeId },
      { key: "quantity", header: "Quantity (kg)", align: "right", render: (e) => formatKg(e.quantityKg) },
    ],
    [supplierNameById, gradeNameById],
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Collection History</h1>
        <div className="flex overflow-hidden rounded-control border border-gray-300 text-sm" role="group" aria-label="Collection history view">
          <button type="button" onClick={() => setView("daily")} aria-pressed={view === "daily"} className="seg">
            Daily
          </button>
          <button type="button" onClick={() => setView("monthly")} aria-pressed={view === "monthly"} className="seg">
            Monthly
          </button>
        </div>
      </div>

      {view === "daily" && (
        <>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="range-from" className="mb-1 block text-sm font-medium text-gray-700">
                From
              </label>
              <input
                id="range-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="field w-auto"
              />
            </div>
            <div>
              <label htmlFor="range-to" className="mb-1 block text-sm font-medium text-gray-700">
                To
              </label>
              <input
                id="range-to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="field w-auto"
              />
            </div>
            <p className="text-sm text-gray-500">
              Total: <span className="font-medium text-gray-900">{formatKg(filteredTotal)} kg</span>
            </p>
          </div>

          <div className="mt-4">
            <ResponsiveTable
              columns={dailyColumns}
              rows={filtered}
              rowKey={(e) => e.id}
              loading={loading}
              cardTitle={(e) => formatDate(e.date)}
              emptyMessage="No entries in this range."
            />
          </div>
        </>
      )}

      {view === "monthly" && (
        <div className="mt-4">
          {/* Was a raw <table> in an overflow-x-auto div. */}
          <ResponsiveTable
            columns={monthlyColumns}
            rows={monthly}
            rowKey={(m) => m.month}
            loading={loading}
            cardTitle={(m) => formatMonth(m.month)}
            emptyMessage="No collections recorded yet."
          />
        </div>
      )}
    </div>
  );
}
