"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { SupplierRequest } from "@/types/request";

export function useSupplierRequests(supplierId: string | null) {
  const [requests, setRequests] = useState<SupplierRequest[]>([]);
  const [resolvedForId, setResolvedForId] = useState<string | null>(null);

  useEffect(() => {
    if (!supplierId) return;
    const q = query(
      collection(db, "requests"),
      where("supplierId", "==", supplierId),
      orderBy("requestedAt", "desc"),
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SupplierRequest));
      setResolvedForId(supplierId);
    });
    return unsubscribe;
  }, [supplierId]);

  const loading = !!supplierId && resolvedForId !== supplierId;
  return { requests: supplierId ? requests : [], loading };
}

/** `enabled` defaults true; pass false until the caller knows it's actually
 * allowed to read this collection (e.g. an admin-only layout waiting on role
 * resolution) so a non-admin session doesn't open a listener Firestore rules
 * will just reject. */
export function useAllRequests(enabled = true) {
  const [requests, setRequests] = useState<SupplierRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    const q = query(collection(db, "requests"), orderBy("requestedAt", "desc"));
    const unsubscribe = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SupplierRequest));
      setLoading(false);
    });
    return unsubscribe;
  }, [enabled]);

  return { requests: enabled ? requests : [], loading: enabled && loading };
}
