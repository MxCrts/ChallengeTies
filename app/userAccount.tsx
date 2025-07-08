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
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import designSystem from "../theme/designSystem";
import CustomHeader from "../components/CustomHeader";

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

  useEffect(() => {
    if (user?.metadata?.creationTime) {
      setCreationTime(new Date(user.metadata.creationTime).toLocaleDateString());
    }
  }, [user]);

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
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDarkMode ? "light-content" : "dark-content"}
      />
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
          {/* Back Button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityLabel={t("goBack")}
            testID="back-button"
          >
            <Ionicons
              name="arrow-back"
              size={normalizeSize(24)}
              color={currentTheme.colors.secondary}
            />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.headerWrapper}>
            <CustomHeader title={t("myAccount")} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Email */}
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
              <Text style={[styles.label, { color: currentTheme.colors.secondary }]}>
                {t("email")}
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
                {user?.email || "-"}
              </Text>
            </Animated.View>

            {/* Username */}
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
              <Text style={[styles.label, { color: currentTheme.colors.secondary }]}>
                {t("username")}
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
                {user?.displayName || "-"}
              </Text>
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
  label: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalizeSize(4),
  },
  value: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
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
