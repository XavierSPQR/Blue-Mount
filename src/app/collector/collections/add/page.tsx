"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/context/AuthContext";
import { useRosterList } from "@/hooks/useRoster";
import { useGrades } from "@/hooks/useGrades";
import { addCollectionEntry } from "@/lib/collections";
import { FormField } from "@/components/FormField";
import { useToast } from "@/components/ToastProvider";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const schema = z.object({
  supplierId: z.string().min(1, "Select a supplier"),
  date: z
    .string()
    .min(1, "Date is required")
    .refine((val) => val <= todayIso(), "Date can't be in the future"), // ISO yyyy-mm-dd sorts lexicographically
  gradeId: z.string().min(1, "Select a grade"),
  quantityKg: z
    .number({ error: "Quantity is required" })
    .positive("Must be greater than 0")
    .max(10000, "That's an unusually large quantity — double-check it"),
});
type FormValues = z.infer<typeof schema>;

export default function AddCollectionPage() {
  const { appUser, firebaseUser } = useAuth();
  const { records: suppliers, loading: suppliersLoading } = useRosterList("suppliers");
  const activeSuppliers = suppliers.filter((s) => s.active);
  const { grades, loading: gradesLoading } = useGrades();
  const activeGrades = grades.filter((g) => g.active);
  const { notify } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { date: todayIso() },
  });
  useUnsavedChangesGuard(isDirty);

  async function onSubmit(values: FormValues) {
    if (!appUser || !firebaseUser) return;
    try {
      await addCollectionEntry({
        supplierId: values.supplierId,
        collectorId: appUser.linkedId,
        date: values.date,
        gradeId: values.gradeId,
        quantityKg: values.quantityKg,
        createdBy: firebaseUser.uid,
      });
      reset({ date: todayIso() });
      notify("success", "Collection saved.");
    } catch {
      notify("error", "Couldn't save the collection entry. Please try again.");
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Add Collection</h1>
      <p className="mt-1 max-w-prose text-sm text-gray-600">
        Recorded against your collector ID. The date defaults to today.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        <FormField label="Supplier" error={errors.supplierId?.message}>
          <select
            className="field"
            disabled={suppliersLoading}
            {...register("supplierId")}
          >
            <option value="">{suppliersLoading ? "Loading…" : "Select a supplier"}</option>
            {activeSuppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id} — {s.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Date" error={errors.date?.message}>
          <input
            type="date"
            max={todayIso()}
            className="field"
            {...register("date")}
          />
        </FormField>

        <FormField label="Grade" error={errors.gradeId?.message}>
          <select
            className="field"
            disabled={gradesLoading}
            {...register("gradeId")}
          >
            <option value="">{gradesLoading ? "Loading…" : "Select a grade"}</option>
            {activeGrades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Quantity (kg)" error={errors.quantityKg?.message}>
          <input
            type="number"
            step="0.1"
            min="0"
            max="10000"
            className="field"
            {...register("quantityKg", { valueAsNumber: true })}
          />
        </FormField>

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-primary w-full"
        >
          {isSubmitting ? "Saving…" : "Add collection"}
        </button>
      </form>
    </div>
  );
}
