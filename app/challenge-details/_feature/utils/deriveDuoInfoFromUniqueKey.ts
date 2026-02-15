export type RawChallengeEntry = {
  challengeId?: string;
  id?: string;
  uniqueKey?: string;
  duo?: boolean;
  duoPartnerId?: string | null;
  duoPartnerUsername?: string | null;
  selectedDays?: number;
};

export function deriveDuoInfoFromUniqueKey(
  entry: RawChallengeEntry,
  currentUserId: string | undefined | null
) {
  // 🛑 Si le doc indique explicitement SOLO → on respecte ça
  const explicitSolo =
    entry &&
    entry.duo === false &&
    !entry.duoPartnerId &&
    !entry.duoPartnerUsername;

  if (explicitSolo) {
    return {
      isDuo: false,
      duoPartnerId: null,
      duoPartnerUsername: null,
    };
  }

  if (!entry || !currentUserId) {
    return {
      isDuo: !!entry?.duo,
      duoPartnerId: entry?.duoPartnerId ?? null,
      duoPartnerUsername: entry?.duoPartnerUsername ?? null,
    };
  }

  const rawKey = entry.uniqueKey;
  if (!rawKey || typeof rawKey !== "string") {
    return {
      isDuo: !!entry?.duo,
      duoPartnerId: entry?.duoPartnerId ?? null,
      duoPartnerUsername: entry?.duoPartnerUsername ?? null,
    };
  }

  const parts = rawKey.split("_");
  if (parts.length < 3) {
    return {
      isDuo: !!entry?.duo,
      duoPartnerId: entry?.duoPartnerId ?? null,
      duoPartnerUsername: entry?.duoPartnerUsername ?? null,
    };
  }

  const pairSegment = parts[parts.length - 1]; // "uidA-uidB"
  if (!pairSegment.includes("-")) {
    return {
      isDuo: !!entry?.duo,
      duoPartnerId: entry?.duoPartnerId ?? null,
      duoPartnerUsername: entry?.duoPartnerUsername ?? null,
    };
  }

  const [uidA, uidB] = pairSegment.split("-");
  if (!uidA || !uidB) {
    return {
      isDuo: !!entry?.duo,
      duoPartnerId: entry?.duoPartnerId ?? null,
      duoPartnerUsername: entry?.duoPartnerUsername ?? null,
    };
  }

  let partnerId: string | null = null;
  if (uidA === currentUserId) partnerId = uidB;
  else if (uidB === currentUserId) partnerId = uidA;
  else partnerId = null;

  const isDuo = partnerId !== null;

  return {
    isDuo,
    duoPartnerId: partnerId,
    duoPartnerUsername: entry?.duoPartnerUsername ?? null,
  };
}
