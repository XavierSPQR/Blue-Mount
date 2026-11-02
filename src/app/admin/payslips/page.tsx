"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRosterList } from "@/hooks/useRoster";
import { useGrades } from "@/hooks/useGrades";
import { useRateHistory } from "@/hooks/useRateHistory";
import { useSupplierCollections } from "@/hooks/useSupplierCollections";
import { useSupplierDeductions } from "@/hooks/useDeductions";
import { useSupplierPayslips } from "@/hooks/usePayslips";
import { computeGrossPay, periodsOverlap } from "@/lib/computePayslip";
import { generatePayslip } from "@/lib/payslips";
import { PayslipDownloadButton } from "@/components/PayslipDownloadButton";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/ResponsiveTable";
import { monthToRange, currentMonthStr } from "@/lib/aggregateCollections";
import { formatCurrency, formatKg, formatPeriod } from "@/lib/format";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import type { Payslip } from "@/types/payslip";

const TYPE_LABEL: Record<string, string> = {
  fertilizer: "Fertilizer",
  teaPowder: "Tea Powder",
  advance: "Advance",
};

export default function AdminPayslipsPage() {
  const { firebaseUser } = useAuth();
  const { records: suppliers } = useRosterList("suppliers");
  const { grades } = useGrades();
  const gradeNameById = useMemo(() => new Map(grades.map((g) => [g.id, g.name])), [grades]);
  const { rates } = useRateHistory();
  const { notify } = useToast();
  const confirm = useConfirm();

  const [supplierId, setSupplierId] = useState("");
  const [month, setMonth] = useState(currentMonthStr());
  const { start: periodStart, end: periodEnd } = monthToRange(month);

  const { entries, loading: entriesLoading } = useSupplierCollections(supplierId || null);
  const { deductions, loading: deductionsLoading } = useSupplierDeductions(supplierId || null);
  const { payslips, loading: payslipsLoading } = useSupplierPayslips(supplierId || null);
  const summaryLoading = entriesLoading || deductionsLoading || payslipsLoading;

  const entriesInPeriod = useMemo(
    () => entries.filter((e) => e.date >= periodStart && e.date <= periodEnd),
    [entries, periodStart, periodEnd],
  );
  const computation = useMemo(() => computeGrossPay(entriesInPeriod, rates), [entriesInPeriod, rates]);

  const outstandingDeductions = useMemo(() => deductions.filter((d) => !d.appliedToPayslipId), [deductions]);
  const [excludedDeductionIds, setExcludedDeductionIds] = useState<Set<string>>(new Set());
  const selectedDeductions = outstandingDeductions.filter((d) => !excludedDeductionIds.has(d.id));
  const deductionTotal = selectedDeductions.reduce((sum, d) => sum + d.amount, 0);
  const netAmount = computation.grossAmount - deductionTotal;

  const overlapping = payslips.find((p) => periodsOverlap(periodStart, periodEnd, p.periodStart, p.periodEnd));
  const missingRateNames = computation.missingRateGradeIds.map((id) => gradeNameById.get(id) ?? id);

  const [generating, setGenerating] = useState(false);

  const supplier = suppliers.find((s) => s.id === supplierId);
  const canGenerate =
    !!supplierId &&
    !summaryLoading &&
    entriesInPeriod.length > 0 &&
    !overlapping &&
    missingRateNames.length === 0 &&
    !generating;

  // Shown right by the button, not just as red text scrolled above it, so
  // "why is this disabled" doesn't require hunting for the right condition.
  const disabledReason = overlapping
    ? `Resolve the overlapping pay slip (${overlapping.periodStart} to ${overlapping.periodEnd}) above first.`
    : missingRateNames.length > 0
      ? `Set a rate for ${missingRateNames.join(", ")} before generating.`
      : null;

  function toggleDeduction(id: string) {
    setExcludedDeductionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onGenerate() {
    if (!supplier || !firebaseUser) return;
    const ok = await confirm({
      title: "Generate this pay slip?",
      message: `This creates ${supplier.name}'s official pay record for ${formatPeriod(periodStart, periodEnd)} — Net Pay LKR ${formatCurrency(netAmount)}. It can't be edited afterward.`,
      confirmLabel: "Generate",
    });
    if (!ok) return;
    setGenerating(true);
    try {
      await generatePayslip({
        supplierId: supplier.id,
        supplierName: supplier.name,
        periodStart,
        periodEnd,
        gradeBreakdown: computation.gradeTotals.map((g) => ({
          gradeId: g.gradeId,
          gradeName: gradeNameById.get(g.gradeId) ?? g.gradeId,
          quantityKg: g.quantityKg,
          amount: g.amount,
        })),
        grossKg: computation.grossKg,
        grossAmount: computation.grossAmount,
        deductions: selectedDeductions.map((d) => ({ deductionId: d.id, type: d.type, amount: d.amount })),
        deductionTotal,
        generatedBy: firebaseUser.uid,
      });
      notify("success", "Pay slip generated.");
      setExcludedDeductionIds(new Set());
    } catch {
      notify("error", "Couldn't generate the pay slip. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Generate Pay Slip</h1>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="payslip-supplier" className="mb-1 block text-sm font-medium text-gray-700">
            Supplier
          </label>
          <select
            id="payslip-supplier"
            value={supplierId}
            onChange={(e) => {
              setSupplierId(e.target.value);
              setExcludedDeductionIds(new Set());
            }}
            className="field w-auto"
          >
            <option value="">Select a supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id} — {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="payslip-period" className="mb-1 block text-sm font-medium text-gray-700">
            Period (month)
          </label>
          <input
            id="payslip-period"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="field w-auto"
          />
        </div>
      </div>

      {supplierId && (
        <div className="mt-6 card p-6">
          <h2 className="text-base font-semibold text-gray-900">
            {formatPeriod(periodStart, periodEnd)}
          </h2>

          {summaryLoading ? (
            <p className="mt-2 text-sm text-gray-500">Loading…</p>
          ) : entriesInPeriod.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">No collections recorded for this supplier in this period.</p>
          ) : (
            <>
              <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th scope="col" className="py-1.5 font-medium">Grade</th>
                    <th scope="col" className="py-1.5 text-right font-medium">Quantity (kg)</th>
                    <th scope="col" className="py-1.5 text-right font-medium">Amount (LKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {computation.gradeTotals.map((g) => (
                    <tr key={g.gradeId}>
                      <td className="py-1.5">{gradeNameById.get(g.gradeId) ?? g.gradeId}</td>
                      <td className="py-1.5 text-right tabular-nums">{formatKg(g.quantityKg)}</td>
                      <td className="py-1.5 text-right tabular-nums">{formatCurrency(g.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-gray-900 font-medium">
                    <td className="py-1.5">Gross Total</td>
                    <td className="py-1.5 text-right tabular-nums">{formatKg(computation.grossKg)}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatCurrency(computation.grossAmount)}</td>
                  </tr>
                </tbody>
              </table>
              </div>

              {missingRateNames.length > 0 && (
                <p className="mt-3 text-sm text-red-600">
                  No rate is set for: {missingRateNames.join(", ")}. Set it under Rates before generating.
                </p>
              )}

              <div className="mt-6 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Outstanding deductions</h3>
                {outstandingDeductions.length > 0 && (
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-gray-500">
                      {selectedDeductions.length} of {outstandingDeductions.length} selected
                    </span>
                    <button
                      type="button"
                      onClick={() => setExcludedDeductionIds(new Set())}
                      className="text-gray-600 underline underline-offset-2 hover:text-gray-900"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setExcludedDeductionIds(new Set(outstandingDeductions.map((d) => d.id)))}
                      className="text-gray-600 underline underline-offset-2 hover:text-gray-900"
                    >
                      Select none
                    </button>
                  </div>
                )}
              </div>
              {outstandingDeductions.length === 0 ? (
                <p className="mt-1 max-w-prose text-sm text-gray-600">None.</p>
              ) : (
                <ul className="mt-2 space-y-0.5">
                  {outstandingDeductions.map((d) => (
                    <li key={d.id}>
                      {/* The whole row is the label, so the target is the row
                          rather than the 13px box, and the checkbox announces
                          which deduction it controls. */}
                      <label className="flex cursor-pointer items-center gap-3 rounded-control px-2 py-2 text-sm hover:bg-gray-50">
                        <input
                          type="checkbox"
                          className="h-5 w-5 shrink-0 rounded border-gray-300 text-gray-900 accent-gray-900"
                          checked={!excludedDeductionIds.has(d.id)}
                          onChange={() => toggleDeduction(d.id)}
                        />
                        <span className="flex-1">{TYPE_LABEL[d.type] ?? d.type}</span>
                        <span className="text-gray-600 tabular-nums">LKR {formatCurrency(d.amount)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}

              {overlapping && (
                <p className="mt-3 text-sm text-red-600">
                  A pay slip already exists for {formatPeriod(overlapping.periodStart, overlapping.periodEnd)}, which
                  overlaps this period.
                </p>
              )}

              <div className="mt-4 border-t border-gray-200 pt-4 text-right">
                <p className="text-sm text-gray-500 tabular-nums">
                  Gross {formatCurrency(computation.grossAmount)} − Deductions {formatCurrency(deductionTotal)}
                </p>
                <p className="text-lg font-semibold text-gray-900 tabular-nums">
                  Net Pay: LKR {formatCurrency(netAmount)}
                </p>
              </div>

              <div className="mt-4 flex flex-col items-end gap-1">
                <button
                  type="button"
                  disabled={!canGenerate}
                  onClick={onGenerate}
                  className="btn btn-primary"
                >
                  {generating ? "Generating…" : "Generate pay slip"}
                </button>
                {disabledReason && !generating && <p className="text-xs text-red-600">{disabledReason}</p>}
              </div>
            </>
          )}
        </div>
      )}

      {supplierId && (
        <div className="mt-8">
          <h2 className="text-base font-semibold text-gray-900">Past pay slips</h2>
          <div className="mt-2">
            <ResponsiveTable
              columns={pastPayslipColumns}
              rows={payslips}
              rowKey={(p) => p.id}
              loading={payslipsLoading}
              cardTitle={(p) => formatPeriod(p.periodStart, p.periodEnd)}
              emptyMessage="No pay slips generated yet."
            />
          </div>
        </div>
      )}
    </div>
  );
}

const pastPayslipColumns: ResponsiveTableColumn<Payslip>[] = [
  { key: "period", header: "Period", render: (p) => formatPeriod(p.periodStart, p.periodEnd), hideOnCard: true },
  { key: "gross", header: "Gross", align: "right", render: (p) => formatCurrency(p.grossAmount) },
  { key: "deductions", header: "Deductions", align: "right", render: (p) => formatCurrency(p.deductionTotal) },
  { key: "net", header: "Net", align: "right", render: (p) => <span className="font-medium">{formatCurrency(p.netAmount)}</span> },
  { key: "pdf", header: "PDF", render: (p) => <PayslipDownloadButton payslip={p} /> },
];
