import { Suspense } from "react";
import { RosterDetailPage } from "@/components/roster/RosterDetailPage";

export default function CollectorDetailPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Loading…</p>}>
      <RosterDetailPage
        collectionName="collectors"
        idKind="collector"
        role="collector"
        backHref="/admin/collectors"
        backLabel="← Back to Collectors"
      />
    </Suspense>
  );
}
