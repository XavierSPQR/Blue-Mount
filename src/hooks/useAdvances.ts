"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Advance } from "@/types/advance";

export function useSupplierAdvances(supplierId: string | null) {
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [resolvedForId, setResolvedForId] = useState<string | null>(null);

  useEffect(() => {
    if (!supplierId) return;
    const q = query(
      collection(db, "advances"),
      where("supplierId", "==", supplierId),
      orderBy("createdAt", "desc"),
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setAdvances(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Advance));
      setResolvedForId(supplierId);
    });
    return unsubscribe;
  }, [supplierId]);

  const loading = !!supplierId && resolvedForId !== supplierId;
  return { advances: supplierId ? advances : [], loading };
}

/** See useAllRequests' `enabled` doc — same reasoning applies here. */
export function useAllAdvances(enabled = true) {
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    const q = query(collection(db, "advances"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snap) => {
      setAdvances(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Advance));
      setLoading(false);
    });
    return unsubscribe;
  }, [enabled]);

  return { advances: enabled ? advances : [], loading: enabled && loading };
}
