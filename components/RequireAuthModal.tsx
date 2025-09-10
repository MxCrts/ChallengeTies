// components/RequireAuthModal.tsx
import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function RequireAuthModal({ visible, onClose }: Props) {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{t("authRequiredTitle") || "Profite de tout ChallengeTies"}</Text>
          <Text style={styles.subtitle}>
            {t("authRequiredBody") || "Inscris-toi ou connecte-toi pour accéder à cette fonctionnalité."}
          </Text>

          <TouchableOpacity
            onPress={() => {
              onClose();
              router.push("/login");
            }}
            style={[styles.cta, { backgroundColor: "#FFB800", borderColor: "#FFB800" }]}
          >
            <Text style={[styles.ctaText, { color: "#111" }]}>
              {t("authRequiredCTA") || "Créer un compte / Se connecter"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={[styles.cta, styles.secondary]}>
            <Text style={[styles.ctaText, { color: "#FFB800" }]}>
              {t("authRequiredLater") || "Continuer en visiteur"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  card: { width: "86%", borderRadius: 18, padding: 18, backgroundColor: "#fff" },
  title: { fontFamily: "Comfortaa_700Bold", fontSize: 18, marginBottom: 8, color: "#111", textAlign: "center" },
  subtitle: { fontFamily: "Comfortaa_400Regular", fontSize: 14, color: "#555", textAlign: "center", marginBottom: 16 },
  cta: {
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
    borderWidth: 2,
    marginTop: 10,
  },
  ctaText: { fontFamily: "Comfortaa_700Bold", fontSize: 14 },
  secondary: { backgroundColor: "transparent", borderColor: "#FFB800" },
});
