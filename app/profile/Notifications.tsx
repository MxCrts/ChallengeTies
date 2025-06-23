import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router"; // Ajouté useLocalSearchParams
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db, auth } from "../../constants/firebase-config";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";
import Animated, { FadeInUp, ZoomIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import CustomHeader from "@/components/CustomHeader";

const SPACING = 18;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const ITEM_WIDTH = SCREEN_WIDTH * 0.9;
const ITEM_HEIGHT = SCREEN_WIDTH * 0.2;

const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

interface Invitation {
  id: string;
  challengeId: string;
  inviterId: string;
  inviteeId: string;
  status: string;
  createdAt: any;
}

export default function Notifications() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const { challengeId, invite: inviteId } = useLocalSearchParams(); // Récupère les params
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = useMemo(
    () => (isDarkMode ? designSystem.darkTheme : designSystem.lightTheme),
    [isDarkMode]
  );

  // Loguer les params du deep link
  useEffect(() => {
    if (challengeId && inviteId) {
      console.log("📬 Invitation reçue via deep link:", {
        challengeId,
        inviteId,
      });
    }
  }, [challengeId, inviteId]);

  useEffect(() => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, "invitations"),
      where("inviteeId", "==", auth.currentUser.uid),
      where("status", "==", "pending")
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const invites = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Invitation[];
        setInvitations(invites);
        setLoading(false);
      },
      (error) => {
        console.error("Erreur lors de la récupération des données :", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Afficher l'invitation du deep link
  const renderDeepLinkInvitation = () => {
    if (challengeId && inviteId) {
      return (
        <Animated.View entering={FadeInUp} style={styles.deepLinkContainer}>
          <Text
            style={[
              styles.deepLinkText,
              { color: currentTheme.colors.textPrimary },
            ]}
          >
            {t("newInvitation", { challenge: challengeId })} (ID: {inviteId})
          </Text>
          <TouchableOpacity
            onPress={() =>
              router.push(
                `/challenge-details/${challengeId}?invite=${inviteId}`
              )
            }
            style={styles.deepLinkButton}
          >
            <Text
              style={[
                styles.deepLinkButtonText,
                { color: currentTheme.colors.primary },
              ]}
            >
              {t("viewDetails")}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      );
    }
    return null;
  };

  const renderInvitation = useCallback(
    ({ item, index }: { item: Invitation; index: number }) => (
      <Animated.View
        entering={ZoomIn.delay(index * 50)}
        style={styles.cardWrapper}
      >
        <TouchableOpacity
          onPress={() => router.push(`/challenge-details/${item.challengeId}`)}
          style={styles.cardContainer}
          activeOpacity={0.8}
          accessibilityLabel={t("viewInvitation", {
            challenge: item.challengeId,
          })}
          accessibilityHint={t("viewDetails")}
          accessibilityRole="button"
          testID={`invitation-card-${index}`}
        >
          <LinearGradient
            colors={[
              currentTheme.colors.cardBackground,
              currentTheme.colors.cardBackground + "F0",
            ]}
            style={[
              styles.linearGradient,
              {
                borderColor: isDarkMode
                  ? currentTheme.colors.secondary
                  : "#FF8C00",
              },
            ]}
          >
            <Ionicons
              name="mail-outline"
              size={normalizeSize(24)}
              color={currentTheme.colors.secondary}
              accessibilityLabel={t("invitationIcon")}
            />
            <View style={styles.cardText}>
              <Text
                style={[
                  styles.title,
                  {
                    color: isDarkMode
                      ? currentTheme.colors.textPrimary
                      : "#000000",
                  },
                ]}
                numberOfLines={1}
              >
                {t("invitationToChallenge", { challenge: item.challengeId })}
              </Text>
              <Text
                style={[
                  styles.date,
                  { color: currentTheme.colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                {t("receivedOn", {
                  date: new Date(item.createdAt.toDate()).toLocaleDateString(
                    t("locale"),
                    {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    }
                  ),
                })}
              </Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    ),
    [currentTheme, router, t, isDarkMode]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
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
          style={styles.loadingContainer}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.8, y: 1 }}
        >
          <ActivityIndicator size="large" color={currentTheme.colors.primary} />
          <Text
            style={[
              styles.loadingText,
              { color: currentTheme.colors.textPrimary },
            ]}
          >
            {t("loading")}
          </Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
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
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      >
        <View style={styles.noNotificationsContainer}>
          <View style={styles.headerWrapper}>
            <Animated.View entering={FadeInUp}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backButton}
                accessibilityLabel={t("backButton")}
                accessibilityHint={t("backButtonHint")}
                testID="back-button"
              >
                <Ionicons
                  name="arrow-back"
                  size={normalizeSize(24)}
                  color={currentTheme.colors.secondary}
                />
              </TouchableOpacity>
            </Animated.View>
            <CustomHeader title={t("activity")} />
          </View>
          {renderDeepLinkInvitation()}
          {invitations.length > 0 ? (
            <FlatList
              data={invitations}
              renderItem={renderInvitation}
              keyExtractor={(item) => `invite-${item.id}`}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              initialNumToRender={5}
              maxToRenderPerBatch={5}
              windowSize={5}
              contentInset={{ top: SPACING, bottom: normalizeSize(100) }}
              accessibilityRole="list"
              accessibilityLabel={t("listOfNotifications")}
              testID="notifications-list"
            />
          ) : (
            <Animated.View
              entering={FadeInUp.delay(100)}
              style={styles.noNotificationsContent}
            >
              <Ionicons
                name="notifications-off-outline"
                size={normalizeSize(60)}
                color={currentTheme.colors.textSecondary}
                accessibilityLabel={t("noNotificationsIcon")}
              />
              <Text
                style={[
                  styles.noNotificationsText,
                  { color: currentTheme.colors.textPrimary },
                ]}
              >
                {t("noNotifications")}
              </Text>
              <Text
                style={[
                  styles.noNotificationsSubtext,
                  { color: currentTheme.colors.textSecondary },
                ]}
              >
                {t("noNotificationsSubtext")}
              </Text>
            </Animated.View>
          )}
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "transparent" },
  container: { flex: 1 },
  noNotificationsContainer: { flex: 1 },
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
    paddingTop: SPACING * 2.5,
    position: "relative",
  },
  listContent: {
    paddingVertical: SPACING * 1.5,
    paddingHorizontal: SPACING / 2,
    paddingBottom: normalizeSize(80),
  },
  cardWrapper: {
    marginBottom: SPACING * 1.5,
    borderRadius: normalizeSize(25),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(5) },
    shadowOpacity: 0.35,
    shadowRadius: normalizeSize(8),
    elevation: 10,
    width: ITEM_WIDTH,
    alignSelf: "center",
  },
  cardContainer: { borderRadius: normalizeSize(25), overflow: "hidden" },
  linearGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: normalizeSize(18),
    borderRadius: normalizeSize(25),
    borderWidth: 2.5,
    minHeight: normalizeSize(80),
  },
  cardText: { marginLeft: normalizeSize(12), flex: 1 },
  title: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalizeSize(4),
  },
  date: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
    marginTop: normalizeSize(4),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING,
  },
  loadingText: {
    marginTop: normalizeSize(20),
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
  },
  noNotificationsContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: SCREEN_HEIGHT * 0.85,
    paddingHorizontal: SPACING,
  },
  noNotificationsText: {
    fontSize: normalizeSize(22),
    fontFamily: "Comfortaa_700Bold",
    marginTop: SPACING,
    textAlign: "center",
  },
  noNotificationsSubtext: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: SPACING / 2,
    maxWidth: SCREEN_WIDTH * 0.75,
  },
  deepLinkContainer: {
    marginVertical: SPACING,
    padding: SPACING,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: normalizeSize(20),
    alignItems: "center",
  },
  deepLinkText: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
  },
  deepLinkButton: {
    marginTop: SPACING,
    paddingVertical: SPACING / 2,
    paddingHorizontal: SPACING,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: normalizeSize(10),
  },
  deepLinkButtonText: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_700Bold",
  },
});
