import { useMemo } from "react";
import type { TFunction } from "i18next";

export type TodayHubPrimaryMode = "mark" | "new" | "duo" | "duoPending";

export type CurrentChallengeItem = {
  id?: string;
  challengeId?: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  category?: string;

  completed?: boolean;
  archived?: boolean;

  duo?: boolean;

  completedDays?: number;
  selectedDays?: number;

  // champs possibles “mark”
  markedDateUTC?: string;
  markedDate?: string;
  lastMarkedDate?: string;
  lastMarkedUTC?: string;
  lastDoneDate?: string;
  lastCompletedDate?: string;
  lastCompletionDate?: string;
  completedDate?: string;
  completedAtDate?: string;
  progress?: {
    lastMarkedDate?: string;
    markedDateUTC?: string;
    lastDoneDate?: string;
  };
};

export type PendingInvite = {
  id: string;
  challengeId: string;
  selectedDays?: number;
  inviteeUsername?: string;
  createdAt?: any;
};

export type ChallengeMeta = {
  id: string;
  title: string;
  description?: string;
  category?: string;
  imageUrl?: string;
};


type Params = {
  dayUtc: string;
  currentChallenges: CurrentChallengeItem[];
  hasOutgoingPendingInvite: boolean;
  pendingInvite: PendingInvite | null;

  // pools pour fallback meta
  allChallenges: ChallengeMeta[];
  dailyFive: ChallengeMeta[];

  t: TFunction;
};

function isActive(c: any) {
  return !!c && !c.completed && !c.archived;
}

