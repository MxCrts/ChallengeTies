// app/i.tsx
import React, { useEffect, useRef } from "react";
import { View, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthProvider";

// petits helpers overlay (utilise ton API globale si dispo)
const inviteBootOn = (token?: string | null) => {
  try {
    const g: any = globalThis as any;
    if (typeof g.__INVITE_BOOT_ON__ === "function") {
      g.__INVITE_BOOT_ON__(token ?? undefined);
      return;
    }
    g.__INVITE_BOOT__ = { on: true, token: token ?? "boot", ts: Date.now() };
  } catch {}
};

const inviteBootOff = () => {
  try {
    const g: any = globalThis as any;
    if (typeof g.__INVITE_BOOT_OFF__ === "function") {
      g.__INVITE_BOOT_OFF__();
      return;
    }
    g.__INVITE_BOOT__ = { on: false, token: null, ts: 0 };
  } catch {}
};

export default function IRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    invite?: string;
    days?: string;
  }>();

  const { user, loading, checkingAuth } = useAuth();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const run = async () => {
      const rawId = typeof params?.id === "string" ? params.id : "";
      const rawInvite = typeof params?.invite === "string" ? params.invite : "";
      const rawDays = typeof params?.days === "string" ? params.days : "";

      const challengeId = rawId ? decodeURIComponent(rawId) : "";
      const inviteId = rawInvite ? decodeURIComponent(rawInvite) : "";
      const days = rawDays ? String(rawDays) : "";

      // Si on arrive sur /i sans id -> retourne root
      if (!challengeId) {
        inviteBootOff();
        router.replace("/");
        return;
      }

      // ✅ On bloque le root redirect le temps du handoff (évite flash "/")
      (globalThis as any).__DL_BLOCK_ROOT_REDIRECT__ = true;
      (globalThis as any).__DL_BLOCK_TS__ = Date.now();

      // ✅ si lien d’invite -> allume overlay immédiatement
      if (inviteId) inviteBootOn(inviteId);

      // ✅ Si auth pas prête ou pas connecté : stocke + force login (sans 404)
      if (!user || loading || checkingAuth) {
        try {
          await AsyncStorage.setItem(
            "ties_pending_link",
            JSON.stringify({
              challengeId,
              inviteId: inviteId || null,
              selectedDays: days ? Number(days) : null,
              t: Date.now(),
              from: "i_route",
            })
          );
        } catch {}

        // force auth flow (pas visiteur)
        (globalThis as any).__FORCE_AUTH_FLOW__ = true;

        // IMPORTANT: pas de "home flash" -> on va direct login
        router.replace("/login");
        return;
      }

      // ✅ User prêt -> go direct challenge-details
      router.replace({
        pathname: "/challenge-details/[id]",
        params: inviteId
          ? {
              id: String(challengeId),
              invite: String(inviteId),
              days: days ? String(days) : undefined,
            }
          : { id: String(challengeId) },
      });

      // failsafe anti-blocage root
      setTimeout(() => {
        try {
          (globalThis as any).__DL_BLOCK_ROOT_REDIRECT__ = false;
          (globalThis as any).__DL_BLOCK_TS__ = 0;
        } catch {}
      }, 1800);

      // overlay watchdog (challenge-details le gère déjà, mais safety)
      if (inviteId) {
        setTimeout(() => inviteBootOff(), 6500);
      } else {
        inviteBootOff();
      }
    };

    run().catch(() => {
      inviteBootOff();
      router.replace("/");
    });
  }, [params, router, user, loading, checkingAuth]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    // neutre (pas flashy) -> l’overlay global peut couvrir si besoin
    backgroundColor: Platform.OS === "ios" ? "#000" : "#0B0F18",
  },
});