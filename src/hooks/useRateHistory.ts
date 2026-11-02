"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { RateEntry } from "@/types/rate";

export function useRateHistory() {
  const [rates, setRates] = useState<RateEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "rateHistory"), orderBy("effectiveFrom", "desc"));
    const unsubscribe = onSnapshot(q, (snap) => {
      setRates(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RateEntry));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { rates, loading };
}