export function useTodayHubState({
  dayUtc,
  currentChallenges,
  hasOutgoingPendingInvite,
  pendingInvite,
  allChallenges,
  dailyFive,
  t,
}: Params) {
  const activeChallenges = useMemo(
    () => currentChallenges.filter(isActive),
    [currentChallenges]
  );

  const hasActiveChallenges = activeChallenges.length > 0;

  const isMarkedToday = useMemo(() => {
    return (c?: any) => {
      if (!c) return false;
      const today = dayUtc;

      const direct =
        c.markedDateUTC ??
        c.markedDate ??
        c.lastMarkedDate ??
        c.lastMarkedUTC ??
        c.lastDoneDate ??
        c.lastCompletedDate ??
        c.lastCompletionDate ??
        c.completedDate ??
        c.completedAtDate;

      if (typeof direct === "string") {
        const key = direct.length >= 10 ? direct.slice(0, 10) : direct;
        return key === today;
      }

      if (direct && typeof direct === "object" && typeof direct.toDate === "function") {
        const d = direct.toDate?.();
        const key = d?.toISOString?.()?.slice(0, 10);
        return key === today;
      }

      if (direct instanceof Date) {
        return direct.toISOString().slice(0, 10) === today;
      }

      const nested =
        c.progress?.lastMarkedDate ??
        c.progress?.markedDateUTC ??
        c.progress?.lastDoneDate;

      if (typeof nested === "string") {
        const key = nested.length >= 10 ? nested.slice(0, 10) : nested;
        return key === today;
      }

      return false;
    };
  }, [dayUtc]);

  const focusChallenge = useMemo<CurrentChallengeItem | null>(() => {
    if (!activeChallenges.length) return null;
    return activeChallenges.find((c) => !isMarkedToday(c)) ?? activeChallenges[0];
  }, [activeChallenges, isMarkedToday]);

  const focusChallengeId = useMemo(() => {
    const id = (focusChallenge?.challengeId ?? focusChallenge?.id) as any;
    return typeof id === "string" && id.trim() ? id.trim() : null;
  }, [focusChallenge]);

  const anyUnmarkedToday = useMemo(() => {
    if (!activeChallenges.length) return false;
    return activeChallenges.some((c) => !isMarkedToday(c));
  }, [activeChallenges, isMarkedToday]);

  const primaryMode = useMemo<TodayHubPrimaryMode>(() => {
    if (hasOutgoingPendingInvite) return "duoPending";
    if (!hasActiveChallenges) return "duo";
    return anyUnmarkedToday ? "mark" : "new";
  }, [hasOutgoingPendingInvite, hasActiveChallenges, anyUnmarkedToday]);

  const progress = useMemo(() => {
    const done = typeof focusChallenge?.completedDays === "number" ? focusChallenge.completedDays : 0;
    const total = typeof focusChallenge?.selectedDays === "number" ? focusChallenge.selectedDays : 0;
    const safeTotal = Math.max(total, 0);
    const safeDone = Math.max(Math.min(done, safeTotal || done), 0);
    const pct = safeTotal > 0 ? safeDone / safeTotal : 0;
    return { done: safeDone, total: safeTotal, pct: Math.max(0, Math.min(pct, 1)) };
  }, [focusChallenge]);

  const focusMeta = useMemo<ChallengeMeta | null>(() => {
    // 1) si meta déjà dans CurrentChallenges
    if (focusChallenge) {
      const localTitle = typeof focusChallenge.title === "string" ? focusChallenge.title.trim() : "";
      const localDesc = typeof focusChallenge.description === "string" ? focusChallenge.description.trim() : "";
      const localCat = typeof (focusChallenge as any)?.category === "string" ? (focusChallenge as any).category : "";
      const localImg = typeof (focusChallenge as any)?.imageUrl === "string" ? (focusChallenge as any).imageUrl.trim() : "";

      if (localTitle || localDesc || localImg) {
        return {
          id: focusChallengeId ?? "todayhub",
          title: localTitle || t("home.yourChallenge", { defaultValue: "Ton défi" }),
          description: localDesc || "",
          category: localCat || "",
          imageUrl: localImg || undefined,
        };
      }
    }

    // 2) fallback base
    if (!focusChallengeId) return null;
    const inAll = allChallenges.find((c) => c.id === focusChallengeId);
    if (inAll) return inAll;
    const inDaily = dailyFive.find((c) => c.id === focusChallengeId);
    return inDaily ?? null;
  }, [focusChallenge, focusChallengeId, allChallenges, dailyFive, t]);

  const pendingMeta = useMemo<ChallengeMeta | null>(() => {
    const id = pendingInvite?.challengeId;
    if (!id) return null;
    return (
      allChallenges.find((c) => c.id === id) ??
      dailyFive.find((c) => c.id === id) ??
      null
    );
  }, [pendingInvite?.challengeId, allChallenges, dailyFive]);

  const hubMeta = useMemo(() => {
    // si pending invite => on préfère afficher le challenge de l'invite
    if (hasOutgoingPendingInvite) return pendingMeta ?? focusMeta;
    // si actif => focusMeta, sinon pendingMeta (au cas où)
    return hasActiveChallenges ? focusMeta : pendingMeta;
  }, [hasOutgoingPendingInvite, pendingMeta, hasActiveChallenges, focusMeta]);

  const hubChallengeId = useMemo(() => {
    if (hasOutgoingPendingInvite) return pendingInvite?.challengeId ?? focusChallengeId ?? null;
    return hasActiveChallenges ? focusChallengeId : null;
  }, [hasOutgoingPendingInvite, pendingInvite?.challengeId, focusChallengeId, hasActiveChallenges]);

 const title = useMemo(() => {
    if (primaryMode === "duoPending") return t("homeZ.todayHub.titlePending", { defaultValue: "Invitation envoyée" });
    if (!hasActiveChallenges) return t("homeZ.todayHub.titleNone2", { defaultValue: "Choisis un défi" });
    return t("homeZ.todayHub.titleActive2", { defaultValue: "Aujourd’hui" });
  }, [primaryMode, hasActiveChallenges, t]);

  const subtitle = useMemo(() => {
    if (primaryMode === "duoPending") return t("homeZ.todayHub.subPending", { defaultValue: "En attente de réponse…" });
    if (!hasActiveChallenges) return t("homeZ.todayHub.subNone2", { defaultValue: "Solo ou à deux. Commence simple." });
    return t("homeZ.todayHub.subActive2", { defaultValue: "1 action. 1 jour. Zéro friction." });
  }, [primaryMode, hasActiveChallenges, t]);

  const primaryLabel = useMemo(() => {
    if (primaryMode === "mark") return t("homeZ.todayHub.primaryMark", { defaultValue: "Marquer aujourd’hui" });
    if (primaryMode === "new") return t("homeZ.todayHub.primaryNew", { defaultValue: "Nouveau défi" });
    if (primaryMode === "duoPending") return t("homeZ.todayHub.primaryPending", { defaultValue: "Relancer" });
    return t("homeZ.todayHub.primaryDuo", { defaultValue: "Inviter un ami" });
  }, [primaryMode, t]);

  return {
    primaryMode,
    hasActiveChallenges,
    activeCount: activeChallenges.length,
    anyUnmarkedToday,
    focusChallenge,
    focusChallengeId,
    hubMeta,
    hubChallengeId,
    progress,
    title,
    subtitle,
    primaryLabel,
  };
}
