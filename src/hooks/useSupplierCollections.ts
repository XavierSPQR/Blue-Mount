"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CollectionEntry } from "@/types/collectionEntry";

/** Mirrors useCollectorCollections — a single supplier's own entries, newest first. */
export function useSupplierCollections(supplierId: string | null) {
  const [entries, setEntries] = useState<CollectionEntry[]>([]);
  const [resolvedForId, setResolvedForId] = useState<string | null>(null);

  useEffect(() => {
    if (!supplierId) return;
    const q = query(
      collection(db, "collections"),
      where("supplierId", "==", supplierId),
      orderBy("date", "desc"),
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CollectionEntry));
      setResolvedForId(supplierId);
    });
    return unsubscribe;
  }, [supplierId]);

  const loading = !!supplierId && resolvedForId !== supplierId;
  return { entries: supplierId ? entries : [], loading };
}
