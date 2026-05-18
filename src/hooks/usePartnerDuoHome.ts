import { useState, useEffect, useRef } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/constants/firebase-config";
export type PartnerDuoStatus = "marked" | "not_marked" | "unknown";
export type PartnerDuoInfo = {
  partnerName: string;
  status: PartnerDuoStatus;
};
type ActiveDuoChallenge = {
  duoPartnerId?: string | null;
  duoPartnerUsername?: string | null;
  challengeId?: string;
  id?: string;
  selectedDays?: number;
  uniqueKey?: string;
};
const todayKeyUTC = () => new Date().toISOString().slice(0, 10);
function resolvePartnerLastKey(partnerData: any, ch: ActiveDuoChallenge): string | null {
  const list: any[] = Array.isArray(partnerData?.CurrentChallenges)
    ? partnerData.CurrentChallenges : [];
  const baseId = ch.challengeId ?? ch.id;
  const mirror = list.find((c: any) => {
    if (ch.uniqueKey && c?.uniqueKey === ch.uniqueKey) return true;
    const cid = c?.challengeId ?? c?.id;
    return cid === baseId && Number(c?.selectedDays) === Number(ch.selectedDays ?? 0);
  });
  if (!mirror) return null;
  return mirror?.lastMarkedKey ?? mirror?.lastMarkedDate?.slice(0, 10) ?? null;
}
export function usePartnerDuoHome(
  activeDuoChallenge: ActiveDuoChallenge | null,
  dayUtc: string,
): PartnerDuoInfo | null {
  const [info, setInfo] = useState<PartnerDuoInfo | null>(null);
  const fetchedForRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
        if (!activeDuoChallenge?.duoPartnerId || typeof activeDuoChallenge.duoPartnerId !== "string") {
      setInfo(null);
      fetchedForRef.current = null;
      return;
    }
    const cacheKey = `${activeDuoChallenge.duoPartnerId}_${dayUtc}`;
    // Évite un fetch si même partenaire + même jour déjà chargé
    if (fetchedForRef.current === cacheKey) return;
    let cancelled = false;
    const run = async () => {
      try {
        const snap = await getDoc(doc(db, "users", activeDuoChallenge.duoPartnerId as string));
        if (cancelled) return;
        const data = snap.exists() ? snap.data() : null;
        // Nom : priorité duoPartnerUsername (déjà dispo) → fallback Firestore
        const partnerName =
          activeDuoChallenge.duoPartnerUsername?.trim() ||
          data?.username?.trim() ||
          data?.displayName?.trim() ||
          "Partenaire";
        // Statut : a-t-il marqué aujourd'hui ?
        let status: PartnerDuoStatus = "unknown";
        if (data) {
          const lastKey = resolvePartnerLastKey(data, activeDuoChallenge);
          status = lastKey === dayUtc ? "marked" : "not_marked";
        }
        fetchedForRef.current = cacheKey;
        setInfo({ partnerName, status });
        // Refresh léger dans 5 min si "not_marked" (partenaire peut marquer entre-temps)
        if (status === "not_marked") {
          timerRef.current = setTimeout(() => {
            fetchedForRef.current = null; // force re-fetch
             }, 5 * 60 * 1000);
        }
      } catch {
        // Silencieux — la card ne s'affiche pas si erreur réseau
        if (!cancelled) setInfo(null);
      }
    };
    run();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeDuoChallenge?.duoPartnerId, activeDuoChallenge?.uniqueKey, dayUtc]);
  return info;
}