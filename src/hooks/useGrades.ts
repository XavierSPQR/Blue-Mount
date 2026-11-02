"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Grade } from "@/types/grade";

export function useGrades() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "grades"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (snap) => {
      setGrades(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Grade));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { grades, loading };
}
