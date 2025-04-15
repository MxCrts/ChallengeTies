import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
  Dimensions,
  SafeAreaView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useCurrentChallenges } from "../../context/CurrentChallengesContext";
import { Swipeable } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ConfettiCannon from "react-native-confetti-cannon";
import * as Progress from "react-native-progress";
import Animated, { FadeInUp, FadeOutRight } from "react-native-reanimated";
import { doc, updateDoc, increment } from "firebase/firestore";
import { db, auth } from "../../constants/firebase-config";
import { useTheme } from "../../context/ThemeContext";
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const ITEM_WIDTH = SCREEN_WIDTH * 0.9;
const ITEM_HEIGHT = SCREEN_WIDTH * 0.45;
const CARD_MARGIN = SCREEN_WIDTH * 0.02;

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
  day?: number;
  selectedDays: number;
  completedDays: number;
  lastMarkedDate?: string | null;
}

export default function CurrentChallenges() {
  const router = useRouter();
  const { currentChallenges, markToday, removeChallenge, isMarkedToday } =
    useCurrentChallenges();
  const [isLoading, setIsLoading] = useState(true);
  const [confettiActive, setConfettiActive] = useState(false);
  const [localChallenges, setLocalChallenges] = useState<Challenge[]>([]);
  const confettiRef = useRef<ConfettiCannon | null>(null);
  const swipeableRefs = useRef<(Swipeable | null)[]>([]);
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  useEffect(() => {
    console.log(
      "🔎 CurrentChallenges reçu du contexte :",
      JSON.stringify(currentChallenges, null, 2)
    );
    const uniqueChallenges = Array.from(
      new Map(
        currentChallenges.map((item: Challenge) => [
          `${item.id}_${item.selectedDays}`,
          item,
        ])
      ).values()
    );
    console.log(
      "🎨 LocalChallenges mis à jour :",
      JSON.stringify(uniqueChallenges, null, 2)
    );
    setLocalChallenges(uniqueChallenges);
  }, [currentChallenges]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Le reste du code (handleMarkToday, handleRemoveChallenge, etc.) reste inchangé
  // Pour brièveté, je ne répète pas tout, mais il est identique à la dernière version avec le mode sombre

  const handleMarkToday = async (id: string, selectedDays: number) => {
    try {
      const result = await markToday(id, selectedDays);
      if (result.success) {
        setConfettiActive(true);
      } else if (result.missedDays && result.missedDays >= 2) {
      }
    } catch (err) {
      console.error("Erreur lors du marquage :", err);
      Alert.alert("Erreur", "Impossible de marquer aujourd'hui.");
    }
  };

  const handleRemoveChallenge = (
    id: string,
    selectedDays: number,
    index: number
  ) => {
    Alert.alert(
      "Abandonner le défi",
      "Vous êtes sûr ? Vous perdrez toute votre progression.",
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
            try {
              setLocalChallenges((prev) =>
                prev.filter(
                  (challenge) =>
                    !(
                      challenge.id === id &&
                      challenge.selectedDays === selectedDays
                    )
                )
              );
              setTimeout(async () => {
                await removeChallenge(id, selectedDays);
                const challengeRef = doc(db, "challenges", id);
                await updateDoc(challengeRef, {
                  participantsCount: increment(-1),
                });
                Alert.alert("Abandonné", "Vous avez abandonné le défi.");
              }, 300);
            } catch (err) {
              console.error("Erreur lors de la suppression :", err);
              Alert.alert("Erreur", "Impossible d'abandonner ce défi.");
              const swipeable = swipeableRefs.current[index];
              if (swipeable) {
                swipeable.close();
              }
              setLocalChallenges(
                Array.from(
                  new Map(
                    currentChallenges.map((item: Challenge) => [
                      `${item.id}_${item.selectedDays}`,
                      item,
                    ])
                  ).values()
                )
              );
            }
          },
        },
      ]
    );
  };

  const navigateToChallengeDetails = (item: Challenge) => {
    const route =
      `/challenge-details/${encodeURIComponent(item.id)}` +
      `?title=${encodeURIComponent(item.title)}` +
      `&selectedDays=${item.selectedDays}` +
      `&completedDays=${item.completedDays}` +
      `&category=${encodeURIComponent(item.category || "Uncategorized")}` +
      `&description=${encodeURIComponent(item.description || "")}` +
      `&imageUrl=${encodeURIComponent(item.imageUrl || "")}`;
    router.push(route as unknown as `/challenge-details/${string}`);
  };

  const getCardStyle = () => ({
    ...styles.card,
    borderColor: isDarkMode ? "#FFDD9533" : "#e3701e33",
  });

  const renderChallengeItem = ({
    item,
    index,
  }: {
    item: Challenge;
    index: number;
  }) => {
    const markedToday = isMarkedToday(item.id, item.selectedDays);
    const progress = item.completedDays / item.selectedDays;

    return (
      <Animated.View
        entering={FadeInUp.delay(index * 100)}
        exiting={FadeOutRight.duration(300)}
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
          onSwipeableOpen={() =>
            handleRemoveChallenge(item.id, item.selectedDays, index)
          }
        >
          <TouchableOpacity
            style={styles.cardContainer}
            onPress={() => navigateToChallengeDetails(item)}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[
                currentTheme.colors.cardBackground,
                `${currentTheme.colors.cardBackground}F0`,
              ]}
              style={getCardStyle()}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Image
                source={{
                  uri: item.imageUrl || "https://via.placeholder.com/70",
                }}
                style={[
                  styles.cardImage,
                  { borderColor: currentTheme.colors.border },
                ]}
              />
              <View style={styles.cardContent}>
                <Text
                  style={[
                    styles.challengeTitle,
                    { color: currentTheme.colors.textPrimary },
                  ]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                {item.day !== undefined && (
                  <Text
                    style={[
                      styles.challengeDay,
                      { color: currentTheme.colors.textSecondary },
                    ]}
                  >
                    Jour {item.day}
                  </Text>
                )}
                <View style={styles.progressContainer}>
                  <Progress.Bar
                    progress={progress}
                    width={null}
                    height={normalizeSize(8)}
                    borderRadius={normalizeSize(4)}
                    color={currentTheme.colors.secondary}
                    unfilledColor={isDarkMode ? "#4A4A4A" : "#E0E0E0"}
                    borderWidth={0}
                    style={styles.progressBar}
                  />
                  <Text
                    style={[
                      styles.progressText,
                      { color: currentTheme.colors.secondary },
                    ]}
                  >
                    {item.completedDays}/{item.selectedDays} jours
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.markTodayButton,
                    markedToday && styles.disabledMarkButton,
                  ]}
                  onPress={() => handleMarkToday(item.id, item.selectedDays)}
                  disabled={markedToday}
                >
                  <LinearGradient
                    colors={
                      markedToday
                        ? [
                            isDarkMode ? "#4A4A4A" : "#D3D3D3",
                            isDarkMode ? "#2A2A2A" : "#A3A3A3",
                          ]
                        : [
                            currentTheme.colors.secondary,
                            currentTheme.colors.primary,
                          ]
                    }
                    style={styles.markTodayGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text
                      style={[
                        styles.markTodayText,
                        {
                          color: markedToday
                            ? "#FFFFFF"
                            : currentTheme.colors.textPrimary,
                        },
                      ]}
                    >
                      {markedToday ? "Déjà marqué" : "Marquer Aujourd'hui"}
                    </Text>
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
        >
          <ActivityIndicator
            size="large"
            color={currentTheme.colors.secondary}
          />
          <Text
            style={[
              styles.loadingText,
              { color: currentTheme.colors.textPrimary },
            ]}
          >
            Chargement en cours...
          </Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (localChallenges.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={[
            currentTheme.colors.background,
            currentTheme.colors.cardBackground,
          ]}
          style={styles.noChallengesContainer}
        >
          <Animated.View
            entering={FadeInUp.delay(100)}
            style={styles.noChallengesContent}
          >
            <Ionicons
              name="hourglass-outline"
              size={normalizeSize(60)}
              color={currentTheme.colors.textSecondary}
            />
            <Text
              style={[
                styles.noChallengesText,
                { color: currentTheme.colors.textPrimary },
              ]}
            >
              Aucun défi en cours !
            </Text>
            <Text
              style={[
                styles.noChallengesSubtext,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              Commencez un défi pour le voir ici.
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
          <CustomHeader title="Défis en cours" />
        </View>
        <FlatList
          data={localChallenges}
          renderItem={renderChallengeItem}
          keyExtractor={(item) => `current-${item.id}_${item.selectedDays}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
        {confettiActive && (
          <ConfettiCannon
            count={100}
            origin={{ x: -10, y: 0 }}
            autoStart
            fadeOut
            ref={confettiRef}
            onAnimationEnd={() => setConfettiActive(false)}
          />
        )}
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
    fontFamily: "Comfortaa_700Bold",
    marginTop: normalizeSize(15),
    textAlign: "center",
  },
  noChallengesSubtext: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: normalizeSize(10),
    maxWidth: SCREEN_WIDTH * 0.65,
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
    minHeight: ITEM_HEIGHT,
  },
  cardImage: {
    width: normalizeSize(70),
    height: normalizeSize(70),
    borderRadius: normalizeSize(14),
    marginRight: normalizeSize(15),
    borderWidth: 2,
  },
  cardContent: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_700Bold",
  },
  challengeDay: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_400Regular",
    marginTop: normalizeSize(2),
  },
  progressContainer: {
    marginVertical: normalizeSize(10),
  },
  progressBar: {
    flex: 1,
  },
  progressText: {
    fontSize: normalizeSize(12),
    marginTop: normalizeSize(5),
    fontFamily: "Comfortaa_400Regular",
  },
  markTodayButton: {
    borderRadius: normalizeSize(12),
    overflow: "hidden",
    marginTop: normalizeSize(10),
  },
  disabledMarkButton: {},
  markTodayGradient: {
    paddingVertical: normalizeSize(10),
    paddingHorizontal: normalizeSize(15),
    alignItems: "center",
  },
  markTodayText: {
    fontFamily: "Comfortaa_700Bold",
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
    fontFamily: "Comfortaa_400Regular",
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
