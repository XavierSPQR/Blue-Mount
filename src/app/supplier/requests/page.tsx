"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/context/AuthContext";
import { useSupplierRequests } from "@/hooks/useRequests";
import { submitRequest } from "@/lib/requests";
import { FormField } from "@/components/FormField";
import { RequestStatusBadge } from "@/components/RequestStatusBadge";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/ResponsiveTable";
import { useToast } from "@/components/ToastProvider";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import type { SupplierRequest } from "@/types/request";

const columns: ResponsiveTableColumn<SupplierRequest>[] = [
  {
    key: "type",
    header: "Type",
    render: (r) => <span className="capitalize">{r.type === "teaPowder" ? "Tea Powder" : "Fertilizer"}</span>,
    hideOnCard: true,
  },
  { key: "description", header: "Description", render: (r) => r.description },
  { key: "quantity", header: "Qty", align: "right", render: (r) => r.quantity },
  { key: "status", header: "Status", render: (r) => <RequestStatusBadge status={r.status} /> },
];

const schema = z.object({
  type: z.enum(["fertilizer", "teaPowder"]),
  description: z.string().min(1, "Describe what you need"),
  quantity: z
    .number({ error: "Quantity is required" })
    .positive("Must be greater than 0")
    .max(100000, "That's an unusually large quantity — double-check it"),
});
type FormValues = z.infer<typeof schema>;

export default function SupplierRequestsPage() {
  const { appUser } = useAuth();
  const { requests, loading } = useSupplierRequests(appUser?.linkedId ?? null);
  const { notify } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { type: "fertilizer" } });
  useUnsavedChangesGuard(isDirty);

  async function onSubmit(values: FormValues) {
    if (!appUser) return;
    try {
      await submitRequest({ supplierId: appUser.linkedId, ...values });
      reset({ type: values.type, description: "", quantity: undefined });
      notify("success", "Request submitted.");
    } catch {
      notify("error", "Couldn't submit the request. Please try again.");
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Fertilizer / Tea Powder Requests</h1>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mt-4 max-w-md space-y-4 card p-6"
        noValidate
      >
        <FormField label="Type">
          <select className="field" {...register("type")}>
            <option value="fertilizer">Fertilizer</option>
            <option value="teaPowder">Tea Powder</option>
          </select>
        </FormField>
        <FormField label="Description" error={errors.description?.message}>
          <input
            placeholder="e.g. Urea, 2 bags"
            className="field"
            {...register("description")}
          />
        </FormField>
        <FormField label="Quantity" error={errors.quantity?.message}>
          <input
            type="number"
            step="1"
            min="0"
            max="100000"
            className="field"
            {...register("quantity", { valueAsNumber: true })}
          />
        </FormField>
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-primary w-full"
        >
          {isSubmitting ? "Submitting…" : "Submit request"}
        </button>
      </form>

      <div className="mt-6">
        <ResponsiveTable
          columns={columns}
          rows={requests}
          rowKey={(r) => r.id}
          loading={loading}
          cardTitle={(r) => (r.type === "teaPowder" ? "Tea Powder" : "Fertilizer")}
          emptyMessage="No requests yet."
        />
      </div>
    </div>
  );
}
