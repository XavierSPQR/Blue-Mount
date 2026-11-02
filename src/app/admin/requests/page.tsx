"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAllRequests } from "@/hooks/useRequests";
import { useRosterList } from "@/hooks/useRoster";
import { decideRequest, fulfillRequest } from "@/lib/requests";
import { RequestStatusBadge } from "@/components/RequestStatusBadge";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/ResponsiveTable";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { formatCurrency } from "@/lib/format";
import type { RequestStatus, SupplierRequest } from "@/types/request";

type StatusFilter = "pending" | "all";

export default function AdminRequestsPage() {
  const { firebaseUser } = useAuth();
  const { requests, loading } = useAllRequests();
  const { records: suppliers } = useRosterList("suppliers");
  const supplierNameById = useMemo(() => new Map(suppliers.map((s) => [s.id, s.name])), [suppliers]);
  const decidedBy = firebaseUser?.uid ?? "";

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const visible = statusFilter === "pending" ? requests.filter((r) => r.status === "pending") : requests;

  const columns = useMemo<ResponsiveTableColumn<SupplierRequest>[]>(
    () => [
      { key: "supplier", header: "Supplier", render: (r) => supplierNameById.get(r.supplierId) ?? r.supplierId, hideOnCard: true },
      {
        key: "type",
        header: "Type",
        render: (r) => <span className="capitalize">{r.type === "teaPowder" ? "Tea Powder" : "Fertilizer"}</span>,
      },
      { key: "description", header: "Description", render: (r) => r.description },
      { key: "quantity", header: "Qty", align: "right", render: (r) => r.quantity },
      { key: "status", header: "Status", render: (r) => <RequestStatusBadge status={r.status} /> },
      {
        key: "actions",
        header: "Actions",
        render: (r) => (
          <RequestActionsCell
            request={r}
            supplierName={supplierNameById.get(r.supplierId) ?? r.supplierId}
            decidedBy={decidedBy}
          />
        ),
      },
    ],
    [supplierNameById, decidedBy],
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Fertilizer / Tea Powder Requests</h1>
        <div className="flex overflow-hidden rounded-control border border-gray-300 text-sm" role="group" aria-label="Filter requests by status">
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
          rowKey={(r) => r.id}
          loading={loading}
          cardTitle={(r) => supplierNameById.get(r.supplierId) ?? r.supplierId}
          emptyMessage={requests.length === 0 ? "No requests yet." : "No pending requests."}
        />
      </div>
    </div>
  );
}

function RequestActionsCell({
  request,
  supplierName,
  decidedBy,
}: {
  request: SupplierRequest;
  supplierName: string;
  decidedBy: string;
}) {
  const [pending, setPending] = useState(false);
  const [fulfillAmount, setFulfillAmount] = useState("");
  const { notify } = useToast();
  const confirm = useConfirm();

  async function onDecide(status: Extract<RequestStatus, "approved" | "rejected">) {
    if (status === "rejected") {
      const ok = await confirm({
        title: "Reject this request?",
        message: `${supplierName}'s request for ${request.description} will be marked rejected. This can't be undone from here.`,
        confirmLabel: "Reject",
        tone: "danger",
      });
      if (!ok) return;
    }
    setPending(true);
    try {
      await decideRequest(request.id, status, decidedBy);
      notify("success", status === "approved" ? "Request approved." : "Request rejected.");
    } catch {
      notify("error", "Couldn't update. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function onFulfill() {
    const amount = Number(fulfillAmount);
    if (!amount || amount <= 0) {
      notify("error", "Enter the deduction amount (LKR) first.");
      return;
    }
    const ok = await confirm({
      title: "Mark this request fulfilled?",
      message: `This records a LKR ${formatCurrency(amount)} deduction against ${supplierName} and can't be reversed from here.`,
      confirmLabel: "Mark fulfilled",
    });
    if (!ok) return;
    setPending(true);
    try {
      await fulfillRequest(request, amount, decidedBy);
      notify("success", "Request marked fulfilled.");
      setFulfillAmount("");
    } catch {
      notify("error", "Couldn't mark fulfilled. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (request.status === "pending") {
    return (
      <div className="flex gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => onDecide("approved")}
          className="btn btn-primary btn-sm"
        >
          {pending ? "Working…" : "Approve"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => onDecide("rejected")}
          className="btn btn-secondary btn-sm"
        >
          Reject
        </button>
      </div>
    );
  }

  if (request.status === "approved") {
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="0.01"
          min="0"
          max="1000000"
          placeholder="0.00"
          aria-label={`Cost in LKR to deduct for ${supplierName}'s request`}
          value={fulfillAmount}
          onChange={(e) => setFulfillAmount(e.target.value)}
          className="field w-28"
        />
        <button
          type="button"
          disabled={pending}
          onClick={onFulfill}
          className="btn btn-primary btn-sm"
        >
          Mark fulfilled
        </button>
      </div>
    );
  }

  return <span className="text-gray-500">—</span>;
}
