"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAllAdvances } from "@/hooks/useAdvances";
import { useRosterList } from "@/hooks/useRoster";
import { approveAdvance, rejectAdvance } from "@/lib/advances";
import { RequestStatusBadge } from "@/components/RequestStatusBadge";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/ResponsiveTable";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { formatCurrency } from "@/lib/format";
import type { Advance } from "@/types/advance";

type StatusFilter = "pending" | "all";

export default function AdminAdvancesPage() {
  const { firebaseUser } = useAuth();
  const { advances, loading } = useAllAdvances();
  const { records: suppliers } = useRosterList("suppliers");
  const supplierNameById = useMemo(() => new Map(suppliers.map((s) => [s.id, s.name])), [suppliers]);
  const decidedBy = firebaseUser?.uid ?? "";

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const pendingCount = advances.filter((a) => a.status === "pending").length;
  const visible = statusFilter === "pending" ? advances.filter((a) => a.status === "pending") : advances;

  const columns = useMemo<ResponsiveTableColumn<Advance>[]>(
    () => [
      { key: "supplier", header: "Supplier", render: (a) => supplierNameById.get(a.supplierId) ?? a.supplierId, hideOnCard: true },
      { key: "amount", header: "Amount (LKR)", align: "right", render: (a) => formatCurrency(a.amount) },
      { key: "notes", header: "Notes", render: (a) => a.notes || "—" },
      { key: "status", header: "Status", render: (a) => <RequestStatusBadge status={a.status} /> },
      {
        key: "actions",
        header: "Actions",
        render: (a) => <AdvanceActionsCell advance={a} supplierName={supplierNameById.get(a.supplierId) ?? a.supplierId} decidedBy={decidedBy} />,
      },
    ],
    [supplierNameById, decidedBy],
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Advances</h1>
        <div className="flex overflow-hidden rounded-control border border-gray-300 text-sm" role="group" aria-label="Filter advances by status">
          <button
            type="button"
            onClick={() => setStatusFilter("pending")}
            aria-pressed={statusFilter === "pending"}
            className="seg"
          >
            Pending {pendingCount > 0 && `(${pendingCount})`}
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            aria-pressed={statusFilter === "all"}
            className="seg"
          >
            All
          </button>
        </div>
      </div>

      <div className="mt-4">
        <ResponsiveTable
          columns={columns}
          rows={visible}
          rowKey={(a) => a.id}
          loading={loading}
          cardTitle={(a) => supplierNameById.get(a.supplierId) ?? a.supplierId}
          emptyMessage={advances.length === 0 ? "No advances yet." : "No pending advances."}
        />
      </div>
    </div>
  );
}

function AdvanceActionsCell({
  advance,
  supplierName,
  decidedBy,
}: {
  advance: Advance;
  supplierName: string;
  decidedBy: string;
}) {
  const [pending, setPending] = useState(false);
  const { notify } = useToast();
  const confirm = useConfirm();

  async function onApprove() {
    const ok = await confirm({
      title: "Approve this advance?",
      message: `Approving disburses LKR ${formatCurrency(advance.amount)} to ${supplierName} and records it as a deduction against their next pay slip. This can't be undone from here.`,
      confirmLabel: "Approve & disburse",
    });
    if (!ok) return;
    setPending(true);
    try {
      await approveAdvance(advance, decidedBy);
      notify("success", "Advance approved and disbursed.");
    } catch {
      notify("error", "Couldn't approve. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function onReject() {
    const ok = await confirm({
      title: "Reject this advance?",
      message: `${supplierName}'s request for LKR ${formatCurrency(advance.amount)} will be marked rejected.`,
      confirmLabel: "Reject",
      tone: "danger",
    });
    if (!ok) return;
    setPending(true);
    try {
      await rejectAdvance(advance.id, decidedBy);
      notify("success", "Advance rejected.");
    } catch {
      notify("error", "Couldn't reject. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (advance.status !== "pending") return <span className="text-gray-500">—</span>;

  return (
    <div className="flex gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={onApprove}
        className="btn btn-primary btn-sm"
      >
        {pending ? "Working…" : "Approve"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={onReject}
        className="btn btn-secondary btn-sm"
      >
        Reject
      </button>
    </div>
  );
}
