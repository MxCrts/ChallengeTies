import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useTranslation } from "react-i18next";

/**
 * Overlay global “top monde” piloté par globalThis.__GLOBAL_OVERLAY__
 * Forme: { on: boolean, label?: string, ts?: number }
 */
export default function GlobalLoadingOverlay() {
  const { t } = useTranslation();

  const [tick, setTick] = useState(0);
  useEffect(() => {
    // polling léger & safe (évite de refactor toute l'app)
    const id = setInterval(() => setTick((x) => (x + 1) % 10_000), 80);
    return () => clearInterval(id);
  }, []);

  const state = (globalThis as any).__GLOBAL_OVERLAY__ as
    | { on?: boolean; label?: string; ts?: number }
    | undefined;

  const visible = !!state?.on;

  const label = useMemo(() => {
    const raw = String(state?.label || "").trim();
    if (raw) {
      // ✅ Si on reçoit une clé i18n (ex: "overlay.opening"), on la traduit
     if (raw.startsWith("overlay.")) {
        const tr = t(raw as any, { defaultValue: "" });
        if (typeof tr === "string" && tr.trim()) return tr.trim();
      }
      // ✅ Sinon on affiche tel quel (legacy/debug)
      return raw;
    }

    // ✅ fallback i18n (standard)
    const tr = t("overlay.loading", { defaultValue: "Chargement…" });
    return typeof tr === "string" && tr.trim() ? tr.trim() : "Chargement…";
  }, [state?.label, tick, t]);

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(160)}
      style={styles.wrap}
      pointerEvents="auto"
    >
      <View style={styles.card}>
        <ActivityIndicator />
        <Text style={styles.title}>{label}</Text>
        <Text style={styles.sub}>
          {t("overlay.pleaseWait", { defaultValue: "On sécurise la transition…" })}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 999999,
    elevation: 999999,
    backgroundColor: "#0B1220", // deep navy premium
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: "88%",
    maxWidth: 420,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
  },
  title: {
    marginTop: 12,
    fontSize: 16,
    color: "#FFFFFF",
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
  },
  sub: {
    marginTop: 6,
    fontSize: 12,
    color: "rgba(255,255,255,0.72)",
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
  },
});
