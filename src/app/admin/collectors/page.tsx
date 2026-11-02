import { RosterListPage } from "@/components/roster/RosterListPage";

export default function CollectorsPage() {
  return (
    <RosterListPage
      title="Collectors"
      collectionName="collectors"
      idKind="collector"
      detailBasePath="/admin/collectors/detail"
    />
  );
}
