"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/context/AuthContext";
import { useSupplierAdvances } from "@/hooks/useAdvances";
import { submitAdvance } from "@/lib/advances";
import { FormField } from "@/components/FormField";
import { RequestStatusBadge } from "@/components/RequestStatusBadge";
import { useToast } from "@/components/ToastProvider";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/ResponsiveTable";
import { formatCurrency } from "@/lib/format";
import type { Advance } from "@/types/advance";

const columns: ResponsiveTableColumn<Advance>[] = [
  {
    key: "amount",
    header: "Amount (LKR)",
    align: "right",
    render: (a) => <span className="tabular-nums">{formatCurrency(a.amount)}</span>,
    hideOnCard: true,
  },
  { key: "notes", header: "Notes", render: (a) => a.notes || "—" },
  { key: "status", header: "Status", render: (a) => <RequestStatusBadge status={a.status} /> },
];

const schema = z.object({
  amount: z
    .number({ error: "Amount is required" })
    .positive("Must be greater than 0")
    .max(1000000, "That's an unusually large amount — double-check it"),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function SupplierAdvancesPage() {
  const { appUser } = useAuth();
  const { advances, loading } = useSupplierAdvances(appUser?.linkedId ?? null);
  const { notify } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });
  useUnsavedChangesGuard(isDirty);

  async function onSubmit(values: FormValues) {
    if (!appUser) return;
    try {
      await submitAdvance({ supplierId: appUser.linkedId, amount: values.amount, notes: values.notes ?? "" });
      reset({ amount: undefined, notes: "" });
      notify("success", "Advance request submitted.");
    } catch {
      notify("error", "Couldn't submit the advance request. Please try again.");
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Advances</h1>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mt-4 max-w-md space-y-4 card p-6"
        noValidate
      >
        <FormField label="Amount (LKR)" error={errors.amount?.message}>
          <input
            type="number"
            step="0.01"
            min="0"
            max="1000000"
            className="field"
            {...register("amount", { valueAsNumber: true })}
          />
        </FormField>
        <FormField label="Notes (optional)" error={errors.notes?.message}>
          <input className="field" {...register("notes")} />
        </FormField>
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-primary w-full"
        >
          {isSubmitting ? "Submitting…" : "Request advance"}
        </button>
      </form>

      <h2 className="mt-8 text-base font-semibold text-gray-900">Your advance requests</h2>
      <div className="mt-2">
        {/* Was a raw <table> in an overflow-x-auto div — on a phone the Amount
            column scrolled off to the right. */}
        <ResponsiveTable
          columns={columns}
          rows={advances}
          rowKey={(a) => a.id}
          loading={loading}
          cardTitle={(a) => `LKR ${formatCurrency(a.amount)}`}
          emptyMessage="No advances yet. Request one using the form above."
        />
      </div>
    </div>
  );
}
