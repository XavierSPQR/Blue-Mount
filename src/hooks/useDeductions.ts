"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Deduction } from "@/types/deduction";

export function useSupplierDeductions(supplierId: string | null) {
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [resolvedForId, setResolvedForId] = useState<string | null>(null);

  useEffect(() => {
    if (!supplierId) return;
    const q = query(
      collection(db, "deductions"),
      where("supplierId", "==", supplierId),
      orderBy("createdAt", "desc"),
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setDeductions(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Deduction));
      setResolvedForId(supplierId);
    });
    return unsubscribe;
  }, [supplierId]);

  const loading = !!supplierId && resolvedForId !== supplierId;
  return { deductions: supplierId ? deductions : [], loading };
}

export function useAllDeductions() {
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "deductions"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snap) => {
      setDeductions(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Deduction));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { deductions, loading };
}
