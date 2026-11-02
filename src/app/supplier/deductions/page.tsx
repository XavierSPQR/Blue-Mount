"use client";

import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSupplierDeductions } from "@/hooks/useDeductions";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/ResponsiveTable";
import { StatTile } from "@/components/StatTile";
import { formatCurrency } from "@/lib/format";
import type { Deduction } from "@/types/deduction";

const TYPE_LABEL: Record<string, string> = {
  fertilizer: "Fertilizer",
  teaPowder: "Tea Powder",
  advance: "Advance",
};

export default function SupplierDeductionsPage() {
  const { appUser } = useAuth();
  const { deductions, loading } = useSupplierDeductions(appUser?.linkedId ?? null);
  const outstandingTotal = deductions
    .filter((d) => !d.appliedToPayslipId)
    .reduce((sum, d) => sum + d.amount, 0);

  const columns = useMemo<ResponsiveTableColumn<Deduction>[]>(
    () => [
      { key: "type", header: "Type", render: (d) => TYPE_LABEL[d.type] ?? d.type, hideOnCard: true },
      {
        key: "amount",
        header: "Amount (LKR)",
        align: "right",
        render: (d) => <span className="tabular-nums">{formatCurrency(d.amount)}</span>,
      },
      {
        key: "status",
        header: "Status",
        render: (d) => (
          <span className={d.appliedToPayslipId ? "text-gray-500" : "font-medium text-gray-900"}>
            {d.appliedToPayslipId ? "Applied to pay slip" : "Outstanding"}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Deductions</h1>
      <p className="mt-1 max-w-prose text-sm text-gray-600">
        From approved advances and fulfilled fertilizer/tea-powder requests. Each one is applied to
        your next pay slip once it&apos;s generated — the Status column below shows which have been.
      </p>

      {/* This total was a small grey sentence *below* the table. It is the one
          question a supplier opens this page to answer — how much is coming off
          my next pay — so it had the lowest visual weight on the screen
          answering the highest-priority question. */}
      {(loading || deductions.length > 0) && (
        <div className="mt-4 max-w-xs">
          <StatTile label="Outstanding total" value={outstandingTotal} prefix="LKR" loading={loading} />
        </div>
      )}

      <h2 className="mt-8 text-base font-semibold text-gray-900">All deductions</h2>
      <div className="mt-2">
        {/* Was a raw <table> in an overflow-x-auto div, so on a 375px phone the
            Amount column — the only one a supplier came for — sat off-screen. */}
        <ResponsiveTable
          columns={columns}
          rows={deductions}
          rowKey={(d) => d.id}
          loading={loading}
          cardTitle={(d) => TYPE_LABEL[d.type] ?? d.type}
          emptyMessage="No deductions yet. Advances and fulfilled supply requests will appear here."
        />
      </div>
    </div>
  );
}
