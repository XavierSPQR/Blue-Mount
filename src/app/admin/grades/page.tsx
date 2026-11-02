"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGrades } from "@/hooks/useGrades";
import { addGrade, renameGrade, setGradeActive } from "@/lib/grades";
import { FormField } from "@/components/FormField";
import { StatusBadge } from "@/components/StatusBadge";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/ResponsiveTable";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import type { Grade } from "@/types/grade";

const schema = z.object({ name: z.string().trim().min(1, "Grade name is required") });
type FormValues = z.infer<typeof schema>;

export default function AdminGradesPage() {
  const { grades, loading } = useGrades();
  const { notify } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onAdd(values: FormValues) {
    try {
      await addGrade(values.name);
      reset({ name: "" });
      notify("success", `${values.name} added.`);
    } catch {
      notify("error", "Couldn't add grade. Try again.");
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Tea Leaf Grades</h1>
      <p className="mt-1 max-w-prose text-sm text-gray-600">
        Grades collectors choose from when recording a collection. Rates are set per grade under{" "}
        <span className="font-medium">Rates</span>.
      </p>

      <form onSubmit={handleSubmit(onAdd)} className="mt-4 flex max-w-md items-end gap-3" noValidate>
        <div className="flex-1">
          <FormField label="New grade name" error={errors.name?.message}>
            <input
              className="field"
              placeholder="e.g. Grade A"
              {...register("name")}
            />
          </FormField>
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-primary"
        >
          Add
        </button>
      </form>

      <div className="mt-6">
        {/* Was a raw <table> in an overflow-x-auto div. The inline rename form
            and the retire/reactivate action live in column render functions, so
            they work identically in the desktop table and the mobile card. */}
        <ResponsiveTable
          columns={gradeColumns}
          rows={grades}
          rowKey={(g) => g.id}
          loading={loading}
          cardTitle={(g) => <GradeName grade={g} />}
          emptyMessage="No grades yet. Add one using the form above so collectors can record leaf."
        />
      </div>
    </div>
  );
}

const gradeColumns: ResponsiveTableColumn<Grade>[] = [
  { key: "name", header: "Name", render: (g) => <GradeName grade={g} />, hideOnCard: true },
  { key: "status", header: "Status", render: (g) => <StatusBadge active={g.active} /> },
  { key: "actions", header: "Actions", render: (g) => <GradeActions grade={g} /> },
];

/** Click-to-rename cell. */
function GradeName({ grade }: { grade: Grade }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(grade.name);
  const [pending, setPending] = useState(false);
  const { notify } = useToast();

  function cancelEditing() {
    setName(grade.name);
    setEditing(false);
  }

  async function onSaveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === grade.name) {
      cancelEditing();
      return;
    }
    setPending(true);
    try {
      await renameGrade(grade.id, trimmed);
      notify("success", "Grade renamed.");
      setEditing(false);
    } catch {
      notify("error", "Couldn't rename the grade. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setName(grade.name);
          setEditing(true);
        }}
        aria-label={`Edit grade name: ${grade.name}`}
        className="rounded-control py-1 text-left hover:underline"
      >
        {grade.name}
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onSaveName();
      }}
      className="flex items-center gap-2"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") cancelEditing();
        }}
        autoFocus
        aria-label={`Rename grade ${grade.name}`}
        className="field"
      />
      <button type="submit" disabled={pending} className="btn btn-primary btn-sm shrink-0">
        Save
      </button>
      <button type="button" onClick={cancelEditing} disabled={pending} className="btn btn-secondary btn-sm shrink-0">
        Cancel
      </button>
    </form>
  );
}

/** Retire / reactivate cell. */
function GradeActions({ grade }: { grade: Grade }) {
  const [pending, setPending] = useState(false);
  const { notify } = useToast();
  const confirm = useConfirm();

  async function onToggleActive() {
    if (grade.active) {
      const ok = await confirm({
        title: `Retire ${grade.name}?`,
        message:
          "Collectors won't be able to select this grade for new collections. Rates already recorded against it are unaffected, and you can reactivate it at any time.",
        confirmLabel: "Retire",
        tone: "danger",
      });
      if (!ok) return;
    }
    setPending(true);
    try {
      await setGradeActive(grade.id, !grade.active);
      notify("success", grade.active ? `${grade.name} retired.` : `${grade.name} reactivated.`);
    } catch {
      notify("error", "Couldn't update the grade. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <button type="button" disabled={pending} onClick={onToggleActive} className="btn btn-secondary btn-sm">
      {pending ? "Updating…" : grade.active ? "Retire" : "Reactivate"}
    </button>
  );
}
