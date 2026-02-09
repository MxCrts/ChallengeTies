import { useMemo } from "react";
import type { TFunction } from "i18next";

export type TodayHubPrimaryMode = "mark" | "new" | "pick" | "duoPending";

export type CurrentChallengeItem = {
  id?: string;
  challengeId?: string;
  title?: string;
  chatId?: string;
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

function translateMeta(
  m: ChallengeMeta | null,
  t: TFunction,
  langKey: string
): ChallengeMeta | null {
  if (!m) return null;
  const key =
    (typeof (m as any)?.chatId === "string" && (m as any).chatId.trim())
      ? (m as any).chatId.trim()
      : (typeof m.id === "string" ? m.id.trim() : "");

  // ⚠️ Aligné avec Explore : challenges.{chatId}.title/description
  const title =
    key
       ? t(`challenges.${key}.title`, { defaultValue: m.title || "" })
      : m.title || "";

  const description =
    key
       ? t(`challenges.${key}.description`, {
          defaultValue: m.description || "",
        })
      : m.description || "";

  // catégories.{rawCategory}
  const categoryRaw = m.category || "";
  const category =
    categoryRaw
      ? t(`categories.${categoryRaw}`, { defaultValue: categoryRaw })
      : "";

  return {
    ...m,
    title,
    description,
    category,
  };
}


type Params = {
  dayUtc: string;
  currentChallenges: CurrentChallengeItem[];
  hasOutgoingPendingInvite: boolean;
  pendingInvite: PendingInvite | null;

  // pools pour fallback meta
  allChallenges: ChallengeMeta[];
  dailyFive: ChallengeMeta[];

  t: TFunction;
  langKey: string;
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
  langKey,
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
  // 1) Si aucun défi actif : si invite pending -> on garde duoPending, sinon pick
  if (!hasActiveChallenges) return hasOutgoingPendingInvite ? "duoPending" : "pick";

  // 2) S’il reste au moins 1 défi à marquer aujourd’hui => priorité ABSOLUE
  if (anyUnmarkedToday) return "mark";

  // 3) Si tout est fait aujourd’hui => “new” (et pending devient secondaire)
  return "new";
}, [hasActiveChallenges, hasOutgoingPendingInvite, anyUnmarkedToday]);


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
         const chatId =
          (typeof (focusChallenge as any)?.chatId === "string" && (focusChallenge as any).chatId.trim())
            ? (focusChallenge as any).chatId.trim()
            : undefined;
        const meta = {
          id: focusChallengeId ?? "todayhub",
          chatId,
          title: localTitle || t("home.yourChallenge", { defaultValue: "Ton défi" }),
          description: localDesc || "",
          category: localCat || "",
          imageUrl: localImg || undefined,
        };
         return translateMeta(meta, t, langKey);
      }
    }

    // 2) fallback base
    const fallbackId = focusChallengeId;
    const fallbackChatId =
      (typeof (focusChallenge as any)?.chatId === "string" && (focusChallenge as any).chatId.trim())
        ? (focusChallenge as any).chatId.trim()
        : null;

    if (!fallbackId && !fallbackChatId) return null;

    const inAll =
      (fallbackChatId ? allChallenges.find((c: any) => c.chatId === fallbackChatId) : null) ??
      (fallbackId ? allChallenges.find((c) => c.id === fallbackId) : null);
   if (inAll) return translateMeta(inAll, t, langKey);
    const inDaily =
      (fallbackChatId ? dailyFive.find((c: any) => c.chatId === fallbackChatId) : null) ??
      (fallbackId ? dailyFive.find((c) => c.id === fallbackId) : null);
    return translateMeta(inDaily ?? null, t, langKey);
  }, [focusChallenge, focusChallengeId, allChallenges, dailyFive, t, langKey]);

  const pendingMeta = useMemo<ChallengeMeta | null>(() => {
    const id = pendingInvite?.challengeId;
    if (!id) return null;
    const raw =
      allChallenges.find((c) => c.id === id) ??
      dailyFive.find((c) => c.id === id) ??
      null;
   return translateMeta(raw, t, langKey);
  }, [pendingInvite?.challengeId, allChallenges, dailyFive, t, langKey]);

  const curatedMeta = useMemo<ChallengeMeta | null>(() => {
    // Apple-level: jamais “vide” → on montre un défi suggéré (dailyFive > allChallenges)
   const raw = dailyFive?.[0] ?? allChallenges?.[0] ?? null;
    return translateMeta(raw, t, langKey);
  }, [dailyFive, allChallenges, t, langKey]);

  const hubMeta = useMemo(() => {
  // Si le primary est duoPending => on montre le challenge de l’invite
  if (primaryMode === "duoPending") return pendingMeta ?? focusMeta;

  // Sinon si actif => focusMeta (défi à faire)
  if (hasActiveChallenges) return focusMeta;

  // Sinon suggestion
  return pendingMeta ?? curatedMeta;
}, [primaryMode, pendingMeta, focusMeta, hasActiveChallenges, curatedMeta]);

const hubChallengeId = useMemo(() => {
  if (primaryMode === "duoPending") return pendingInvite?.challengeId ?? focusChallengeId ?? null;
  if (hasActiveChallenges) return focusChallengeId;
  return (pendingMeta?.id ?? curatedMeta?.id ?? null) as any;
}, [primaryMode, pendingInvite?.challengeId, focusChallengeId, hasActiveChallenges, pendingMeta?.id, curatedMeta?.id]);


 const title = useMemo(() => {
    if (primaryMode === "duoPending") return t("homeZ.duoPending.title", { defaultValue: "Invite sent" });
    if (!hasActiveChallenges) return t("homeZ.todayHub.titleNone2", { defaultValue: "Choisis un défi" });
    return t("homeZ.todayHub.titleActive2", { defaultValue: "Aujourd’hui" });
  }, [primaryMode, hasActiveChallenges, t, langKey]);

  const subtitle = useMemo(() => {
    if (primaryMode === "duoPending")
      return t("homeZ.duoPending.hint", { defaultValue: "While waiting, set up your Duo." });
    if (!hasActiveChallenges) return t("homeZ.todayHub.subNone2", { defaultValue: "Solo ou à deux. Commence simple." });
    return t("homeZ.todayHub.subActive2", { defaultValue: "1 action. 1 jour. Zéro friction." });
  }, [primaryMode, hasActiveChallenges, t, langKey]);

  const primaryLabel = useMemo(() => {
  if (primaryMode === "mark") return t("homeZ.todayHub.primaryMark", { defaultValue: "Marquer aujourd’hui" });
  if (primaryMode === "duoPending") return t("homeZ.todayHub.primaryPending", { defaultValue: "Relancer" });
  if (primaryMode === "pick") return t("homeZ.todayHub.primaryPick", { defaultValue: "Choisir un défi" });
  return t("homeZ.todayHub.primaryNew", { defaultValue: "Nouveau défi" });
}, [primaryMode, t, langKey]);

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
