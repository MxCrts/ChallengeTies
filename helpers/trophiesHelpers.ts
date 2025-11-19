// helpers/trophiesHelper.ts
import {
  runTransaction,
  doc,
  getDoc,
  updateDoc,
  increment,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "../constants/firebase-config";
import { achievementsList } from "./achievementsConfig";

/** ---------- Utils sûrs ---------- */
const num = (v: any, d = 0) => (typeof v === "number" && isFinite(v) ? v : d);
const arr = (v: any) => (Array.isArray(v) ? v : []);
const setFrom = (v: any) => new Set(arr(v));
const hasAll = (...vals: any[]) => vals.every((x) => !!x);

/** Accès défensif à des compteurs imbriqués (stats.*) */
const pick = (obj: any, path: string[], d = 0) => {
  try {
    let cur = obj;
    for (const k of path) cur = cur?.[k];
    return num(cur, d);
  } catch {
    return d;
  }
};

/** Récupère le nombre de points d’un succès (flat ou tiered) */
function resolveAchievementPoints(id: string): number {
  const flat = (achievementsList as any)[id];
  if (flat && typeof flat === "object" && "points" in flat) {
    return num(flat.points, 0);
  }
  const [group, threshold] = id.split("_");
  const bucket = (achievementsList as any)[group];
  if (bucket && typeof bucket === "object" && threshold && bucket[threshold]) {
    return num(bucket[threshold].points, 0);
  }
  return 0;
}

/** Catégories gérées en logique spécifique (à ne PAS retraiter dans la boucle générique) */
const EXCLUDED_TIERED_GENERIC = new Set<string>([
  "finishChallenge",
  "selectChallengeDays",
  "streakProgress",
  "challengeCreated",
  // premium / spécifiques ci-dessous :
  "inviteFriend",
  "finishDuoChallenge",
  "duoStreak",
  "perfectMonth",
  "categoriesMastered",
  "referralsRegistered",
  "duoMessages",
  "focusDays",
  "dailyCompletion",
  "challengeAdopted",
  "seasonal",
  "zeroMissLongRun",
]);

/** Push conditionnel dans pending / newAchievements */
function tryQueueAchievement(
  identifier: string,
  achieved: Set<string>,
  pending: Set<string>,
  out: string[]
) {
  if (!achieved.has(identifier) && !pending.has(identifier)) {
    pending.add(identifier);
    out.push(identifier);
  }
}

/**
 * Vérifie les succès atteints et les ajoute à `newAchievements` si débloqués.
 * — Supporte à la fois les anciens champs et les nouveaux compteurs `stats.*`
 * — Ne casse rien si un champ n’existe pas (défensif)
 */
export async function checkForAchievements(userId: string): Promise<string[]> {
  if (!userId) return [];

  const userRef = doc(db, "users", userId);
  let newlyUnlocked: string[] = [];

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists()) throw new Error("User doc not found.");

      const u = snap.data() || {};
      const achieved = setFrom(u.achievements);
      const pending = setFrom(u.newAchievements);

      // ========= EXISTANTS & COMPAT =========

      // 1) Première connexion
      tryQueueAchievement("first_connection", achieved, pending, newlyUnlocked);

      // 2) Profil complété
      if (
        hasAll(u.bio, u.location, u.profileImage) &&
        Array.isArray(u.interet) &&
        u.interet.length > 0
      ) {
        tryQueueAchievement("profile_completed", achieved, pending, newlyUnlocked);
      }

      // 3) Défis terminés — finishChallenge_X
      //    Compat : lit d’abord stats.completed.total sinon completedChallengesCount
      {
        const finishedCount =
          pick(u, ["stats", "completed", "total"]) ||
          num(u.completedChallengesCount, 0);

        const bucket = (achievementsList as any).finishChallenge || {};
        Object.keys(bucket).forEach((threshold) => {
          const id = `finishChallenge_${threshold}`;
          if (finishedCount >= Number(threshold)) {
            tryQueueAchievement(id, achieved, pending, newlyUnlocked);
          }
        });
      }

      // 4) Durée sélectionnée — selectChallengeDays_X (inchangé)
      {
        const current = [
          ...arr(u.CurrentChallenges),
          ...arr(u.CompletedTodayChallenges),
        ];
        const bucket = (achievementsList as any).selectChallengeDays || {};
        current.forEach((c: any) => {
          const d = num(c?.selectedDays, -1);
          if (bucket[d]) {
            const id = `selectChallengeDays_${d}`;
            tryQueueAchievement(id, achieved, pending, newlyUnlocked);
          }
        });
      }

      // 5) Streaks — streakProgress_X (max sur actifs)
      //    Compat : si tu stockes aussi un max global (stats.streak.max) on l’utilise
      {
        const current = [
          ...arr(u.CurrentChallenges),
          ...arr(u.CompletedTodayChallenges),
        ];
        let maxStreakOnList = 0;
        if (current.length) {
          maxStreakOnList = current.reduce(
            (m: number, c: any) => Math.max(m, num(c?.streak, 0)),
            0
          );
        }
        const globalMax = pick(u, ["stats", "streak", "max"], 0);
        const maxStreak = Math.max(maxStreakOnList, globalMax);

        const bucket = (achievementsList as any).streakProgress || {};
        Object.keys(bucket).forEach((threshold) => {
          const id = `streakProgress_${threshold}`;
          if (maxStreak >= Number(threshold)) {
            tryQueueAchievement(id, achieved, pending, newlyUnlocked);
          }
        });
      }

      // 6) challengeCreated_X
      {
        // compat : soit nombre d’éléments, soit stats.created.count
        const createdCount =
          pick(u, ["stats", "created", "count"]) ||
          arr(u.createdChallenges).length;

        const bucket = (achievementsList as any).challengeCreated || {};
        Object.keys(bucket).forEach((threshold) => {
          const id = `challengeCreated_${threshold}`;
          if (createdCount >= Number(threshold)) {
            tryQueueAchievement(id, achieved, pending, newlyUnlocked);
          }
        });
      }

      Object.entries(achievementsList as any).forEach(([category, cfg]) => {
        // on saute les catégories plates
        if (category === "first_connection" || category === "profile_completed") return;
        // on saute les catégories traitées ailleurs
        if (EXCLUDED_TIERED_GENERIC.has(category)) return;
        // uniquement les buckets tiered (pas d’objet plat avec 'points')
        if (typeof cfg === "object" && !("points" in cfg)) {
          // stats.{category}.total prioritaire, fallback à u[category] si c'est un compteur
          const direct = pick(u, ["stats", category, "total"]);
          const fallback = num((u as any)[category], NaN);
          const value = Number.isFinite(direct) && direct > 0 ? direct : num(fallback, 0);

          Object.keys(cfg).forEach((threshold) => {
            const id = `${category}_${threshold}`;
            if (value >= Number(threshold)) {
              tryQueueAchievement(id, achieved, pending, newlyUnlocked);
            }
          });
        }
      });

      // ========= CATEGORIES PREMIUM (avec compat) =========

      // A) Invitations acceptées — inviteFriend_X
      {
        const value =
          pick(u, ["stats", "inviteFriend", "accepted"]) ||
          num(u.inviteFriend, 0) ||
          num(u.inviteFriendAccepted, 0);

        const bucket = (achievementsList as any).inviteFriend || {};
        Object.keys(bucket).forEach((threshold) => {
          const id = `inviteFriend_${threshold}`;
          if (value >= Number(threshold)) {
            tryQueueAchievement(id, achieved, pending, newlyUnlocked);
          }
        });
      }

      // B) Défis DUO terminés — finishDuoChallenge_X
      {
        const value =
          pick(u, ["stats", "duo", "completed"]) ||
          num(u.finishDuoChallenge, 0) ||
          num(u.duoChallengesCompletedCount, 0);

        const bucket = (achievementsList as any).finishDuoChallenge || {};
        Object.keys(bucket).forEach((threshold) => {
          const id = `finishDuoChallenge_${threshold}`;
          if (value >= Number(threshold)) {
            tryQueueAchievement(id, achieved, pending, newlyUnlocked);
          }
        });
      }

      // C) Streak DUO — duoStreak_X (max global)
      {
        const duoMax =
          pick(u, ["stats", "duo", "streakMax"]) ||
          num(u.duoStreak, 0) ||
          num(u.duoStreakMax, 0);

        const bucket = (achievementsList as any).duoStreak || {};
        Object.keys(bucket).forEach((threshold) => {
          const id = `duoStreak_${threshold}`;
          if (duoMax >= Number(threshold)) {
            tryQueueAchievement(id, achieved, pending, newlyUnlocked);
          }
        });
      }

      // D) Mois parfait — perfectMonth_X (compteur)
      {
        const count =
          pick(u, ["stats", "perfectMonth", "count"]) ||
          num(u.perfectMonth, 0) ||
          num(u.perfectMonths, 0);

        const bucket = (achievementsList as any).perfectMonth || {};
        Object.keys(bucket).forEach((threshold) => {
          const id = `perfectMonth_${threshold}`;
          if (count >= Number(threshold)) {
            tryQueueAchievement(id, achieved, pending, newlyUnlocked);
          }
        });
      }

      // E) Catégories maîtrisées — categoriesMastered_X
      {
        let cats: Set<string> = new Set(arr(u.categoriesCompleted));
        if (!cats.size) {
          const completed = arr(u.CompletedChallenges);
          completed.forEach((c: any) => {
            const cat = (c?.category || "").toString().trim();
            if (cat) cats.add(cat);
          });
        }
        const value =
          pick(u, ["stats", "categories", "mastered"]) || cats.size;

        const bucket = (achievementsList as any).categoriesMastered || {};
        Object.keys(bucket).forEach((threshold) => {
          const id = `categoriesMastered_${threshold}`;
          if (value >= Number(threshold)) {
            tryQueueAchievement(id, achieved, pending, newlyUnlocked);
          }
        });
      }

      // F) Parrainage — referralsRegistered_X
      {
        const value =
          pick(u, ["stats", "referrals", "registered"]) ||
          num(u.referralsRegistered, 0) ||
          num(u.referralCount, 0);

        const bucket = (achievementsList as any).referralsRegistered || {};
        Object.keys(bucket).forEach((threshold) => {
          const id = `referralsRegistered_${threshold}`;
          if (value >= Number(threshold)) {
            tryQueueAchievement(id, achieved, pending, newlyUnlocked);
          }
        });
      }

      // G) Duo messages — duoMessages_X
      {
        const value =
          pick(u, ["stats", "duo", "messages"]) ||
          num(u.duoMessages, 0) ||
          num(u.duoMessagesCount, 0);

        const bucket = (achievementsList as any).duoMessages || {};
        Object.keys(bucket).forEach((threshold) => {
          const id = `duoMessages_${threshold}`;
          if (value >= Number(threshold)) {
            tryQueueAchievement(id, achieved, pending, newlyUnlocked);
          }
        });
      }

      // H) Jours focus — focusDays_X (meilleur streak focus)
      {
        const value =
          pick(u, ["stats", "focus", "daysMax"]) ||
          num(u.focusDays, 0) ||
          num(u.focusDaysMax, 0);

        const bucket = (achievementsList as any).focusDays || {};
        Object.keys(bucket).forEach((threshold) => {
          const id = `focusDays_${threshold}`;
          if (value >= Number(threshold)) {
            tryQueueAchievement(id, achieved, pending, newlyUnlocked);
          }
        });
      }

      // I) Marathon de complétion — dailyCompletion_X (meilleur streak global)
      {
        const value =
          pick(u, ["stats", "dailyCompletion", "max"]) ||
          num(u.dailyCompletion, 0) ||
          num(u.dailyCompletionMax, 0);

        const bucket = (achievementsList as any).dailyCompletion || {};
        Object.keys(bucket).forEach((threshold) => {
          const id = `dailyCompletion_${threshold}`;
          if (value >= Number(threshold)) {
            tryQueueAchievement(id, achieved, pending, newlyUnlocked);
          }
        });
      }

      // J) Créations adoptées — challengeAdopted_X
      {
        // Priorité à stats.created.maxParticipants si tu le stockes
        const maxByStats = pick(u, ["stats", "created", "maxParticipants"], 0);

        let maxAdopted = maxByStats;
        if (!maxAdopted) {
          const created = arr(u.createdChallenges);
          maxAdopted = created.reduce((m: number, c: any) => {
            const pid = num(c?.participantsCount, 0);
            return Math.max(m, pid);
          }, 0);
        }

        const bucket = (achievementsList as any).challengeAdopted || {};
        Object.keys(bucket).forEach((threshold) => {
          const id = `challengeAdopted_${threshold}`;
          if (maxAdopted >= Number(threshold)) {
            tryQueueAchievement(id, achieved, pending, newlyUnlocked);
          }
        });
      }

      // K) Saisonniers / events — seasonal_X
      {
        const value =
          pick(u, ["stats", "seasonal", "completed"]) ||
          num(u.seasonal, 0) ||
          num(u.seasonalCompleted, 0);

        const bucket = (achievementsList as any).seasonal || {};
        Object.keys(bucket).forEach((threshold) => {
          const id = `seasonal_${threshold}`;
          if (value >= Number(threshold)) {
            tryQueueAchievement(id, achieved, pending, newlyUnlocked);
          }
        });
      }

      // L) Zéro miss long run — zeroMissLongRun_{30,60}
      {
        const z30 =
          !!u.zeroMissLongRun30 ||
          num(u.zeroMissLongRun?.["30"], 0) > 0 ||
          num(u.zeroMissLongRun30Count, 0) > 0;
        const z60 =
          !!u.zeroMissLongRun60 ||
          num(u.zeroMissLongRun?.["60"], 0) > 0 ||
          num(u.zeroMissLongRun60Count, 0) > 0;

        const bucket = (achievementsList as any).zeroMissLongRun || {};
        if (bucket["30"] && z30)
          tryQueueAchievement("zeroMissLongRun_30", achieved, pending, newlyUnlocked);
        if (bucket["60"] && z60)
          tryQueueAchievement("zeroMissLongRun_60", achieved, pending, newlyUnlocked);
      }

      // Applique (sans doublon)
      tx.update(userRef, { newAchievements: Array.from(pending) });
    });

    if (newlyUnlocked.length) {
      console.log("✅ Nouveaux succès détectés :", newlyUnlocked);
    }
    return newlyUnlocked;
  } catch (err) {
    console.error("❌ Erreur lors de la vérification des succès :", err);
    return [];
  }
}

