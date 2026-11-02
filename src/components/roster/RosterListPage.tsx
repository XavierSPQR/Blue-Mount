"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField } from "@/components/FormField";
import { StatusBadge } from "@/components/StatusBadge";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/ResponsiveTable";
import { useRosterList } from "@/hooks/useRoster";
import { createRosterApi, type RosterCollection, type RosterFormInput, type RosterKind, type RosterRecord } from "@/lib/roster";
import { useToast } from "@/components/ToastProvider";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  contact: z.string().min(1, "Contact is required"),
  address: z.string().min(1, "Address is required"),
  joinDate: z.string().min(1, "Join date is required"),
});

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

type StatusFilter = "all" | "active" | "inactive";

export function RosterListPage({
  title,
  collectionName,
  idKind,
  detailBasePath,
}: {
  title: string;
  collectionName: RosterCollection;
  idKind: RosterKind;
  detailBasePath: string;
}) {
  const { records, loading } = useRosterList(collectionName);
  const api = createRosterApi(collectionName, idKind);
  const [showForm, setShowForm] = useState(false);
  const { notify } = useToast();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (statusFilter === "active" && !r.active) return false;
      if (statusFilter === "inactive" && r.active) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || r.contact.toLowerCase().includes(q)
      );
    });
  }, [records, search, statusFilter]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<RosterFormInput>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", contact: "", address: "", joinDate: todayIso() },
  });
  useUnsavedChangesGuard(showForm && isDirty);

  async function onSubmit(values: RosterFormInput) {
    try {
      const id = await api.register(values);
      reset({ name: "", contact: "", address: "", joinDate: todayIso() });
      setShowForm(false);
      notify("success", `${values.name} registered as ${id}.`);
    } catch {
      notify("error", `Couldn't register ${idKind}. Please try again.`);
    }
  }

  const roleLabel = idKind === "supplier" ? "Supplier" : "Collector";

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="btn btn-primary"
        >
          {showForm ? "Cancel" : `Register ${roleLabel}`}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-4 max-w-md space-y-4 card p-6"
          noValidate
        >
          <FormField label="Name" error={errors.name?.message}>
            <input
              className="field"
              {...register("name")}
            />
          </FormField>
          <FormField label="Contact (phone)" error={errors.contact?.message}>
            <input
              className="field"
              {...register("contact")}
            />
          </FormField>
          <FormField label="Address" error={errors.address?.message}>
            <input
              className="field"
              {...register("address")}
            />
          </FormField>
          <FormField label="Join date" error={errors.joinDate?.message}>
            <input
              type="date"
              className="field"
              {...register("joinDate")}
            />
          </FormField>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary w-full"
          >
            {isSubmitting ? "Registering…" : "Register"}
          </button>
        </form>
      )}

      {/* Both controls were named only by a placeholder (which vanishes on the
          first keystroke) or by nothing at all — WCAG 3.3.2. */}
      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="roster-search" className="mb-1 block text-sm font-medium text-gray-700">
            Search
          </label>
          <input
            id="roster-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, ID, or contact"
            className="field w-auto max-w-xs"
          />
        </div>
        <div>
          <label htmlFor="roster-status" className="mb-1 block text-sm font-medium text-gray-700">
            Status
          </label>
          <select
            id="roster-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="field w-auto"
          >
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
        </div>
        {(search || statusFilter !== "all") && (
          <p aria-live="polite" className="pb-2.5 text-sm text-gray-600">
            {filtered.length} of {records.length}
          </p>
        )}
      </div>

      <div className="mt-3">
        <ResponsiveTable
          columns={rosterColumns(detailBasePath)}
          rows={filtered}
          rowKey={(r) => r.id}
          loading={loading}
          cardTitle={(r) => r.name}
          emptyMessage={
            records.length === 0 ? (
              "None registered yet."
            ) : (
              <>No {idKind}s match the current search/filter.</>
            )
          }
        />
      </div>
    </div>
  );
}

function rosterColumns(detailBasePath: string): ResponsiveTableColumn<RosterRecord>[] {
  return [
    {
      key: "id",
      header: "ID",
      render: (r) => (
        <Link href={`${detailBasePath}?id=${r.id}`} className="text-gray-900 underline underline-offset-2">
          {r.id}
        </Link>
      ),
    },
    { key: "name", header: "Name", render: (r) => r.name, hideOnCard: true },
    { key: "contact", header: "Contact", render: (r) => r.contact },
    { key: "status", header: "Status", render: (r) => <StatusBadge active={r.active} /> },
    { key: "login", header: "Login", render: (r) => (r.authUid ? "Can sign in" : "No login yet") },
  ];
}
