"use client";

import { useMemo, useState } from "react";
import { useRosterList } from "@/hooks/useRoster";
import { StatusBadge } from "@/components/StatusBadge";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/ResponsiveTable";
import type { RosterRecord } from "@/lib/roster";

const columns: ResponsiveTableColumn<RosterRecord>[] = [
  { key: "id", header: "ID", render: (s) => s.id, hideOnCard: true },
  { key: "name", header: "Name", render: (s) => s.name },
  { key: "contact", header: "Contact", render: (s) => s.contact },
  { key: "status", header: "Status", render: (s) => <StatusBadge active={s.active} /> },
];

/** Read-only roster — collectors need to know who's active when picking a supplier to record against; editing stays admin-only (Firestore rules enforce this regardless of what this page does or doesn't show). */
export default function CollectorSuppliersPage() {
  const { records: suppliers, loading } = useRosterList("suppliers");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || s.contact.toLowerCase().includes(q),
    );
  }, [suppliers, search]);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Suppliers</h1>
      <div className="mt-4">
        <label htmlFor="supplier-search" className="mb-1 block text-sm font-medium text-gray-700">
          Search
        </label>
        <input
          id="supplier-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name, ID, or contact"
          className="field w-auto max-w-xs"
        />
      </div>
      <div className="mt-3">
        <ResponsiveTable
          columns={columns}
          rows={filtered}
          rowKey={(s) => s.id}
          loading={loading}
          cardTitle={(s) => s.name}
          emptyMessage={suppliers.length === 0 ? "No suppliers yet." : <>No suppliers match &ldquo;{search}&rdquo;.</>}
        />
      </div>
    </div>
  );
}
