import { Suspense } from "react";
import { RosterDetailPage } from "@/components/roster/RosterDetailPage";

export default function SupplierDetailPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Loading…</p>}>
      <RosterDetailPage
        collectionName="suppliers"
        idKind="supplier"
        role="supplier"
        backHref="/admin/suppliers"
        backLabel="← Back to Suppliers"
      />
    </Suspense>
  );
}
