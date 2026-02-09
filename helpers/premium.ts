import { Timestamp } from "firebase/firestore";

const getExpireMs = (raw: any): number | null => {
  if (!raw) return null;
  if (raw instanceof Date) return raw.getTime();
  if (raw instanceof Timestamp) return raw.toMillis();
  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

export const hasActiveTempPremium = (userData: any | null | undefined): boolean => {
  const raw =
    userData?.premium?.tempPremiumUntil ??
    userData?.tempPremiumUntil ??
    userData?.premiumUntil ??
    userData?.["premium.tempPremiumUntil"]; // ✅ TON CAS

  const expMs = getExpireMs(raw);
  return typeof expMs === "number" ? expMs > Date.now() : false;
};

export const getTempPremiumExpiryKey = (userData: any | null | undefined): string | null => {
  const raw = userData?.premium?.tempPremiumUntil ?? userData?.tempPremiumUntil ?? userData?.premiumUntil;
  const expMs = getExpireMs(raw);
  if (!expMs) return null;
  return new Date(expMs).toISOString().slice(0, 10);
};
