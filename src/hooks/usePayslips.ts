"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Payslip } from "@/types/payslip";

export function useSupplierPayslips(supplierId: string | null) {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [resolvedForId, setResolvedForId] = useState<string | null>(null);

  useEffect(() => {
    if (!supplierId) return;
    const q = query(
      collection(db, "payslips"),
      where("supplierId", "==", supplierId),
      orderBy("periodStart", "desc"),
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setPayslips(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Payslip));
      setResolvedForId(supplierId);
    });
    return unsubscribe;
  }, [supplierId]);

  const loading = !!supplierId && resolvedForId !== supplierId;
  return { payslips: supplierId ? payslips : [], loading };
}
