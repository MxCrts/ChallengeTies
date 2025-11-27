// src/services/metricsService.ts
import { doc, increment, updateDoc, getDoc, setDoc, arrayUnion, runTransaction } from "firebase/firestore";
import { db } from "@/constants/firebase-config";
import { dayKeyUTC } from "@/hooks/useTrophiesEconomy";

/**
 * Toutes les stats sont sous users/{uid}.stats.* (sauf traces techniques).
 * Zéro rupture si le champ est absent : on fait des increments / sets idempotents.
 *
 * Structure visée (exemples) :
 * stats: {
 *   inviteFriend: { accepted: number },
 *   duo: { completed: number, streakMax: number, messages: number },
 *   perfectMonth: { count: number },
 *   categories: { mastered: number },
 *   referrals: { registered: number },
 *   focus: { current: number, daysMax: number },
 *   dailyCompletion: { current: number, max: number },
 *   seasonal: { completed: number },
 *   zeroMissLongRun30: boolean,
 *   zeroMissLongRun60: boolean,
 *   lastGlobalMarkKey: string,       // "YYYY-MM-DD" pour le streak global
 *   lastFocusMarkKey: string,        // idem mais pour le focus
 *   monthlyDayMarks: { [YYYYMM: string]: number } // jours cochés ce mois
 * }
 */

const userRef = (uid: string) => doc(db, "users", uid);

// ---------- helpers génériques ----------
async function ensureUserDoc(uid: string) {
  await setDoc(userRef(uid), { stats: {} }, { merge: true });
}

export async function incStat(uid: string, path: string, by = 1) {
  await ensureUserDoc(uid);
  await updateDoc(userRef(uid), { [`stats.${path}`]: increment(by) });
}



export async function setMax(uid: string, path: string, candidate: number) {
  await ensureUserDoc(uid);
  const ref = userRef(uid);
  const snap = await getDoc(ref);
  const cur = snap.get(`stats.${path}`);
  const newVal = typeof cur === "number" ? Math.max(cur, candidate) : candidate;
  await updateDoc(ref, { [`stats.${path}`]: newVal });
}

export async function setBool(uid: string, path: string, val: boolean) {
  await ensureUserDoc(uid);
  await updateDoc(userRef(uid), { [`stats.${path}`]: !!val });
}

// Utilise arrayUnion pour éviter les conditions de course (lecture/écriture)
export async function addToSet(uid: string, arrayPath: string, value: string) {
  await ensureUserDoc(uid);
  await updateDoc(userRef(uid), { [`stats.${arrayPath}`]: arrayUnion(value) });
}

// ---------- Spécifiques counters demandés (alignés avec trophiesHelper) ----------
/** Invitations acceptées → stats.inviteFriend.accepted */
export async function markInviteAccepted(uid: string) {
  return incStat(uid, "inviteFriend.accepted", 1);
}

/** Referral inscrit → stats.referrals.registered */
export async function markReferralRegistered(uid: string) {
  return incStat(uid, "referrals.registered", 1);
}

/** Messages de chat duo → stats.duo.messages */
export async function incDuoMessages(uid: string, by = 1) {
  return incStat(uid, "duo.messages", by);
}

/** Fin d’un défi en duo → stats.duo.completed */
export async function recordDuoFinish(uid: string) {
  return incStat(uid, "duo.completed", 1);
}

/** Streak duo max → stats.duo.streakMax */
export async function bumpDuoStreak(uid: string, duoStreakNow: number) {
  // on peut garder la valeur courante si utile ailleurs, mais le helper succès ne lit que streakMax
  await ensureUserDoc(uid);
  await updateDoc(userRef(uid), { "stats.duo.current": duoStreakNow });
  await setMax(uid, "duo.streakMax", duoStreakNow); // attention: setMax ajoute "stats." automatiquement
}

/**
 * Catégorie complétée : maintient
 * - un tableau racine `categoriesCompleted` (compat checkForAchievements)
 * - et le compteur `stats.categories.mastered`
 */
export async function addCompletedCategory(uid: string, category?: string | null) {
  const clean = String(category || "").trim();
  if (!clean) return;
  const ref = userRef(uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      tx.set(ref, { stats: {}, categoriesCompleted: [] }, { merge: true });
    }
    const data = snap.data() || {};
    const curr: string[] = Array.isArray(data.categoriesCompleted) ? data.categoriesCompleted : [];
    if (curr.includes(clean)) return;
    const next = [...curr, clean];
    tx.update(ref, {
      categoriesCompleted: next,
      "stats.categories.mastered": next.length,
    });
  });
}

/** Évènement saisonnier → stats.seasonal.completed */
export async function recordSeasonalCompleted(uid: string) {
  return incStat(uid, "seasonal.completed", 1);
}

/** Partage de challenge → stats.shareChallenge.total (bucket générique) */
export async function recordShare(uid: string) {
  return incStat(uid, "shareChallenge.total", 1);
}

/** Vote feature → stats.voteFeature.total (bucket générique) */
export async function recordVote(uid: string) {
  return incStat(uid, "voteFeature.total", 1);
}

/** Sauvegarde challenge → stats.saveChallenge.total (bucket générique) */
export async function recordSave(uid: string) {
  return incStat(uid, "saveChallenge.total", 1);
}

