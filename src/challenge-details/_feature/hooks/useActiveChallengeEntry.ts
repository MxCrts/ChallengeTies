import { useEffect, useRef } from "react";
import { auth, db } from "@/constants/firebase-config";
import { doc, onSnapshot, runTransaction } from "firebase/firestore";
import { deriveDuoInfoFromUniqueKey } from "../utils/deriveDuoInfoFromUniqueKey";

type Args = {
  id: string | string[] | undefined;

  // prefs (doivent rester "fresh" sans re-subscribe)
  currentChallenge: any;
  duoState: any;
  finalSelectedDays: number;
  localSelectedDays: number;

  // setters existants du screen (0 refactor usage)
  setWarmupDoneToday: (v: boolean) => void;
  setActiveEntry: (v: any) => void;
  setDuoState: (v: any) => void;
  setFinalSelectedDays: (v: number) => void;
  setFinalCompletedDays: (v: number) => void;

  // refs existants
  cleanupSoloRef: React.MutableRefObject<boolean>;

  // helper existant
  warmupDayKeyLocal: () => string;
};

export function useActiveChallengeEntry({
  id,
  currentChallenge,
  duoState,
  finalSelectedDays,
  localSelectedDays,
  setWarmupDoneToday,
  setActiveEntry,
  setDuoState,
  setFinalSelectedDays,
  setFinalCompletedDays,
  cleanupSoloRef,
  warmupDayKeyLocal,
}: Args) {
  // ✅ refs pour garder EXACTEMENT le même comportement qu’avant :
  // subscribe 1 fois sur [id], et dans le callback on lit les valeurs "fresh"
  const currentChallengeRef = useRef<any>(currentChallenge);
  const duoStateRef = useRef<any>(duoState);
  const finalSelectedDaysRef = useRef<number>(finalSelectedDays);
  const localSelectedDaysRef = useRef<number>(localSelectedDays);

  useEffect(() => {
    currentChallengeRef.current = currentChallenge;
  }, [currentChallenge]);

  useEffect(() => {
    duoStateRef.current = duoState;
  }, [duoState]);

  useEffect(() => {
    finalSelectedDaysRef.current = finalSelectedDays;
  }, [finalSelectedDays]);

  useEffect(() => {
    localSelectedDaysRef.current = localSelectedDays;
  }, [localSelectedDays]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    const challengeId = Array.isArray(id) ? id[0] : id;
    if (!uid || !challengeId) return;

    const userRef = doc(db, "users", uid);

    const unsub = onSnapshot(
      userRef,
      (snap) => {
        const data = snap.data() as any;

        // ✅ Warmup state (ne dépend pas de CurrentChallenges)
        try {
          const k = warmupDayKeyLocal();

          const warmupNew = data?.warmup || {};
          const warmupLegacy = data?.warmups || {};

          const done = !!warmupNew?.[k]?.[challengeId] || !!warmupLegacy?.[k]?.[challengeId];
          setWarmupDoneToday(done);
        } catch {}

        const list: any[] = Array.isArray(data?.CurrentChallenges) ? data.CurrentChallenges : [];

        // ✅ Match toutes les entrées liées à ce challenge
        const matches = list.filter((c) => {
          const cid = c?.challengeId ?? c?.id;
          return cid === challengeId;
        });

        // ✅ Résolution déterministe de l'entrée "active"
        const cc = currentChallengeRef.current;
        const ds = duoStateRef.current;

        const preferredUniqueKey =
          (cc as any)?.uniqueKey ||
          (ds as any)?.uniqueKey ||
          null;

        const preferredDaysRaw =
          (cc as any)?.selectedDays ??
          finalSelectedDaysRef.current ??
          localSelectedDaysRef.current ??
          0;

        const preferredDays = Number(preferredDaysRaw) || 0;

        const byKey =
          preferredUniqueKey
            ? matches.find((m) => !!m?.uniqueKey && m.uniqueKey === preferredUniqueKey)
            : undefined;

        const duoEntry = matches.find((m) => !!m.duo);
        const soloByDays =
          preferredDays > 0
            ? matches.find((m) => !m.duo && Number(m?.selectedDays || 0) === preferredDays)
            : undefined;
        const firstSolo = matches.find((m) => !m.duo);

        const entry = byKey || duoEntry || soloByDays || firstSolo || matches[0];
        setActiveEntry(entry);

        if (!entry) {
          setDuoState((prev: any) => (prev?.enabled ? { enabled: false } : prev));
          return;
        }

        // 🧹 Auto-cleanup : si duo + solo coexistent, on supprime solo
        if (
          matches.length > 1 &&
          matches.some((m) => !!m.duo) &&
          matches.some((m) => !m.duo) &&
          !cleanupSoloRef.current
        ) {
          cleanupSoloRef.current = true;

          runTransaction(db, async (tx) => {
            const snap2 = await tx.get(userRef);
            if (!snap2.exists()) return;
            const data2 = snap2.data() as any;
            const list2: any[] = Array.isArray(data2?.CurrentChallenges) ? data2.CurrentChallenges : [];
            const cleaned = list2.filter((c) => {
              const cid = c?.challengeId ?? c?.id;
              if (cid === challengeId && !c?.duo) return false; // garde tout sauf SOLO
              return true;
            });
            tx.update(userRef, { CurrentChallenges: cleaned });
          })
            .catch((e) => console.warn("cleanup solo failed (non bloquant):", e))
            .finally(() => {
              cleanupSoloRef.current = false;
            });
        }

        // ✅ selectedDays sync (cast SAFE)
        const sel = Number(entry?.selectedDays ?? 0);
        setFinalSelectedDays(Number.isFinite(sel) && sel > 0 ? sel : 0);

        // ✅ completedDays robuste
        let computedCompleted = 0;
        const rawCompleted = entry?.completedDays;

        if (typeof rawCompleted === "number") {
          computedCompleted = rawCompleted;
        } else if (typeof rawCompleted === "string") {
          const n = Number(rawCompleted);
          computedCompleted = Number.isFinite(n) ? n : 0;
        } else if (Array.isArray(entry?.completionDates)) {
          computedCompleted = entry.completionDates.length;
        }

        setFinalCompletedDays(
          Number.isFinite(computedCompleted) && computedCompleted >= 0 ? computedCompleted : 0
        );

        // 🧠 recalc duo à partir uniqueKey + uid
        const { isDuo, duoPartnerId } = deriveDuoInfoFromUniqueKey(
          {
            challengeId: entry.challengeId ?? entry.id,
            id: entry.id,
            uniqueKey: entry.uniqueKey,
            duo: entry.duo,
            duoPartnerId: entry.duoPartnerId,
            duoPartnerUsername: entry.duoPartnerUsername,
            selectedDays: entry.selectedDays,
          },
          uid
        );

        if (isDuo && duoPartnerId) {
          setDuoState({
            enabled: true,
            partnerId: duoPartnerId,
            selectedDays: entry.selectedDays,
            uniqueKey: entry.uniqueKey || `${entry.challengeId ?? entry.id}_${entry.selectedDays}`,
          });
        } else {
          setDuoState((prev: any) => (prev?.enabled ? { enabled: false } : prev));
        }
      },
      (error) => {
        console.error("❌ user CurrentChallenges snapshot error:", error);
      }
    );

    return () => unsub();
    // ✅ EXACTEMENT comme ton code: dépend uniquement de id (pas de resub sur prefs)
  }, [id, warmupDayKeyLocal, cleanupSoloRef, setWarmupDoneToday, setActiveEntry, setDuoState, setFinalSelectedDays, setFinalCompletedDays]);
}
