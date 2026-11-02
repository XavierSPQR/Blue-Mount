"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { RosterCollection, RosterRecord } from "@/lib/roster";

export function useRosterList(collectionName: RosterCollection) {
  const [records, setRecords] = useState<RosterRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, collectionName), orderBy("name"));
    const unsubscribe = onSnapshot(q, (snap) => {
      setRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RosterRecord));
      setLoading(false);
    });
    return unsubscribe;
  }, [collectionName]);

  return { records, loading };
}

export function useRosterDoc(collectionName: RosterCollection, id: string | null) {
  const [record, setRecord] = useState<RosterRecord | null>(null);
  // uid-style dedupe: which id the snapshot below has actually resolved for,
  // so `loading` doesn't rely on a synchronous setState in the effect body.
  const [resolvedForId, setResolvedForId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = onSnapshot(
      doc(db, collectionName, id),
      (snap) => {
        setRecord(snap.exists() ? ({ id: snap.id, ...snap.data() } as RosterRecord) : null);
        setResolvedForId(id);
      },
      () => {
        setRecord(null);
        setResolvedForId(id);
      },
    );
    return unsubscribe;
  }, [collectionName, id]);

  const loading = !!id && resolvedForId !== id;
  return { record: id ? record : null, loading };
}
