"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/context/AuthContext";
import { useGrades } from "@/hooks/useGrades";
import { useRateHistory } from "@/hooks/useRateHistory";
import { addRate, findEffectiveRate } from "@/lib/rates";
import { FormField } from "@/components/FormField";
import { useToast } from "@/components/ToastProvider";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { formatCurrency, formatDate } from "@/lib/format";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/ResponsiveTable";
import type { Grade } from "@/types/grade";
import type { RateEntry } from "@/types/rate";

function rateColumns(grades: Grade[]): ResponsiveTableColumn<RateEntry>[] {
  return [
    {
      key: "grade",
      header: "Grade",
      render: (r) => grades.find((g) => g.id === r.gradeId)?.name ?? r.gradeId,
      hideOnCard: true,
    },
    {
      key: "rate",
      header: "Rate (LKR/kg)",
      align: "right",
      render: (r) => <span className="tabular-nums">{formatCurrency(r.ratePerKg)}</span>,
    },
    // Was a raw ISO string.
    { key: "from", header: "Effective from", render: (r) => formatDate(r.effectiveFrom) },
  ];
}

const schema = z.object({
  gradeId: z.string().min(1, "Select a grade"),
  ratePerKg: z
    .number({ error: "Rate is required" })
    .positive("Must be greater than 0")
    .max(100000, "That's an unusually high rate — double-check it"),
  effectiveFrom: z.string().min(1, "Effective date is required"),
});
type FormValues = z.infer<typeof schema>;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminRatesPage() {
  const { firebaseUser } = useAuth();
  const { grades, loading: gradesLoading } = useGrades();
  const activeGrades = grades.filter((g) => g.active);
  const { rates, loading: ratesLoading } = useRateHistory();
  const { notify } = useToast();

  const currentRateByGrade = useMemo(() => {
    const today = todayIso();
    const map = new Map<string, number | null>();
    for (const g of activeGrades) {
      map.set(g.id, findEffectiveRate(rates, g.id, today));
    }
    return map;
  }, [activeGrades, rates]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { effectiveFrom: todayIso() } });
  useUnsavedChangesGuard(isDirty);

  async function onSubmit(values: FormValues) {
    if (!firebaseUser) return;
    try {
      await addRate({ ...values, setBy: firebaseUser.uid });
      reset({ effectiveFrom: todayIso() });
      notify("success", "Rate saved.");
    } catch {
      notify("error", "Couldn't save the rate. Please try again.");
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Rates</h1>
      <p className="mt-1 max-w-prose text-sm text-gray-600">
        A new rate applies from its effective date onward — past pay slips keep using whatever rate
        was actually in effect at the time.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {gradesLoading || ratesLoading ? (
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-card border border-gray-200 bg-white p-4">
                <span className="skeleton w-20" aria-hidden />
                <span className="skeleton mt-2 h-7 w-28" aria-hidden />
              </div>
            ))}
            <span className="sr-only">Loading current rates</span>
          </>
        ) : activeGrades.length === 0 ? (
          <p className="text-sm text-gray-500">No active grades yet — add one under Grades first.</p>
        ) : (
          activeGrades.map((g) => {
            const rate = currentRateByGrade.get(g.id);
            return (
              <div key={g.id} className="card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{g.name}</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {rate != null ? `LKR ${formatCurrency(rate)}` : "Not set"}
                  <span className="ml-1 text-sm font-normal text-gray-500">/kg</span>
                </p>
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mt-6 max-w-md space-y-4 card p-6"
        noValidate
      >
        <h2 className="text-base font-semibold text-gray-900">Set a new rate</h2>
        <FormField label="Grade" error={errors.gradeId?.message}>
          <select className="field" {...register("gradeId")}>
            <option value="">Select a grade</option>
            {activeGrades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Rate (LKR/kg)" error={errors.ratePerKg?.message}>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100000"
            className="field"
            {...register("ratePerKg", { valueAsNumber: true })}
          />
        </FormField>
        <FormField label="Effective from" error={errors.effectiveFrom?.message}>
          <input
            type="date"
            className="field"
            {...register("effectiveFrom")}
          />
        </FormField>
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-primary w-full"
        >
          {isSubmitting ? "Saving…" : "Save rate"}
        </button>
      </form>

      <h2 className="mt-8 text-base font-semibold text-gray-900">Rate history</h2>
      <div className="mt-2">
        {/* Was a raw <table> in an overflow-x-auto div. */}
        <ResponsiveTable
          columns={rateColumns(grades)}
          rows={rates}
          rowKey={(r) => r.id}
          loading={ratesLoading}
          cardTitle={(r) => grades.find((g) => g.id === r.gradeId)?.name ?? r.gradeId}
          emptyMessage="No rates set yet. Set one using the form above."
        />
      </div>
    </div>
  );
}
