import React, { useRef, useState } from "react";
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
import {
  useSavedChallenges,
  Challenge as ContextChallenge,
} from "../../context/SavedChallengesContext";
import { useTheme } from "../../context/ThemeContext";
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const ITEM_WIDTH = SCREEN_WIDTH * 0.9;
const ITEM_HEIGHT = SCREEN_WIDTH * 0.45;
const CARD_MARGIN = SCREEN_WIDTH * 0.02;

const normalizeSize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

export default function SavedChallengesScreen() {
  const { savedChallenges, removeChallenge } = useSavedChallenges();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();
  const swipeableRefs = useRef<(Swipeable | null)[]>([]);
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  // Simuler le chargement initial
  React.useEffect(() => {
    const load = async () => {
      try {
        await loadSavedChallenges();
      } catch (error) {
        console.error("Erreur lors du chargement initial :", error);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [loadSavedChallenges]);

  const navigateToChallengeDetails = (item: ContextChallenge) => {
    const selectedDays = item.daysOptions[0] || 7;
    const completedDays = 0;
    const route =
      `/challenge-details/${encodeURIComponent(item.id)}` +
      `?title=${encodeURIComponent(item.title)}` +
      `&selectedDays=${selectedDays}` +
      `&completedDays=${completedDays}` +
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
            try {
              await removeChallenge(challengeId);
              Alert.alert("Supprimé", "Défi supprimé avec succès.");
            } catch (err) {
              console.error("Erreur lors de la suppression :", err);
              Alert.alert("Erreur", "Impossible de supprimer ce défi.");
              const swipeable = swipeableRefs.current[index];
              if (swipeable) {
                swipeable.close();
              }
            }
          },
        },
      ]
    );
  };

  const getCardStyle = () => ({
    ...styles.card,
    borderColor: isDarkMode ? "#FFDD9533" : "#e3701e33",
  });

  const renderChallengeItem = ({
    item,
    index,
  }: {
    item: ContextChallenge;
    index: number;
  }) => {
    const selectedDays = item.daysOptions[0] || 7; // Prendre le 1er jour ou 7 par défaut
    const completedDays = 0; // Pas de progression sauvegardée
    const progress = completedDays / selectedDays;
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
          onSwipeableOpen={() => handleRemoveChallenge(item.id, index)}
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
                <Text
                  style={[
                    styles.challengeCategory,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                >
                  {item.category || "Sans catégorie"}
                </Text>
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
                    {completedDays}/{selectedDays} jours
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.viewButton}
                  onPress={() => navigateToChallengeDetails(item)}
                >
                  <LinearGradient
                    colors={[
                      currentTheme.colors.secondary,
                      currentTheme.colors.primary,
                    ]}
                    style={styles.viewButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text
                      style={[
                        styles.viewButtonText,
                        { color: currentTheme.colors.textPrimary },
                      ]}
                    >
                      Voir Détails
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
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
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
              color={currentTheme.colors.textSecondary}
            />
            <Text
              style={[
                styles.noChallengesText,
                { color: currentTheme.colors.textPrimary },
              ]}
            >
              Aucun défi sauvegardé !
            </Text>
            <Text
              style={[
                styles.noChallengesSubtext,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
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
          keyExtractor={(item, index) => `saved-${item.id}-${index}`}
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
  challengeCategory: {
    fontSize: normalizeSize(14),
    fontFamily: "Comfortaa_400Regular",
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
    marginTop: normalizeSize(5),
    fontFamily: "Comfortaa_400Regular",
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
