import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Dimensions,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, onSnapshot, getDoc } from "firebase/firestore"; // deleteDoc retiré
import { db, auth } from "../../constants/firebase-config";
import Animated, { FadeInUp } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import designSystem from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const ITEM_WIDTH = SCREEN_WIDTH * 0.9;
const ITEM_HEIGHT = SCREEN_WIDTH * 0.45;
const CARD_MARGIN = SCREEN_WIDTH * 0.02;

const currentTheme = {
  ...designSystem.lightTheme,
  colors: {
    ...designSystem.lightTheme.colors,
    primary: "#ED8F03", // Orange
    cardBackground: "#FFFFFF",
  },
};

const normalizeSize = (size) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

interface Challenge {
  id: string;
  title: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  createdAt?: string;
  participantsCount?: number;
}

export default function MyChallenges() {
  const router = useRouter();
  const [myChallenges, setMyChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const userRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(userRef, async (snapshot) => {
      if (snapshot.exists()) {
        const userData = snapshot.data();
        const challengeRefs = userData.createdChallenges || [];

        const challengesWithParticipants = await Promise.all(
          challengeRefs.map(async (challenge) => {
            const challengeSnap = await getDoc(
              doc(db, "challenges", challenge.id)
            );
            if (challengeSnap.exists()) {
              return {
                ...challenge,
                participantsCount: challengeSnap.data().participantsCount,
              };
            }
            return challenge;
          })
        );

        setMyChallenges(challengesWithParticipants);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const navigateToChallengeDetails = (item: Challenge) => {
    const route =
      `/challenge-details/${encodeURIComponent(item.id)}` +
      `?title=${encodeURIComponent(item.title)}` +
      `&category=${encodeURIComponent(item.category || "Uncategorized")}` +
      `&description=${encodeURIComponent(item.description || "")}` +
      `&imageUrl=${encodeURIComponent(item.imageUrl || "")}`;
    router.push(route as unknown as `/challenge-details/${string}`);
  };

  const renderChallenge = ({
    item,
    index,
  }: {
    item: Challenge;
    index: number;
  }) => (
    <Animated.View
      entering={FadeInUp.delay(index * 100)}
      style={styles.cardWrapper}
    >
      <TouchableOpacity
        style={styles.cardContainer}
        onPress={() => navigateToChallengeDetails(item)}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={["#FFFFFF", "#FFE0B2"]}
          style={styles.card}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
          ) : (
            <View style={styles.placeholderImage}>
              <Ionicons
                name="image-outline"
                size={normalizeSize(30)}
                color="#B0BEC5"
              />
            </View>
          )}
          <View style={styles.cardContent}>
            <Text style={styles.challengeTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.challengeCategory}>
              {item.category || "Sans catégorie"}
            </Text>
            {item.participantsCount !== undefined && (
              <Text style={styles.participantsText}>
                {item.participantsCount === undefined ||
                item.participantsCount <= 1
                  ? `${
                      item.participantsCount === undefined
                        ? 0
                        : item.participantsCount
                    } participant`
                  : `${item.participantsCount} participants`}
              </Text>
            )}
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => navigateToChallengeDetails(item)}
            >
              <LinearGradient
                colors={["#FF6200", "#FF8C00"]}
                style={styles.viewButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.viewButtonText}>Voir Détails</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={[
            currentTheme.colors.background,
            currentTheme.colors.cardBackground,
          ]}
          style={styles.loadingContainer}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <ActivityIndicator size="large" color="#FF6200" />
          <Text style={styles.loadingText}>Chargement en cours...</Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (myChallenges.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={[
            currentTheme.colors.background,
            currentTheme.colors.cardBackground,
          ]}
          style={styles.noChallengesContainer}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Animated.View
            entering={FadeInUp.delay(100)}
            style={styles.noChallengesContent}
          >
            <Ionicons
              name="create-outline"
              size={normalizeSize(60)}
              color="#B0BEC5"
            />
            <Text style={styles.noChallengesText}>Aucun défi créé !</Text>
            <Text style={styles.noChallengesSubtext}>
              Créez votre premier défi dès maintenant !
            </Text>
          </Animated.View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={[
          currentTheme.colors.background,
          currentTheme.colors.cardBackground,
        ]}
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerWrapper}>
          <CustomHeader title="Mes Défis Créés" />
        </View>
        <FlatList
          data={myChallenges}
          renderItem={renderChallenge}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  headerWrapper: {
    marginTop: SCREEN_HEIGHT * 0.01,
    marginBottom: SCREEN_HEIGHT * 0.02,
    paddingHorizontal: SCREEN_WIDTH * 0.05,
  },
  listContent: {
    paddingHorizontal: SCREEN_WIDTH * 0.05,
    paddingBottom: SCREEN_HEIGHT * 0.1,
  },
  cardWrapper: {
    marginBottom: CARD_MARGIN,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(6) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(8),
    elevation: 8,
  },
  cardContainer: {
    width: ITEM_WIDTH,
    borderRadius: normalizeSize(20),
    overflow: "hidden",
    alignSelf: "center",
  },
  card: {
    flexDirection: "row",
    padding: normalizeSize(15),
    borderRadius: normalizeSize(20),
    borderWidth: 1,
    borderColor: "#FF620030",
    minHeight: ITEM_HEIGHT,
  },
  cardImage: {
    width: normalizeSize(70),
    height: normalizeSize(70),
    borderRadius: normalizeSize(14),
    marginRight: normalizeSize(15),
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  placeholderImage: {
    width: normalizeSize(70),
    height: normalizeSize(70),
    borderRadius: normalizeSize(14),
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: normalizeSize(15),
  },
  cardContent: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: normalizeSize(18),
    color: "#333333",
    fontFamily: currentTheme.typography.title.fontFamily,
  },
  challengeCategory: {
    fontSize: normalizeSize(14),
    color: "#777777",
    fontFamily: currentTheme.typography.body.fontFamily,
    marginTop: normalizeSize(2),
    textTransform: "capitalize",
  },
  participantsText: {
    fontSize: normalizeSize(12),
    color: "#FF6200",
    fontFamily: currentTheme.typography.body.fontFamily,
    marginTop: normalizeSize(5),
  },
  viewButton: {
    borderRadius: normalizeSize(12),
    overflow: "hidden",
    marginTop: normalizeSize(10),
  },
  viewButtonGradient: {
    paddingVertical: normalizeSize(10),
    paddingHorizontal: normalizeSize(15),
    alignItems: "center",
  },
  viewButtonText: {
    color: "#FFFFFF",
    fontFamily: currentTheme.typography.title.fontFamily,
    fontSize: normalizeSize(14),
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: normalizeSize(10),
    fontSize: normalizeSize(16),
    fontFamily: currentTheme.typography.body.fontFamily,
    color: currentTheme.colors.textSecondary,
  },
  noChallengesContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noChallengesContent: {
    alignItems: "center",
  },
  noChallengesText: {
    fontSize: normalizeSize(20),
    fontFamily: currentTheme.typography.title.fontFamily,
    color: "#333333",
    marginTop: normalizeSize(15),
    textAlign: "center",
  },
  noChallengesSubtext: {
    fontSize: normalizeSize(16),
    fontFamily: currentTheme.typography.body.fontFamily,
    color: "#777777",
    textAlign: "center",
    marginTop: normalizeSize(10),
    maxWidth: SCREEN_WIDTH * 0.65,
  },
});
