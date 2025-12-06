// app/deeplink-loader.tsx
import React, { useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

type DeepLinkParams = {
  type?: string;
  challengeId?: string;
  invite?: string;
  days?: string;
  lang?: string;
};

const DeepLinkLoader: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<DeepLinkParams>();

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const type = params.type ? String(params.type) : undefined;
        const challengeId = params.challengeId
          ? String(params.challengeId)
          : undefined;
        const invite = params.invite ? String(params.invite) : undefined;
        const days = params.days ? String(params.days) : undefined;
        const lang = params.lang ? String(params.lang) : undefined;

        // 👉 Cas 1 : invitation de challenge
        if (type === "invitation" && challengeId) {
          const q: Record<string, string> = {};
          if (invite) q.invite = invite;
          if (days) q.days = days;
          if (lang) q.lang = lang;

          const queryString =
            Object.keys(q).length > 0
              ? "?" +
                Object.entries(q)
                  .map(
                    ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
                  )
                  .join("&")
              : "";

          const target = `/challenge-details/${encodeURIComponent(
            challengeId
          )}${queryString}`;

          if (!cancelled) {
            router.replace(target);
          }
          return;
        }

        // 👉 Cas 2 : fallback (si lien chelou) → home
        if (!cancelled) {
          router.replace("/");
        }
      } catch (e) {
        // En cas d'erreur inconnue → home pour ne pas bloquer l'app
        if (!cancelled) {
          router.replace("/");
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
      <Text style={styles.title}>Ouverture du défi...</Text>
      <Text style={styles.subtitle}>
        ChallengeTies prépare ton invitation 🔥
      </Text>
    </View>
  );
};

export default DeepLinkLoader;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050816", // adapte si tu as une couleur de fond globale
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
});
