// src/hooks/useIncomingInvite.ts
import { useEffect, useRef } from "react";
import { Linking } from "react-native";
import * as ExpoLinking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useSegments } from "expo-router";
import { auth } from "../constants/firebase-config";

type ParsedInvite = { inviteId: string; challengeId: string } | null;

const PENDING_KEY = "pendingInvite";

function parseInvite(url: string): ParsedInvite {
  try {
    // Supporte ties://challenge-details/<id>?invite=XYZ
    // et https://challengeties.app/challenge-details/<id>?invite=XYZ
    const parsed = ExpoLinking.parse(url);
    const qs = (parsed.queryParams || {}) as Record<string, string | undefined>;
    const inviteId = (qs.invite || qs.inv || "") as string;

    // challengeId depuis le chemin
    // parsed.path peut ressembler à "challenge-details/abc123"
    let challengeId = "";
    const path = (parsed.path || "").replace(/^\//, "");
    const parts = path.split("/");
    if (parts[0] === "challenge-details" && parts[1]) {
      challengeId = parts[1];
    }

    if (inviteId && challengeId) return { inviteId, challengeId };
    return null;
  } catch {
    return null;
  }
}

async function getInitialUrl(): Promise<string | null> {
  try {
    return await Linking.getInitialURL();
  } catch {
    return null;
  }
}

/**
 * Hook global qui :
 * - lit l’URL d’ouverture + écoute les URLs entrantes
 * - si invite détectée :
 *   - connecté -> route vers /challenge-details/[id]?invite=XYZ
 *   - non connecté -> stocke en AsyncStorage puis route vers /register?fromInvite=1
 * - consomme aussi un pendingInvite en attente après login
 */
export function useIncomingInvite(enabled = true) {
  const router = useRouter();
  const segments = useSegments();
  const handledRef = useRef<string | null>(null); // évite les doublons

  // Redirige selon état de connexion
  const handleInvite = async (inv: ParsedInvite) => {
    if (!inv) return;
    const key = `${inv.challengeId}:${inv.inviteId}`;
    if (handledRef.current === key) return;
    handledRef.current = key;

    const isLoggedIn = !!auth.currentUser?.uid;

    if (!isLoggedIn) {
      await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(inv));
      // on privilégie l’inscription (meilleur taux d’activation)
      router.replace({ pathname: "/register", params: { fromInvite: "1" } });
      return;
    }

    // connecté → on pousse direct la page du challenge avec le param ?invite=
    router.push({
      pathname: `/challenge-details/${inv.challengeId}`,
      params: { invite: inv.inviteId },
    });
  };

  // Consomme un pending en stockage (après login ou retour app)
  const consumePending = async () => {
    try {
      const raw = await AsyncStorage.getItem(PENDING_KEY);
      if (!raw) return;
      const inv = JSON.parse(raw) as ParsedInvite;
      if (inv && inv.inviteId && inv.challengeId) {
        await AsyncStorage.removeItem(PENDING_KEY);
        await handleInvite(inv);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!enabled) return;

    // 1) initialURL au cold start
    (async () => {
      const url = await getInitialUrl();
      const inv = url ? parseInvite(url) : null;
      if (inv) {
        await handleInvite(inv);
      } else {
        // sinon on tente un pending (ex: login terminé)
        await consumePending();
      }
    })();

    // 2) écoute des URLs runtime
    const sub = Linking.addEventListener("url", async ({ url }) => {
      const inv = parseInvite(url);
      if (inv) await handleInvite(inv);
    });

    return () => {
      // @ts-ignore RN compat
      sub?.remove?.();
    };
    // Re-essaye quand le segment change (utile après login)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, segments.join("-")]);
}

/** Helper optionnel pour relancer une vérification manuelle (ex: après login) */
export async function triggerPendingInviteCheck() {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return;
    // rien à faire ici : le hook consommera au prochain render
  } catch {
    // ignore
  }
}
