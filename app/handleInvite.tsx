import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { acceptInvitation } from "../services/invitationService";
import { useTranslation } from "react-i18next";
import designSystem from "../theme/designSystem";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { normalize } from "../utils/normalize";

const currentTheme = designSystem.lightTheme;

const HandleInvite = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { challengeId, invite } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log("HandleInvite ouvert:", { challengeId, invite });
  }, [challengeId, invite]);

  const handleAccept = async () => {
    setLoading(true);
    try {
      await acceptInvitation(invite as string);
      Alert.alert(t("invitation.success"), t("invitation.joinedChallenge"));
      router.replace(`/challenge-detail/${challengeId}`);
    } catch (error: any) {
      console.error("Erreur acceptation:", error);
      Alert.alert(t("alerts.error"), error.message || t("invitation.invalid"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#1E1E1E", "#3A3A3A"]}
        style={styles.modalContent}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.header}>
          <Ionicons
            name="people-outline"
            size={normalize(48)}
            color="#FF6200"
          />
          <Text style={styles.title}>{t("invitation.title")}</Text>
          <Text style={styles.subtitle}>
            {t("invitation.subtitle", { challengeId })}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.button}
          onPress={handleAccept}
          disabled={loading}
        >
          <LinearGradient
            colors={["#FF6200", "#FF8C00"]}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>
              {loading ? t("invitation.accepting") : t("invitation.accept")}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.75)",
  },
  modalContent: {
    width: "90%",
    maxWidth: normalize(400),
    padding: normalize(24),
    borderRadius: normalize(24),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(12) },
    shadowOpacity: 0.6,
    shadowRadius: normalize(20),
    elevation: 25,
  },
  header: {
    alignItems: "center",
    marginBottom: normalize(24),
  },
  title: {
    fontSize: normalize(28),
    fontFamily: currentTheme.typography.title.fontFamily,
    color: "#FFF",
    marginTop: normalize(12),
    textAlign: "center",
  },
  subtitle: {
    fontSize: normalize(16),
    fontFamily: currentTheme.typography.body.fontFamily,
    color: "#D1D5DB",
    textAlign: "center",
    marginTop: normalize(8),
  },
  button: {
    borderRadius: normalize(16),
    overflow: "hidden",
  },
  buttonGradient: {
    padding: normalize(16),
    alignItems: "center",
  },
  buttonText: {
    fontSize: normalize(18),
    fontFamily: currentTheme.typography.title.fontFamily,
    color: "#FFF",
  },
});

export default HandleInvite;
