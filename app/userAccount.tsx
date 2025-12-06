import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
  StatusBar,
  Platform,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../context/ThemeContext";
import { useRouter } from "expo-router";
import { auth } from "../constants/firebase-config";
import { sendEmailVerification } from "firebase/auth";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import designSystem from "../theme/designSystem";
import CustomHeader from "../components/CustomHeader";
import * as Clipboard from "expo-clipboard";
import { tap, success, warning } from "@/src/utils/haptics";
import { useToast } from "@/src/ui/Toast";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

const SPACING = 15;

export default function UserAccount() {
  const { t } = useTranslation();
  const { show: showToast } = useToast();
  const { theme } = useTheme();
  const router = useRouter();
  const isDarkMode = theme === "dark";
  const currentTheme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  const user = auth.currentUser;

  const [creationTime, setCreationTime] = useState<string | null>(null);
  const [lastLoginTime, setLastLoginTime] = useState<string | null>(null);
  const [verifSending, setVerifSending] = useState(false);

  // Redirection soft si plus de user (par ex. après logout ailleurs)
  useEffect(() => {
    if (!auth.currentUser) {
      router.replace("/login");
    }
  }, [router]);

  // Format propre des dates (création + dernier login)
  useEffect(() => {
    if (!user) {
      setCreationTime("-");
      setLastLoginTime("-");
      return;
    }

    try {
      if (user.metadata?.creationTime) {
        const d = new Date(user.metadata.creationTime);
        const formatted = d.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
        setCreationTime(formatted);
      } else {
        setCreationTime("-");
      }

      if (user.metadata?.lastSignInTime) {
        const d2 = new Date(user.metadata.lastSignInTime);
        const formatted2 = d2.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
        setLastLoginTime(formatted2);
      } else {
        setLastLoginTime("-");
      }
    } catch {
      setCreationTime("-");
      setLastLoginTime("-");
    }
  }, [user]);

  const copy = useCallback(
    async (value?: string | null) => {
      if (!value) return;
      tap();
      try {
        await Clipboard.setStringAsync(value);
        success();
        showToast(
          t("copiedToClipboard", {
            defaultValue: "Copié dans le presse-papiers.",
          }),
          "success"
        );
      } catch {
        warning();
        showToast(t("unknownError"), "error");
      }
    },
    [showToast, t]
  );

  const resendVerification = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.emailVerified) return;

    tap();
    setVerifSending(true);
    try {
      await sendEmailVerification(currentUser);
      success();
      showToast(
        t("verificationEmailSent", {
          defaultValue: "Email de vérification envoyé.",
        }),
        "success"
      );
    } catch (e) {
      console.error("resendVerification error:", e);
      warning();
      showToast(t("unknownError"), "error");
    } finally {
      setVerifSending(false);
    }
  }, [showToast, t]);

  const handleSignOut = useCallback(() => {
    Alert.alert(
      t("logout"),
      t("logoutConfirm", {
        defaultValue: "Es-tu sûr de vouloir te déconnecter ?",
      }),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("logout"),
          style: "destructive",
          onPress: async () => {
            try {
              tap();
              await auth.signOut();
              router.replace("/login");
              showToast(
                t("loggedOut", { defaultValue: "Déconnecté." }),
                "info"
              );
            } catch (error) {
              console.error("SignOut error from UserAccount:", error);
              warning();
              showToast(
                t("logoutFailed", {
                  defaultValue:
                    "La déconnexion a échoué. Réessaie dans quelques instants.",
                }),
                "error"
              );
            }
          },
        },
      ],
      { cancelable: true }
    );
  }, [router, showToast, t]);

  // Méthode principale de connexion (email / Google / Apple…)
  const primaryProviderId = user?.providerData?.[0]?.providerId ?? "password";
  const providerLabel = useMemo(() => {
    switch (primaryProviderId) {
      case "password":
        return t("auth.emailPassword", {
          defaultValue: "Email + mot de passe",
        });
      case "google.com":
        return "Google";
      case "apple.com":
        return "Apple";
      case "facebook.com":
        return "Facebook";
      default:
        return t("auth.otherProvider", { defaultValue: "Autre méthode" });
    }
  }, [primaryProviderId, t]);

  const badgeVerified = !!user?.emailVerified;

  // Si plus de user → on laisse la redirection gérer, écran neutre
  if (!user) {
    return (
      <LinearGradient
        colors={[
          currentTheme.colors.background,
          currentTheme.colors.cardBackground + "F0",
        ]}
        style={styles.gradientContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView style={styles.safeArea}>
          <StatusBar
            translucent
            backgroundColor="transparent"
            barStyle={isDarkMode ? "light-content" : "dark-content"}
          />
          <CustomHeader title={t("myAccount", { defaultValue: "Mon compte" })} />
          <View style={styles.center}>
            <ActivityIndicator
              size="large"
              color={currentTheme.colors.secondary}
            />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[
        currentTheme.colors.background,
        currentTheme.colors.cardBackground + "F0",
      ]}
      style={styles.gradientContainer}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle={isDarkMode ? "light-content" : "dark-content"}
        />
        <CustomHeader title={t("myAccount", { defaultValue: "Mon compte" })} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 📧 Email + statut vérification */}
          <Animated.View
            entering={FadeInUp.delay(100)}
            style={[
              styles.infoCard,
              {
                borderColor: currentTheme.colors.border,
                backgroundColor: isDarkMode
                  ? "rgba(255, 255, 255, 0.05)"
                  : "#FFFFFF",
              },
            ]}
          >
            <View style={styles.rowBetween}>
              <Text
                style={[
                  styles.label,
                  { color: currentTheme.colors.secondary },
                ]}
              >
                {t("email")}
              </Text>

              {badgeVerified ? (
                <View
                  style={[
                    styles.badge,
                    {
                      borderColor: "#22C55E",
                      backgroundColor: "rgba(34,197,94,0.15)",
                    },
                  ]}
                >
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={normalizeSize(14)}
                    color="#22C55E"
                  />
                  <Text
                    style={[
                      styles.badgeText,
                      {
                        color: "#14532D",
                      },
                    ]}
                  >
                    {t("verified")}
                  </Text>
                </View>
              ) : (
                <Pressable
                  onPress={resendVerification}
                  disabled={verifSending}
                  style={({ pressed }) => [
                    styles.badge,
                    {
                      borderColor: "#FF8C00",
                      backgroundColor: "rgba(255,140,0,0.12)",
                      opacity: verifSending ? 0.7 : pressed ? 0.9 : 1,
                    },
                  ]}
                  accessibilityLabel={t("resendVerification")}
                  accessibilityHint={t("resendVerificationHint", {
                    defaultValue:
                      "Envoie un nouvel email de vérification à ton adresse.",
                  })}
                  testID="resend-verification"
                >
                  {verifSending ? (
                    <ActivityIndicator size="small" color="#FF8C00" />
                  ) : (
                    <Ionicons
                      name="mail-outline"
                      size={normalizeSize(14)}
                      color="#FF8C00"
                    />
                  )}
                  <Text
                    style={[
                      styles.badgeText,
                      {
                        color: "#7C2D12",
                      },
                    ]}
                  >
                    {verifSending
                      ? t("sending", { defaultValue: "Envoi..." })
                      : t("verify")}
                  </Text>
                </Pressable>
              )}
            </View>

            <TouchableOpacity
              onPress={() => copy(user.email)}
              activeOpacity={0.8}
              accessibilityLabel={t("copyEmail")}
              accessibilityHint={t("copyFieldHint", {
                defaultValue: "Copie cette information dans le presse-papiers.",
              })}
            >
              <View style={styles.copyRow}>
                <Text
                  style={[
                    styles.value,
                    {
                      color: isDarkMode
                        ? currentTheme.colors.textPrimary
                        : "#111111",
                      flex: 1,
                    },
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
                  {user.email || "-"}
                </Text>
                {!!user.email && (
                  <Ionicons
                    name="copy-outline"
                    size={normalizeSize(18)}
                    color={currentTheme.colors.secondary}
                  />
                )}
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* 👤 Username */}
          <Animated.View
            entering={FadeInUp.delay(200)}
            style={[
              styles.infoCard,
              {
                borderColor: currentTheme.colors.border,
                backgroundColor: isDarkMode
                  ? "rgba(255, 255, 255, 0.05)"
                  : "#FFFFFF",
              },
            ]}
          >
            <View style={styles.rowBetween}>
              <Text
                style={[
                  styles.label,
                  { color: currentTheme.colors.secondary },
                ]}
              >
                {t("username")}
              </Text>

              {user.displayName ? null : (
                <View
                  style={[
                    styles.badge,
                    { borderColor: currentTheme.colors.border },
                  ]}
                >
                  <Ionicons
                    name="person-circle-outline"
                    size={normalizeSize(14)}
                    color={currentTheme.colors.secondary}
                  />
                  <Text
                    style={[
                      styles.badgeText,
                      { color: currentTheme.colors.secondary },
                    ]}
                  >
                    {t("notSet", { defaultValue: "Non défini" })}
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              onPress={() => copy(user.displayName)}
              activeOpacity={0.8}
              accessibilityLabel={t("copyUsername")}
              accessibilityHint={t("copyFieldHint", {
                defaultValue: "Copie cette information dans le presse-papiers.",
              })}
            >
              <View style={styles.copyRow}>
                <Text
                  style={[
                    styles.value,
                    {
                      color: isDarkMode
                        ? currentTheme.colors.textPrimary
                        : "#111111",
                      flex: 1,
                    },
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {user.displayName || "-"}
                </Text>
                {!!user.displayName && (
                  <Ionicons
                    name="copy-outline"
                    size={normalizeSize(18)}
                    color={currentTheme.colors.secondary}
                  />
                )}
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* 🔐 Méthode de connexion + UID */}
          <Animated.View
            entering={FadeInUp.delay(260)}
            style={[
              styles.infoCard,
              {
                borderColor: currentTheme.colors.border,
                backgroundColor: isDarkMode
                  ? "rgba(255, 255, 255, 0.05)"
                  : "#FFFFFF",
              },
            ]}
          >
            <View style={styles.rowBetween}>
              <Text
                style={[
                  styles.label,
                  { color: currentTheme.colors.secondary },
                ]}
              >
                {t("signInMethod", {
                  defaultValue: "Méthode de connexion",
                })}
              </Text>
              <Ionicons
                name="shield-checkmark-outline"
                size={normalizeSize(18)}
                color={currentTheme.colors.secondary}
              />
            </View>

            <Text
              style={[
                styles.value,
                {
                  color: isDarkMode
                    ? currentTheme.colors.textPrimary
                    : "#111111",
                  marginBottom: normalizeSize(10),
                },
              ]}
            >
              {providerLabel}
            </Text>

            <Text
              style={[
                styles.label,
                {
                  color: currentTheme.colors.secondary,
                  marginTop: normalizeSize(6),
                },
              ]}
            >
              {t("userId", { defaultValue: "ID utilisateur" })}
            </Text>

            <TouchableOpacity
              onPress={() => copy(user.uid)}
              activeOpacity={0.8}
              accessibilityLabel={t("copyUserId")}
              accessibilityHint={t("copyFieldHint", {
                defaultValue: "Copie cette information dans le presse-papiers.",
              })}
            >
              <View style={styles.copyRow}>
                <Text
                  style={[
                    styles.value,
                    {
                      color: isDarkMode
                        ? currentTheme.colors.textPrimary
                        : "#111111",
                      flex: 1,
                    },
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
                  {user.uid || "-"}
                </Text>
                {!!user.uid && (
                  <Ionicons
                    name="copy-outline"
                    size={normalizeSize(18)}
                    color={currentTheme.colors.secondary}
                  />
                )}
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* 📅 Dates de compte */}
          <Animated.View
            entering={FadeInUp.delay(320)}
            style={[
              styles.infoCard,
              {
                borderColor: currentTheme.colors.border,
                backgroundColor: isDarkMode
                  ? "rgba(255, 255, 255, 0.05)"
                  : "#FFFFFF",
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: currentTheme.colors.secondary },
              ]}
            >
              {t("creationDate")}
            </Text>
            <Text
              style={[
                styles.value,
                {
                  color: isDarkMode
                    ? currentTheme.colors.textPrimary
                    : "#111111",
                  marginBottom: normalizeSize(10),
                },
              ]}
            >
              {creationTime || "-"}
            </Text>

            <Text
              style={[
                styles.label,
                { color: currentTheme.colors.secondary },
              ]}
            >
              {t("lastLogin", {
                defaultValue: "Dernière connexion",
              })}
            </Text>
            <Text
              style={[
                styles.value,
                {
                  color: isDarkMode
                    ? currentTheme.colors.textPrimary
                    : "#111111",
                },
              ]}
            >
              {lastLoginTime || "-"}
            </Text>
          </Animated.View>

          {/* 🚪 Logout */}
          <Animated.View
            entering={FadeInUp.delay(400)}
            style={styles.buttonWrapper}
          >
            <TouchableOpacity
              style={styles.button}
              onPress={handleSignOut}
              accessibilityLabel={t("logout")}
              accessibilityHint={t("logoutConfirm", {
                defaultValue: "Ouvre une fenêtre pour confirmer la déconnexion.",
              })}
              testID="logout-from-account"
            >
              <LinearGradient
                colors={[
                  currentTheme.colors.primary,
                  currentTheme.colors.secondary,
                ]}
                style={styles.buttonGradient}
                start={{ x: 1, y: 1 }}
                end={{ x: 0, y: 0 }}
              >
                <Ionicons
                  name="log-out-outline"
                  size={normalizeSize(20)}
                  color={
                    isDarkMode
                      ? currentTheme.colors.textPrimary
                      : "#111111"
                  }
                />
                <Text
                  style={[
                    styles.buttonText,
                    {
                      color: isDarkMode
                        ? currentTheme.colors.textPrimary
                        : "#111111",
                    },
                  ]}
                >
                  {t("logout")}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingTop:
      Platform.OS === "android" ? StatusBar.currentHeight ?? SPACING : SPACING,
  },
  scrollContent: {
    paddingHorizontal: SPACING,
    paddingBottom: normalizeSize(80),
    alignItems: "center",
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  infoCard: {
    width: "100%",
    borderWidth: 1.5,
    borderRadius: normalizeSize(14),
    padding: normalizeSize(16),
    marginBottom: normalizeSize(16),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.18,
    shadowRadius: normalizeSize(6),
    elevation: 6,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: normalizeSize(6),
  },
  copyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: normalizeSize(8),
  },
  label: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalizeSize(4),
  },
  value: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: normalizeSize(6),
    paddingHorizontal: normalizeSize(8),
    paddingVertical: normalizeSize(4),
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: normalizeSize(12),
    fontFamily: "Comfortaa_700Bold",
  },
  buttonWrapper: {
    width: "100%",
    marginTop: normalizeSize(10),
  },
  button: {
    borderRadius: normalizeSize(16),
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.28,
    shadowRadius: normalizeSize(6),
    elevation: 8,
  },
  buttonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: normalizeSize(14),
    paddingHorizontal: normalizeSize(20),
  },
  buttonText: {
    fontSize: normalizeSize(16),
    marginLeft: normalizeSize(8),
    fontFamily: "Comfortaa_700Bold",
  },
});
