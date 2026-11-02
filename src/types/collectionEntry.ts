export interface CollectionEntry {
  id: string;
  supplierId: string;
  collectorId: string;
  date: string; // ISO date (yyyy-mm-dd) — chosen so lexicographic string comparison sorts/filters correctly
  gradeId: string; // grades/{id} — the quality grade the collector assigned; drives which rate applies
  quantityKg: number;
  createdBy: string; // Firebase Auth uid of the collector who recorded it
}
