import React, { useEffect, useState } from "react";
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
  SafeAreaView,
} from "react-native";
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
import { tap, success } from "@/src/utils/haptics";


const { width: SCREEN_WIDTH } = Dimensions.get("window");
const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

export default function UserAccount() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const isDarkMode = theme === "dark";
  const currentTheme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  const user = auth.currentUser;
  const [creationTime, setCreationTime] = useState<string | null>(null);
  const [verifSending, setVerifSending] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) {
      router.replace("/login");
      return;
    }
    if (user?.metadata?.creationTime) {
      setCreationTime(new Date(user.metadata.creationTime).toLocaleDateString());
      try {
        const d = new Date(user.metadata.creationTime);
        setCreationTime(
          d.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        );
      } catch {
        setCreationTime("-");
      }
    }
  }, [user]);

  const copy = async (value?: string | null, label?: string) => {
    if (!value) return;
    tap();
    try {
      await Clipboard.setStringAsync(value);
      success();
      Alert.alert(
        label ?? t("copied"),
        t("copiedToClipboard", { defaultValue: "Copié dans le presse-papiers." })
      );
    } catch {}
  };

  const resendVerification = async () => {
    if (!auth.currentUser || auth.currentUser.emailVerified) return;
    tap();
    setVerifSending(true);
    try {
      await sendEmailVerification(auth.currentUser);
      success();
      Alert.alert(
        t("emailVerification"),
        t("verificationEmailSent", {
          defaultValue: "Email de vérification envoyé.",
        })
      );
    } catch (e) {
      Alert.alert(t("error"), t("unknownError"));
    } finally {
      setVerifSending(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      Alert.alert(t("loggedOut"), t("disconnected"));
      router.replace("/login");
    } catch (error) {
      console.error("SignOut error:", error);
      Alert.alert(t("error"), t("logoutFailed"));
    }
  };

  return (
    <>
      
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
            <CustomHeader title={t("myAccount")} />
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
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
                <Text style={[styles.label, { color: currentTheme.colors.secondary }]}>
                  {t("email")}
                </Text>
                {user?.emailVerified ? (
                  <View style={[styles.badge, { borderColor: "#22C55E", backgroundColor: "rgba(34,197,94,0.15)" }]}>
                    <Ionicons name="checkmark-circle-outline" size={normalizeSize(14)} color="#22C55E" />
                    <Text style={[styles.badgeText, { color: "#14532D" }]}>{t("verified")}</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={resendVerification}
                    disabled={verifSending}
                    style={[styles.badge, { borderColor: "#FF8C00", backgroundColor: "rgba(255,140,0,0.12)" }]}
                    accessibilityLabel={t("resendVerification")}
                    testID="resend-verification"
                  >
                    <Ionicons name="mail-outline" size={normalizeSize(14)} color="#FF8C00" />
                    <Text style={[styles.badgeText, { color: "#7C2D12" }]}>
                      {verifSending ? t("sending") : t("verify")}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity onPress={() => copy(user?.email, t("email"))} activeOpacity={0.8}>
                <View style={styles.copyRow}>
                  <Text
                    style={[
                      styles.value,
                      { color: isDarkMode ? currentTheme.colors.textPrimary : "#111111", flex: 1 },
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {user?.email || "-"}
                  </Text>
                  {!!user?.email && (
                    <Ionicons name="copy-outline" size={normalizeSize(18)} color={currentTheme.colors.secondary} />
                  )}
                </View>
              </TouchableOpacity>
            </Animated.View>

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
                <Text style={[styles.label, { color: currentTheme.colors.secondary }]}>
                  {t("username")}
                </Text>
                {user?.displayName ? null : (
                  <View style={[styles.badge, { borderColor: currentTheme.colors.border }]}>
                    <Ionicons name="person-circle-outline" size={normalizeSize(14)} color={currentTheme.colors.secondary} />
                    <Text style={[styles.badgeText, { color: currentTheme.colors.secondary }]}>
                      {t("notSet", { defaultValue: "Non défini" })}
                    </Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => copy(user?.displayName, t("username"))} activeOpacity={0.8}>
                <View style={styles.copyRow}>
                  <Text
                    style={[
                      styles.value,
                      { color: isDarkMode ? currentTheme.colors.textPrimary : "#111111", flex: 1 },
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {user?.displayName || "-"}
                  </Text>
                  {!!user?.displayName && (
                    <Ionicons name="copy-outline" size={normalizeSize(18)} color={currentTheme.colors.secondary} />
                  )}
                </View>
              </TouchableOpacity>
            </Animated.View>

            {/* Creation Date */}
            <Animated.View
              entering={FadeInUp.delay(300)}
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
              <Text style={[styles.label, { color: currentTheme.colors.secondary }]}>
                {t("creationDate")}
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
                {creationTime || "-"}
              </Text>
            </Animated.View>

            {/* Logout */}
            <Animated.View entering={FadeInUp.delay(400)} style={styles.buttonWrapper}>
              <TouchableOpacity style={styles.button} onPress={handleSignOut}>
                <LinearGradient
                  colors={[currentTheme.colors.primary, currentTheme.colors.secondary]}
                  style={styles.buttonGradient}
                  start={{ x: 1, y: 1 }}
                  end={{ x: 0, y: 0 }}
                >
                  <Ionicons
                    name="log-out-outline"
                    size={normalizeSize(20)}
                    color={isDarkMode ? currentTheme.colors.textPrimary : "#111111"}
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
    </>
  );
}

const SPACING = 15;

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingTop:
      Platform.OS === "android" ? StatusBar.currentHeight ?? SPACING : SPACING,
  },
  backButton: {
    position: "absolute",
    top:
      Platform.OS === "android" ? StatusBar.currentHeight ?? SPACING : SPACING,
    left: SPACING,
    zIndex: 10,
    padding: SPACING / 2,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: normalizeSize(20),
  },
  headerWrapper: {
    paddingHorizontal: SPACING,
    paddingVertical: SPACING,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: SPACING,
    paddingBottom: normalizeSize(80),
    alignItems: "center",
  },
  infoCard: {
    width: "100%",
    borderWidth: 1.5,
    borderRadius: normalizeSize(14),
    padding: normalizeSize(16),
    marginBottom: normalizeSize(16),
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
