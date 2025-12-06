// src/helpers/premium.ts
export const hasActiveTempPremium = (userData: any | null | undefined): boolean => {
  if (!userData?.premium?.tempPremiumUntil) return false;
  const exp = new Date(userData.premium.tempPremiumUntil);
  const now = new Date();
  return exp.getTime() > now.getTime();
};

export const getTempPremiumExpiryKey = (userData: any | null | undefined): string | null => {
  if (!userData?.premium?.tempPremiumUntil) return null;
  const exp = new Date(userData.premium.tempPremiumUntil);
  return exp.toISOString().slice(0, 10); // "YYYY-MM-DD"
};
