import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function addGrade(name: string): Promise<string> {
  const ref = await addDoc(collection(db, "grades"), {
    name,
    active: true,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function renameGrade(id: string, name: string): Promise<void> {
  await updateDoc(doc(db, "grades", id), { name });
}

export async function setGradeActive(id: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, "grades", id), { active });
}
