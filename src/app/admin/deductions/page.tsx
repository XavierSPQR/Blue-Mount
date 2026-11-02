"use client";

import { useMemo, useState } from "react";
import { useAllDeductions } from "@/hooks/useDeductions";
import { useRosterList } from "@/hooks/useRoster";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/ResponsiveTable";
import { formatCurrency } from "@/lib/format";
import type { Deduction } from "@/types/deduction";

const TYPE_LABEL: Record<string, string> = {
  fertilizer: "Fertilizer",
  teaPowder: "Tea Powder",
  advance: "Advance",
};

export default function AdminDeductionsPage() {
  const { deductions, loading } = useAllDeductions();
  const { records: suppliers } = useRosterList("suppliers");
  const supplierNameById = useMemo(() => new Map(suppliers.map((s) => [s.id, s.name])), [suppliers]);

  const [supplierFilter, setSupplierFilter] = useState("");
  const filtered = supplierFilter ? deductions.filter((d) => d.supplierId === supplierFilter) : deductions;

  const columns = useMemo<ResponsiveTableColumn<Deduction>[]>(
    () => [
      { key: "supplier", header: "Supplier", render: (d) => supplierNameById.get(d.supplierId) ?? d.supplierId, hideOnCard: true },
      { key: "type", header: "Type", render: (d) => TYPE_LABEL[d.type] ?? d.type },
      { key: "amount", header: "Amount (LKR)", align: "right", render: (d) => formatCurrency(d.amount) },
      {
        key: "status",
        header: "Status",
        render: (d) => (
          <span className="text-gray-500">{d.appliedToPayslipId ? "Applied to pay slip" : "Outstanding"}</span>
        ),
      },
    ],
    [supplierNameById],
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Deductions Ledger</h1>
        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          aria-label="Filter ledger by supplier"
          className="field w-auto"
        >
          <option value="">All suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id} — {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <ResponsiveTable
          columns={columns}
          rows={filtered}
          rowKey={(d) => d.id}
          loading={loading}
          cardTitle={(d) => supplierNameById.get(d.supplierId) ?? d.supplierId}
          emptyMessage={deductions.length === 0 ? "No deductions yet." : "No deductions for this supplier."}
        />
      </div>
    </div>
  );
}
