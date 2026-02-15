import { useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/constants/firebase-config";

type TFn = (key: string, opts?: any) => string;

type DuoStateLike = {
  enabled?: boolean;
  partnerId?: string | null;
  selectedDays?: number;
  uniqueKey?: string | null;
};

type Args = {
  id: string | string[] | undefined;
  duoState: DuoStateLike;
  t: TFn;
  resolveAvatarUrl: (raw?: string) => Promise<string>;
  setPartnerAvatar: (v: string) => void;
  setDuoChallengeData: (v: any | null) => void;
};

/**
 * ✅ Mirror snapshot du partenaire (duo)
 * - Résout nom + avatar (support Firebase Storage)
 * - Lit l'entrée miroir dans partnerData.CurrentChallenges
 * - Met à jour duoChallengeData + partnerAvatar
 *
 * ⚠️ Logique inchangée : c'est juste déplacé du screen.
 */
export function usePartnerDuoSnapshot({
  id,
  duoState,
  t,
  resolveAvatarUrl,
  setPartnerAvatar,
  setDuoChallengeData,
}: Args) {
  useEffect(() => {
    if (!duoState?.enabled || !duoState?.partnerId) {
      setDuoChallengeData(null);
      return;
    }

    const partnerRef = doc(db, "users", duoState.partnerId);

    const unsub = onSnapshot(
      partnerRef,
      async (partnerSnap) => {
        if (!partnerSnap.exists()) {
          setDuoChallengeData(null);
          return;
        }

        const partnerData = partnerSnap.data() as any;
        const partnerName =
          partnerData.username ||
          partnerData.displayName ||
          (typeof partnerData.email === "string"
            ? partnerData.email.split("@")[0]
            : "") ||
          t("duo.partner");

        const rawAvatar =
          partnerData.profileImage ||
          partnerData.avatar ||
          partnerData.avatarUrl ||
          partnerData.photoURL ||
          partnerData.photoUrl ||
          partnerData.imageUrl ||
          "";

        let resolvedPartnerAvatar = "";
        try {
          resolvedPartnerAvatar = (await resolveAvatarUrl(rawAvatar)) || rawAvatar;
        } catch {}

        if (!resolvedPartnerAvatar) {
          resolvedPartnerAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
            partnerName || "P"
          )}`;
        }

        // entrée miroir côté partenaire
        const partnerList: any[] = Array.isArray(partnerData.CurrentChallenges)
          ? partnerData.CurrentChallenges
          : [];

        const mirror = partnerList.find((c: any) => {
          if (duoState.uniqueKey && c?.uniqueKey) return c.uniqueKey === duoState.uniqueKey;
          const cid = c?.challengeId ?? c?.id;
          return cid === id && c?.selectedDays === (duoState.selectedDays || 0);
        });

        // ✅ jours sélectionnés : miroir > duoState > 0
        const partnerSelectedDays =
          typeof mirror?.selectedDays === "number" && mirror.selectedDays > 0
            ? mirror.selectedDays
            : duoState.selectedDays || 0;

        // ✅ completedDays robuste : chiffre direct OU length de completionDates
        let partnerCompleted = 0;
        if (mirror) {
          if (typeof mirror.completedDays === "number") {
            partnerCompleted = mirror.completedDays;
          } else if (Array.isArray(mirror.completionDates)) {
            partnerCompleted = mirror.completionDates.length;
          }
        }

        setPartnerAvatar(resolvedPartnerAvatar);
        setDuoChallengeData({
          duo: true,
          duoUser: {
            id: duoState.partnerId,
            name: partnerName,
            avatar: resolvedPartnerAvatar,
            completedDays: partnerCompleted,
            selectedDays: partnerSelectedDays,
            isPioneer: !!partnerData.isPioneer,
          },
        });
      },
      (e) => console.error("❌ partner onSnapshot error:", e)
    );

    return () => unsub();
  }, [
    duoState?.enabled,
    duoState?.partnerId,
    duoState?.selectedDays,
    duoState?.uniqueKey,
    id,
    t,
    resolveAvatarUrl,
    setPartnerAvatar,
    setDuoChallengeData,
  ]);
}
