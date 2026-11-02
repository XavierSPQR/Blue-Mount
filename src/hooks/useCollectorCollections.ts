"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CollectionEntry } from "@/types/collectionEntry";

/** All of a single collector's own collection entries, newest first. */
export function useCollectorCollections(collectorId: string | null) {
  const [entries, setEntries] = useState<CollectionEntry[]>([]);
  // Which collectorId the snapshot below has actually resolved data for —
  // same dedupe pattern as useRosterDoc, avoids a synchronous setState in
  // the effect body just to reset a "loading" flag.
  const [resolvedForId, setResolvedForId] = useState<string | null>(null);

  useEffect(() => {
    if (!collectorId) return;
    const q = query(
      collection(db, "collections"),
      where("collectorId", "==", collectorId),
      orderBy("date", "desc"),
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CollectionEntry));
      setResolvedForId(collectorId);
    });
    return unsubscribe;
  }, [collectorId]);

  const loading = !!collectorId && resolvedForId !== collectorId;
  return { entries: collectorId ? entries : [], loading };
}
