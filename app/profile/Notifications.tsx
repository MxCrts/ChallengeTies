import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { Theme } from "../../theme/designSystem";
import { db, auth } from "../../constants/firebase-config";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import Animated, { FadeInUp } from "react-native-reanimated";
import designSystem from "../../theme/designSystem";
import { normalize } from "../../utils/normalize";

const SPACING = 15;
const SCREEN_WIDTH = Dimensions.get("window").width;

interface Invitation {
  id: string;
  challengeId: string;
  inviterUsername: string;
  status: string;
  days: number;
  createdAt: any; // timestamp
}

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;
  const router = useRouter();

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const q = query(
      collection(db, "invitations"),
      where("inviteeId", "==", uid),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: Invitation[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Invitation, "id">),
        }));
        setInvitations(fetched);
        setLoading(false);
      },
      (error) => {
        console.error("❌ Erreur chargement invitations:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <LinearGradient
        colors={[
          currentTheme.colors.background,
          currentTheme.colors.cardBackground,
        ]}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color={currentTheme.colors.primary} />
        <Text
          style={[
            styles.loadingText,
            { color: currentTheme.colors.textSecondary },
          ]}
        >
          {t("notifications.loading", "Chargement des invitations...")}
        </Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[
        currentTheme.colors.background,
        currentTheme.colors.cardBackground,
      ]}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={{ padding: SPACING }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={[
            styles.title,
            { color: currentTheme.colors.secondary },
          ]}
        >
          {t("notifications.title", "Mes Invitations")}
        </Text>

        {invitations.length === 0 ? (
          <Animated.View entering={FadeInUp.delay(200)} style={styles.emptyState}>
            <Ionicons
              name="mail-open-outline"
              size={normalize(50)}
              color={currentTheme.colors.textSecondary}
            />
            <Text
              style={[
                styles.emptyTitle,
                { color: currentTheme.colors.textPrimary },
              ]}
            >
              {t("notifications.noInvitesTitle", "Aucune invitation pour le moment")}
            </Text>
            <Text
              style={[
                styles.emptySubtitle,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {t(
                "notifications.noInvitesSubtitle",
                "Vous verrez ici les invitations que vous recevrez"
              )}
            </Text>
          </Animated.View>
        ) : (
          invitations.map((invite) => (
            <Animated.View
              entering={FadeInUp.springify()}
              key={invite.id}
              style={styles.invitationCard}
            >
              <LinearGradient
                colors={[
                  currentTheme.colors.cardBackground,
                  currentTheme.colors.cardBackground + "F0",
                ]}
                style={styles.invitationContent}
              >
                <View style={styles.invitationInfo}>
                  <Ionicons
                    name="person-add-outline"
                    size={normalize(24)}
                    color={currentTheme.colors.secondary}
                    style={{ marginRight: SPACING }}
                  />
                  <View>
                    <Text
                      style={[
                        styles.invitationText,
                        { color: currentTheme.colors.textPrimary },
                      ]}
                    >
                      {t("notifications.inviteFrom", {
                        username: invite.inviterUsername,
                        defaultValue: `Invitation de ${invite.inviterUsername}`,
                      })}
                    </Text>
                    <Text
                      style={[
                        styles.invitationSubText,
                        { color: currentTheme.colors.textSecondary },
                      ]}
                    >
                      {t("notifications.inviteDays", {
                        days: invite.days,
                        defaultValue: `${invite.days} jours`,
                      })}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.viewButton}
                  onPress={() =>
                    router.push(
                      `/challenge-details/${invite.challengeId}?invite=${invite.id}`
                    )
                  }
                >
                  <Text
                    style={[
                      styles.viewButtonText,
                      { color: currentTheme.colors.textPrimary },
                    ]}
                  >
                    {t("notifications.view", "Voir")}
                  </Text>
                  <Ionicons
                    name="chevron-forward-outline"
                    size={normalize(18)}
                    color={currentTheme.colors.textPrimary}
                  />
                </TouchableOpacity>
              </LinearGradient>
            </Animated.View>
          ))
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: normalize(10),
    fontSize: normalize(16),
    fontFamily: "Comfortaa_400Regular",
  },
  title: {
    fontSize: normalize(24),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: SPACING,
  },
  emptyState: {
    alignItems: "center",
    marginTop: normalize(50),
    padding: SPACING,
  },
  emptyTitle: {
    marginTop: SPACING,
    fontSize: normalize(20),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: normalize(16),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: normalize(8),
    maxWidth: SCREEN_WIDTH * 0.75,
  },
  invitationCard: {
    marginBottom: SPACING,
    borderRadius: normalize(15),
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalize(3) },
    shadowOpacity: 0.2,
    shadowRadius: normalize(6),
    elevation: 6,
  },
  invitationContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: SPACING,
  },
  invitationInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  invitationText: {
    fontSize: normalize(16),
    fontFamily: "Comfortaa_700Bold",
  },
  invitationSubText: {
    fontSize: normalize(14),
    fontFamily: "Comfortaa_400Regular",
  },
  viewButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewButtonText: {
    fontSize: normalize(14),
    fontFamily: "Comfortaa_700Bold",
    marginRight: normalize(4),
  },
});