/** Ajoute un succès à l'utilisateur sans lui attribuer immédiatement les trophées. */
export async function addAchievement(userId: string) {
  if (!userId) return;
  await checkForAchievements(userId);
}

/** Déduit des trophées (paiement / achat premium / etc.) */
export async function deductTrophies(
  userId: string,
  amount: number
): Promise<boolean> {
  if (!userId) return false;
  const userRef = doc(db, "users", userId);
  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) throw new Error("User doc not found.");
    const current = num(snap.data()?.trophies, 0);
    if (current < amount) return false;
    await updateDoc(userRef, { trophies: increment(-amount) });
    return true;
  } catch (e) {
    console.error("Error deducting trophies:", e);
    return false;
  }
}

/**
 * Réclame un succès et crédite les trophées — ATOMIQUE (transaction),
 * anti double-claim, option bonus x2.
 */
export async function claimAchievement(
  userId: string,
  achievementId: string,
  isDoubleReward: boolean = false
) {
  if (!userId || !achievementId) return;

  const userRef = doc(db, "users", userId);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists()) throw new Error("User doc not found.");
      const u = snap.data() || {};

      const pending = setFrom(u.newAchievements);
      const achieved = setFrom(u.achievements);

      if (!pending.has(achievementId)) return; // non réclamable

      let points = resolveAchievementPoints(achievementId);
      if (points <= 0) {
        console.warn(`⚠️ Aucun trophée trouvé pour ${achievementId}`);
        points = 0;
      }
      const award = isDoubleReward ? points * 2 : points;

      tx.update(userRef, {
        trophies: increment(award),
        achievements: arrayUnion(achievementId),
        newAchievements: arrayRemove(achievementId),
      });
    });

    console.log(`✅ Succès réclamé: ${achievementId} | Trophées crédités: ${
      isDoubleReward ? "x2" : "x1"
    }`);
  } catch (err) {
    console.error("❌ Erreur lors de la réclamation du succès :", err);
  }
}
