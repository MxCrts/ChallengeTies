import React, { useEffect, useState, useRef } from "react";
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
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Swipeable } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Progress from "react-native-progress";
import Animated, { FadeInUp, FadeOutRight } from "react-native-reanimated";
import { doc, getDoc, updateDoc } from "firebase/firestore"; // deleteDoc retiré car non utilisé
import { auth, db } from "../../constants/firebase-config";
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
  selectedDays?: number;
  completedDays?: number;
}

export default function SavedChallengesScreen() {
  const [savedChallenges, setSavedChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();
  const swipeableRefs = useRef<(Swipeable | null)[]>([]); // Références pour les Swipeable

  useEffect(() => {
    const fetchSavedChallenges = async () => {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        console.warn("Utilisateur non authentifié.");
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const challenges = userData.SavedChallenges || [];
          const enrichedChallenges = challenges.map((challenge) => ({
            ...challenge,
            completedDays: challenge.completedDays || 0,
            selectedDays: challenge.selectedDays || 7,
          }));
          setSavedChallenges(enrichedChallenges);
        } else {
          setSavedChallenges([]);
        }
      } catch (error) {
        console.error(
          "Erreur lors du chargement des défis sauvegardés :",
          error
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchSavedChallenges();
  }, []);

  const navigateToChallengeDetails = (item: Challenge) => {
    const route =
      `/challenge-details/${encodeURIComponent(item.id)}` +
      `?title=${encodeURIComponent(item.title)}` +
      `&selectedDays=${item.selectedDays || 7}` +
      `&completedDays=${item.completedDays || 0}` +
      `&category=${encodeURIComponent(item.category || "Uncategorized")}` +
      `&description=${encodeURIComponent(item.description || "")}` +
      `&imageUrl=${encodeURIComponent(item.imageUrl || "")}`;
    router.push(route as unknown as `/challenge-details/${string}`);
  };

  const handleRemoveChallenge = (challengeId: string, index: number) => {
    Alert.alert(
      "Supprimer le défi",
      "Vous êtes sûr ? Ce défi sera retiré de vos sauvegardes.",
      [
        {
          text: "Annuler",
          style: "cancel",
          onPress: () => {
            const swipeable = swipeableRefs.current[index];
            if (swipeable) {
              swipeable.close();
            }
          },
        },
        {
          text: "Continuer",
          style: "destructive",
          onPress: async () => {
            const userId = auth.currentUser?.uid;
            if (!userId) return;

            try {
              // Supprime localement pour déclencher l'animation
              setSavedChallenges((prev) =>
                prev.filter((challenge) => challenge.id !== challengeId)
              );

              // Met à jour Firebase après l'animation
              setTimeout(async () => {
                const userRef = doc(db, "users", userId);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                  const userData = userSnap.data();
                  const updatedChallenges = (
                    userData.SavedChallenges || []
                  ).filter(
                    (challenge: Challenge) => challenge.id !== challengeId
                  );
                  await updateDoc(userRef, {
                    SavedChallenges: updatedChallenges,
                  });
                  Alert.alert("Supprimé", "Défi supprimé avec succès.");
                }
              }, 300); // Durée de l'animation
            } catch (err) {
              console.error("Erreur lors de la suppression :", err);
              Alert.alert("Erreur", "Impossible de supprimer ce défi.");
              const swipeable = swipeableRefs.current[index];
              if (swipeable) {
                swipeable.close();
              }
              // Restaure la liste en cas d'erreur
              setSavedChallenges((prev) => {
                const userRef = doc(db, "users", userId);
                getDoc(userRef).then((snap) => {
                  if (snap.exists()) {
                    const userData = snap.data();
                    return userData.SavedChallenges || [];
                  }
                  return prev;
                });
                return prev;
              });
            }
          },
        },
      ]
    );
  };

  const renderChallengeItem = ({
    item,
    index,
  }: {
    item: Challenge;
    index: number;
  }) => {
    const progress = (item.completedDays || 0) / (item.selectedDays || 7);
    return (
      <Animated.View
        entering={FadeInUp.delay(index * 100)}
        exiting={FadeOutRight.duration(300)} // Animation de sortie
        style={styles.cardWrapper}
      >
        <Swipeable
          ref={(ref) => (swipeableRefs.current[index] = ref)}
          renderRightActions={() => (
            <View style={styles.swipeActionsContainer}>
              <LinearGradient
                colors={["#EF4444", "#B91C1C"]}
                style={styles.trashButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons
                  name="trash-outline"
                  size={normalizeSize(28)}
                  color="#FFFFFF"
                />
              </LinearGradient>
            </View>
          )}
          overshootRight={false}
          onSwipeableOpen={() => handleRemoveChallenge(item.id, index)}
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
              <Image
                source={{
                  uri: item.imageUrl || "https://via.placeholder.com/70",
                }}
                style={styles.cardImage}
              />
              <View style={styles.cardContent}>
                <Text style={styles.challengeTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.challengeCategory}>
                  {item.category || "Sans catégorie"}
                </Text>
                <View style={styles.progressContainer}>
                  <Progress.Bar
                    progress={progress}
                    width={null}
                    height={normalizeSize(8)}
                    borderRadius={normalizeSize(4)}
                    color="#FF6200"
                    unfilledColor="#E0E0E0"
                    borderWidth={0}
                    style={styles.progressBar}
                  />
                  <Text style={styles.progressText}>
                    {item.completedDays || 0}/{item.selectedDays || 7} jours
                  </Text>
                </View>
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
        </Swipeable>
      </Animated.View>
    );
  };

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

  if (savedChallenges.length === 0) {
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
              name="bookmark-outline"
              size={normalizeSize(60)}
              color="#B0BEC5"
            />
            <Text style={styles.noChallengesText}>Aucun défi sauvegardé !</Text>
            <Text style={styles.noChallengesSubtext}>
              Sauvegardez des défis pour les voir ici.
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
          <CustomHeader title="Défis Sauvegardés" />
        </View>
        <FlatList
          data={savedChallenges}
          renderItem={renderChallengeItem}
          keyExtractor={(item) => `saved-${item.id}`}
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
  progressContainer: {
    marginVertical: normalizeSize(10),
  },
  progressBar: {
    flex: 1,
  },
  progressText: {
    fontSize: normalizeSize(12),
    color: "#FF6200",
    marginTop: normalizeSize(5),
    fontFamily: currentTheme.typography.body.fontFamily,
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
  swipeActionsContainer: {
    width: SCREEN_WIDTH * 0.18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: CARD_MARGIN,
  },
  trashButton: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: normalizeSize(20),
  },
});
