// components/ForceUpdateModal.tsx
import React from "react";
import { Modal, View, Text, TouchableOpacity, Linking, StyleSheet, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  visible: boolean;
  storeUrl: string;
  force: boolean; // true = pas de croix
};

export default function ForceUpdateModal({ visible, storeUrl, force }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={s.overlay}>
        <View style={s.card}>
          <LinearGradient
            colors={["#F97316", "#EA6C0A"]}
            style={s.iconWrap}
          >
            <Ionicons name="rocket-outline" size={32} color="#fff" />
          </LinearGradient>

          <Text style={s.title}>Mise à jour disponible 🚀</Text>
          <Text style={s.sub}>
            {force
              ? "Une nouvelle version est requise pour continuer à utiliser ChallengeTies."
              : "Une nouvelle version est disponible avec des améliorations."}
          </Text>

          <TouchableOpacity
            style={s.cta}
            onPress={() => Linking.openURL(storeUrl)}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={["#F97316", "#FB923C"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.ctaGrad}
            >
              <Text style={s.ctaText}>Mettre à jour</Text>
            </LinearGradient>
          </TouchableOpacity>

          {!force && (
            <Text style={s.later}>Tu peux continuer sans mettre à jour.</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 28,
    alignItems: "center",
    gap: 14,
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontFamily: "Comfortaa_700Bold",
    color: "#0B1120",
    textAlign: "center",
  },
  sub: {
    fontSize: 14,
    fontFamily: "Comfortaa_400Regular",
    color: "rgba(11,17,32,0.65)",
    textAlign: "center",
    lineHeight: 20,
  },
  cta: { width: "100%", borderRadius: 18, overflow: "hidden" },
  ctaGrad: {
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: 18,
  },
  ctaText: {
    fontSize: 16,
    fontFamily: "Comfortaa_700Bold",
    color: "#0B1120",
  },
  later: {
    fontSize: 12,
    fontFamily: "Comfortaa_400Regular",
    color: "rgba(11,17,32,0.40)",
    textAlign: "center",
  },
});