// src/hooks/useTrophiesEconomy.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

export type DayKey = string; // "YYYY-MM-DD"

export const TROPHY = {
  MICRO_PER_DAY: 1,
  MICRO_WEEKLY_CAP: 50,
  STREAK_BONUS: [
    { at: 3, bonus: 1 },
    { at: 7, bonus: 3 },
    { at: 14, bonus: 6 },
    { at: 21, bonus: 10 },
    { at: 30, bonus: 20 },
  ],
  DUO_MULTIPLIER: 1.10,
} as const;

const clampNum = (n: number, min = 0, max = Infinity) => Math.min(Math.max(n, min), max);

export const dayKeyUTC = (d: Date) => d.toISOString().slice(0, 10);
const dateFromDayKeyUTC = (key: DayKey) => new Date(`${key}T00:00:00.000Z`);
export const diffDaysUTC = (aKey: DayKey, bKey: DayKey) => {
  const A = dateFromDayKeyUTC(aKey).getTime();
  const B = dateFromDayKeyUTC(bKey).getTime();
  return Math.round((B - A) / 86400000);
};

export const coerceToDayKey = (s?: string | null): DayKey | null => {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return dayKeyUTC(d);
};

export const isConsecutive = (keys: DayKey[]): boolean => {
  if (!keys.length) return false;
  const sorted = [...keys].sort();
  for (let i = 1; i < sorted.length; i++) {
    if (diffDaysUTC(sorted[i - 1], sorted[i]) !== 1) return false;
  }
  return true;
};

export const isDuoSyncFinish = (myFinishKey: DayKey, partnerFinishKey?: DayKey | null): boolean => {
  if (!myFinishKey || !partnerFinishKey) return false;
  return Math.abs(diffDaysUTC(myFinishKey, partnerFinishKey)) <= 1;
};

export const getSkipTrophyCost = (selectedDays: number): number => {
  return clampNum(Math.ceil((selectedDays || 1) / 3), 3, 8);
};

export function computeChallengeTrophies(params: {
  selectedDays: number;
  completionKeys: DayKey[];
  myFinishKey: DayKey;
  partnerFinishKey?: DayKey | null;
  isDuo?: boolean;
  isDoubleReward?: boolean;
  longestStreak?: number;
}) {
  const {
    selectedDays,
    completionKeys,
    myFinishKey,
    partnerFinishKey,
    isDuo,
    isDoubleReward,
    longestStreak = 0,
  } = params;

  const n = Math.max(1, selectedDays);
 // ✅ Economie plus "lisible" : 1 jour ≈ 1 trophée
const basePerDay = 1;

// ✅ Bonus de longueur uniquement à partir de 7 jours (sinon ça explose les petits challenges)
const lengthBonus = n >= 7 ? Math.round(1.5 * Math.sqrt(n)) : 0;

let total = n * basePerDay + lengthBonus;


  const flawless = completionKeys.length === n && isConsecutive(completionKeys);
  if (flawless) total *= 1.15;

  if (isDuo && isDuoSyncFinish(myFinishKey, partnerFinishKey)) {
    total *= TROPHY.DUO_MULTIPLIER;
  }

  if ((completionKeys?.length || 0) >= Math.max(1, longestStreak)) {
    total *= 1.05;
  }

  if (isDoubleReward) total *= 2;

  const hardCap = n * 6;
  total = Math.round(clampNum(total, 1, hardCap));

  return { total, flawless };
}

// ---- Micro “banque” hebdo (AsyncStorage) ----
const MICRO_BANK_KEY = "microBank.week";
export const MICRO_WEEK_UPDATED_EVENT = "ties.micro_week.updated";
const isoWeekKey = (d = new Date()) => {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((Number(dt) - Number(yearStart)) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${weekNo}`;
};

// ✅ Sanitization & cap hebdo (évite NaN / valeurs négatives / dépassement)
const sanitizeMicroWeek = (input: any, key: string): { key: string; used: number } => {
  const usedRaw = Number(input?.used ?? 0);
  const usedSafe = Number.isFinite(usedRaw) ? usedRaw : 0;
  return {
    key,
    used: clampNum(Math.floor(usedSafe), 0, TROPHY.MICRO_WEEKLY_CAP),
  };
};

export const getMicroWeek = async (): Promise<{ key: string; used: number }> => {
  const key = isoWeekKey();
  const raw = await AsyncStorage.getItem(MICRO_BANK_KEY);
  try {
    const parsed = raw ? JSON.parse(raw) : { key, used: 0 };
    if (parsed?.key !== key) return { key, used: 0 };
    return sanitizeMicroWeek(parsed, key);
  } catch {
    return { key, used: 0 };
  }
};

export const incMicroWeek = async (): Promise<number> => {
  const key = isoWeekKey();
  const cur = await getMicroWeek();
  const prevUsed = cur.key === key ? (cur.used || 0) : 0;
  const used =
    prevUsed >= TROPHY.MICRO_WEEKLY_CAP
      ? TROPHY.MICRO_WEEKLY_CAP
      : prevUsed + 1;

  await AsyncStorage.setItem(
    MICRO_BANK_KEY,
    JSON.stringify({ key, used })
  );
  // 🔔 Notifie l’UI (Profile, UserStats, etc.) qu’un micro a été consommé
  try {
    DeviceEventEmitter.emit(MICRO_WEEK_UPDATED_EVENT, { key, used });
  } catch {}
  return used;
};

// Petit hook pour exposer constantes & helpers
export function useTrophiesEconomy() {
  return {
    TROPHY,
    dayKeyUTC,
    diffDaysUTC,
    coerceToDayKey,
    isConsecutive,
    isDuoSyncFinish,
    getSkipTrophyCost,
    computeChallengeTrophies,
    getMicroWeek,
    incMicroWeek,
    MICRO_WEEK_UPDATED_EVENT,
  };
}
