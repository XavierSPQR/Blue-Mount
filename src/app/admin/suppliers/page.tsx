import { RosterListPage } from "@/components/roster/RosterListPage";

export default function SuppliersPage() {
  return (
    <RosterListPage
      title="Suppliers"
      collectionName="suppliers"
      idKind="supplier"
      detailBasePath="/admin/suppliers/detail"
    />
  );
}
