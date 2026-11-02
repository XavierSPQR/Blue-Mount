"use client";

import { useAuth } from "@/context/AuthContext";
import { useSupplierPayslips } from "@/hooks/usePayslips";
import { PayslipDownloadButton } from "@/components/PayslipDownloadButton";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/ResponsiveTable";
import { formatCurrency, formatPeriod } from "@/lib/format";
import type { Payslip } from "@/types/payslip";

const columns: ResponsiveTableColumn<Payslip>[] = [
  { key: "period", header: "Period", render: (p) => formatPeriod(p.periodStart, p.periodEnd), hideOnCard: true },
  { key: "gross", header: "Gross (LKR)", align: "right", render: (p) => formatCurrency(p.grossAmount) },
  { key: "deductions", header: "Deductions (LKR)", align: "right", render: (p) => formatCurrency(p.deductionTotal) },
  { key: "net", header: "Net (LKR)", align: "right", render: (p) => <span className="font-medium">{formatCurrency(p.netAmount)}</span> },
  { key: "pdf", header: "PDF", render: (p) => <PayslipDownloadButton payslip={p} /> },
];

export default function SupplierPayslipsPage() {
  const { appUser } = useAuth();
  const { payslips, loading } = useSupplierPayslips(appUser?.linkedId ?? null);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Pay Slips</h1>
      <div className="mt-4">
        <ResponsiveTable
          columns={columns}
          rows={payslips}
          rowKey={(p) => p.id}
          loading={loading}
          cardTitle={(p) => formatPeriod(p.periodStart, p.periodEnd)}
          emptyMessage="No pay slips yet."
        />
      </div>
    </div>
  );
}
