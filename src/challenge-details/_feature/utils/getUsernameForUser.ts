import { doc, getDoc } from "firebase/firestore";
import { db } from "@/constants/firebase-config";

export async function getUsernameForUser(uid: string): Promise<string> {
  if (!uid) return "Utilisateur";

  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return "Utilisateur";

    const data = snap.data() as any;

    const u =
      data?.username ||
      data?.displayName ||
      data?.name ||
      (typeof data?.email === "string" ? data.email.split("@")[0] : "") ||
      "Utilisateur";

    return String(u || "Utilisateur");
  } catch {
    return "Utilisateur";
  }
}
