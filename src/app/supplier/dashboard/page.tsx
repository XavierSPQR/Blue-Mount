"use client";

import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSupplierCollections } from "@/hooks/useSupplierCollections";
import { computePeriodTotals, computeTrailingSixMonths } from "@/lib/aggregateCollections";
import { StatTile } from "@/components/StatTile";
import { SixMonthChart } from "@/components/SixMonthChart";

export default function SupplierDashboardPage() {
  const { appUser } = useAuth();
  const { entries, loading } = useSupplierCollections(appUser?.linkedId ?? null);

  const totals = useMemo(() => computePeriodTotals(entries), [entries]);
  const sixMonth = useMemo(() => computeTrailingSixMonths(entries), [entries]);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">My Leaf Quantity</h1>
      <p className="mt-1 max-w-prose text-sm text-gray-600">
        Based on collections recorded against your supplier ID.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Today" value={totals.today} unit="kg" trend={totals.todayTrend} loading={loading} />
        <StatTile label="Last 7 days" value={totals.week} unit="kg" trend={totals.weekTrend} loading={loading} />
        <StatTile label="This month" value={totals.month} unit="kg" trend={totals.monthTrend} loading={loading} />
      </div>

      <h2 className="mt-8 text-base font-semibold text-gray-900">Last 6 months</h2>
      <div className="mt-2">
        <SixMonthChart data={sixMonth} />
      </div>
    </div>
  );
}
