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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useCurrentChallenges } from "../../context/CurrentChallengesContext";
import { Swipeable } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ConfettiCannon from "react-native-confetti-cannon";
import * as Progress from "react-native-progress";
import Animated, { FadeInUp } from "react-native-reanimated";
import BackButton from "../../components/BackButton";
import designSystem from "../../theme/designSystem";

// Dimensions et constantes de style
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ITEM_WIDTH = Math.round(SCREEN_WIDTH * 0.8);
const ITEM_HEIGHT = 260;
const CARD_MARGIN = 5;
const EFFECTIVE_ITEM_WIDTH = ITEM_WIDTH + CARD_MARGIN * 2;
const LIGHT_GREEN = "#6EE7B7"; // Vert clair pour la barre de progression

// Palette personnalisée harmonisée (inspirée du designSystem)
const currentTheme = {
  ...designSystem.lightTheme,
  colors: {
    ...designSystem.lightTheme.colors,
    primary: "#ED8F03", // Orange
    cardBackground: "#FFFFFF",
    trophy: "#FACC15",
  },
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
  const { currentChallenges, markToday, removeChallenge } =
    useCurrentChallenges();
  const [isLoading, setIsLoading] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);
  const confettiRef = useRef<ConfettiCannon | null>(null);

  useEffect(() => {
    setIsLoading(currentChallenges.length === 0);
  }, [currentChallenges]);

  const handleMarkToday = async (id: string, selectedDays: number) => {
    try {
      await markToday(id, selectedDays);
      setConfettiActive(true);
      // L'état se met à jour directement (bouton passe en "Déjà marqué" et progression actualisée)
    } catch (err) {
      console.error("Erreur lors du marquage :", err);
      Alert.alert("Erreur", "Impossible de marquer aujourd'hui.");
    }
  };

  const handleRemoveChallenge = (id: string, selectedDays: number) => {
    Alert.alert(
      "Supprimer le défi",
      "Es-tu sûr de vouloir supprimer ce défi ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await removeChallenge(id, selectedDays);
              Alert.alert("Supprimé", "Défi supprimé avec succès.");
            } catch (err) {
              console.error("Erreur lors de la suppression :", err);
              Alert.alert("Erreur", "Impossible de supprimer ce défi.");
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

  // Déduplication des défis basée sur l'ID et selectedDays
  const deduplicatedChallenges: Challenge[] = Array.from(
    new Map(
      currentChallenges.map((item: Challenge) => [
        `${item.id}_${item.selectedDays}`,
        item,
      ])
    ).values()
  );

  const renderChallengeItem = ({ item }: { item: Challenge }) => {
    const isMarkedToday = item.lastMarkedDate === new Date().toDateString();
    const progress = item.completedDays / item.selectedDays;
    return (
      <Swipeable
        renderRightActions={() => (
          <View style={styles.swipeActionsContainer}>
            <TouchableOpacity
              style={styles.trashButton}
              onPress={() => handleRemoveChallenge(item.id, item.selectedDays)}
            >
              <Ionicons name="trash-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
        overshootRight={false}
      >
        <TouchableOpacity
          style={styles.cardContainer}
          onPress={() => navigateToChallengeDetails(item)}
          activeOpacity={0.9}
        >
          <View style={styles.card}>
            <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
            <View style={styles.cardContent}>
              <Text style={styles.challengeTitle} numberOfLines={1}>
                {item.title}
              </Text>
              {item.day !== undefined && (
                <Text style={styles.challengeDay}>Jour {item.day}</Text>
              )}
              <View style={styles.progressContainer}>
                <Progress.Bar
                  progress={progress}
                  width={null}
                  height={10}
                  borderRadius={5}
                  color={"#C2410C"}
                  unfilledColor={currentTheme.colors.background}
                  style={styles.progressBar}
                />
                <Text style={styles.progressText}>
                  {item.completedDays}/{item.selectedDays} jours
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.markTodayButton,
                  isMarkedToday && styles.disabledMarkButton,
                ]}
                onPress={() => handleMarkToday(item.id, item.selectedDays)}
                disabled={isMarkedToday}
              >
                <Text style={styles.markTodayText}>
                  {isMarkedToday ? "Déjà marqué" : "Marquer Aujourd'hui"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={currentTheme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BackButton color={currentTheme.colors.primary} />
      <Text style={styles.title}>Défis en cours</Text>
      {deduplicatedChallenges.length > 0 ? (
        <FlatList
          data={deduplicatedChallenges}
          renderItem={renderChallengeItem}
          keyExtractor={(item) => `current-${item.id}_${item.selectedDays}`}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <Text style={styles.noChallenges}>Aucun défi en cours.</Text>
      )}
      {/* Optionnel : Confetti peut être activé via confettiActive */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
    backgroundColor: currentTheme.colors.background,
  },
  title: {
    fontSize: 25,
    fontFamily: currentTheme.typography.title.fontFamily,
    color: "#000000",
    marginVertical: 20,
    textAlign: "center",
    marginBottom: 30,
  },
  listContent: {
    paddingBottom: 40,
  },
  noChallenges: {
    fontSize: 16,
    textAlign: "center",
    color: "#9CA3AF",
    marginTop: 20,
  },
  cardContainer: {
    borderRadius: 18,
    marginBottom: 5,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: currentTheme.colors.primary,
    margin: 10,
  },
  card: {
    backgroundColor: currentTheme.colors.cardBackground,
    borderRadius: 18,
    flexDirection: "row",
    padding: 14,
    elevation: 3,
  },
  cardImage: {
    width: 70,
    height: 70,
    borderRadius: 14,
    marginRight: 14,
  },
  cardContent: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: 18,
    color: "#000000",
    fontFamily: currentTheme.typography.title.fontFamily,
  },
  challengeDay: {
    fontSize: 14,
    color: "#000000",
    fontFamily: currentTheme.typography.title.fontFamily,
    textAlign: "center",
  },
  progressContainer: {
    marginVertical: 8,
  },
  progressBar: {
    marginLeft: 20, // Décalage pour ne pas couper l'image
  },
  progressText: {
    color: "#000000",
    fontSize: 12,
    marginTop: 4,
    fontFamily: currentTheme.typography.title.fontFamily,
  },
  markTodayButton: {
    backgroundColor: currentTheme.colors.primary,
    padding: 10,
    borderRadius: 10,
    marginTop: 8,
    alignItems: "center",
  },
  disabledMarkButton: {
    backgroundColor: "#D3D3D3", // Orange clair pour état désactivé
  },
  markTodayText: {
    color: "#000000",
    fontFamily: currentTheme.typography.title.fontFamily,
    fontSize: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: currentTheme.colors.background,
  },
  swipeActionsContainer: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EF4444",
    width: 70,
    borderRadius: 18,
    marginBottom: 15,
  },
  trashButton: {
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
    width: "100%",
  },
});