/** Message envoyé (chat) → stats.messageSent.total (bucket générique) */
export async function recordChatMessage(uid: string) {
  return incStat(uid, "messageSent.total", 1);
}

/** Création de challenge → stats.created.count (palier "challengeCreated") */
export async function recordChallengeCreated(uid: string) {
  return incStat(uid, "created.count", 1);
}
/** Sélection d'une durée → stats.selectChallengeDays.{7|30|90|180|365} */
export type SelectDaysBucket = 7 | 30 | 90 | 180 | 365;
export async function recordSelectDays(uid: string, bucket: SelectDaysBucket) {
  return incStat(uid, `selectChallengeDays.${bucket}`, 1);
}
/**
 * Pic d’adoption d’un challenge créé → stats.created.maxParticipants
 * (à appeler côté CF de préférence, mais dispo côté client si nécessaire)
 */
export async function setCreatedMaxParticipants(uid: string, value: number) {
  await ensureUserDoc(uid);
  const ref = userRef(uid);
  const snap = await getDoc(ref);
  const cur = Number(snap.get("stats.created.maxParticipants") || 0);
  if (value > cur) {
    await updateDoc(ref, { "stats.created.maxParticipants": value });
  }
}

// ---------- streak global "au moins 1 validation / jour" ----------
export async function recordDailyGlobalMark(uid: string, date: Date) {
  await ensureUserDoc(uid);
  const ref = userRef(uid);
  const snap = await getDoc(ref);

  const todayKey = dayKeyUTC(date);
  const lastKey = snap.get("stats.lastGlobalMarkKey") as string | undefined;

  let current = Number(snap.get("stats.dailyCompletion.current") ?? 0);
  if (!lastKey) {
    current = 1;
  } else {
    // on compare des "YYYY-MM-DD"
    const d = diffDaysStr(lastKey, todayKey);
    if (d === 0) {
      // déjà compté aujourd'hui → on ne bouge pas
      return;
    } else if (d === 1) {
      current = current + 1;
    } else if (d > 1) {
      current = 1; // streak rompu
    } else {
      // marquage dans le passé → on ignore pour le compteur "continu"
      return;
    }
  }

  await updateDoc(ref, {
    "stats.lastGlobalMarkKey": todayKey,
    "stats.dailyCompletion.current": current,
  });
  await setMax(uid, "dailyCompletion.max", current);

  // Compat avec trophiesHelper (qui lit racine zeroMissLongRun{30,60})
  if (current >= 30) {
    await updateDoc(ref, { zeroMissLongRun30: true, "stats.zeroMissLongRun30": true });
  }
  if (current >= 60) {
    await updateDoc(ref, { zeroMissLongRun60: true, "stats.zeroMissLongRun60": true });
  }

  // suivi mensuel pour "perfectMonths"
  const ym = todayKey.slice(0, 7).replace("-", ""); // "YYYYMM"
  const curMonthly = (snap.get(`stats.monthlyDayMarks.${ym}`) as number) || 0;
  await updateDoc(ref, { [`stats.monthlyDayMarks.${ym}`]: curMonthly >= 31 ? curMonthly : curMonthly + 1 });
}

/** Calcule jours entre deux keys "YYYY-MM-DD" (UTC) */
function diffDaysStr(a: string, b: string) {
  const da = new Date(`${a}T00:00:00.000Z`).getTime();
  const db = new Date(`${b}T00:00:00.000Z`).getTime();
  return Math.round((db - da) / 86400000);
}

// À déclencher (par exemple) au premier mark du mois suivant pour valider le mois précédent
export async function tryFinalizePerfectMonth(uid: string, year: number, month1to12: number) {
  await ensureUserDoc(uid);
  const ref = userRef(uid);
  const snap = await getDoc(ref);
  const ym = `${year}-${String(month1to12).padStart(2, "0")}`.replace("-", "");
  const count = (snap.get(`stats.monthlyDayMarks.${ym}`) as number) || 0;
  const daysInMonth = new Date(year, month1to12, 0).getDate();
  if (count >= daysInMonth) {
    // Aligne avec trophiesHelper : stats.perfectMonth.count (et on garde un miroir legacy si présent)
    await incStat(uid, "perfectMonth.count", 1);
    await updateDoc(ref, { perfectMonths: increment(1) }); // miroir legacy (optionnel)
    // on peut aussi nettoyer la case si tu veux
    // await updateDoc(ref, { [`stats.monthlyDayMarks.${ym}`]: 0 });
  }
}

// ---------- focus-only streak ----------
export async function recordFocusMark(uid: string, date: Date) {
  await ensureUserDoc(uid);
  const ref = userRef(uid);
  const snap = await getDoc(ref);

  const todayKey = dayKeyUTC(date);
  const lastKey = snap.get("stats.lastFocusMarkKey") as string | undefined;

  let current = Number(snap.get("stats.focus.current") ?? 0);
  if (!lastKey) current = 1;
  else {
    const d = diffDaysStr(lastKey, todayKey);
    if (d === 0) return;
    else if (d === 1) current = current + 1;
    else if (d > 1) current = 1;
    else return;
  }

  await updateDoc(ref, {
    "stats.lastFocusMarkKey": todayKey,
    "stats.focus.current": current,
  });
  await setMax(uid, "focus.daysMax", current);
}
