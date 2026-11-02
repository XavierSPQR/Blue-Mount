"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CollectionEntry } from "@/types/collectionEntry";

/** Company-wide collections feed — admin only (Firestore rules enforce this). */
export function useAllCollections() {
  const [entries, setEntries] = useState<CollectionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "collections"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CollectionEntry));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { entries, loading };
}
