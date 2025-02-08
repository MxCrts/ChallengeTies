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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useCurrentChallenges } from "../../context/CurrentChallengesContext";
import { Swipeable } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ConfettiCannon from "react-native-confetti-cannon";
import * as Progress from "react-native-progress";

interface ChallengeItem {
  id: string;
  title: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  selectedDays: number;
  completedDays: number;
  lastMarkedDate?: string | null;
}

export default function CurrentChallenges() {
  const router = useRouter();
  const {
    currentChallenges,
    completedTodayChallenges,
    markToday,
    removeChallenge,
  } = useCurrentChallenges();

  const [isLoading, setIsLoading] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);
  const confettiRef = useRef<ConfettiCannon | null>(null);

  useEffect(() => {
    if (
      currentChallenges.length === 0 &&
      completedTodayChallenges.length === 0
    ) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }
  }, [currentChallenges, completedTodayChallenges]);

  const handleMarkToday = async (id: string, selectedDays: number) => {
    try {
      await markToday(id, selectedDays);
      setConfettiActive(true);
    } catch (err) {
      console.error("Erreur lors du marquage :", err);
      Alert.alert("Erreur", "Impossible de marquer aujourd'hui.");
    }
  };

  const handleRemoveChallenge = (id: string, selectedDays: number) => {
    Alert.alert(
      "Supprimer le Défi",
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

  const navigateToChallengeDetails = (item: ChallengeItem) => {
    const route =
      `/challenge-details/${encodeURIComponent(item.id)}` +
      `?title=${encodeURIComponent(item.title)}` +
      `&selectedDays=${item.selectedDays}` +
      `&completedDays=${item.completedDays}`;

    router.push(route as unknown as `/challenge-details/${string}`);
  };

  const renderChallengeItem = ({ item }: { item: ChallengeItem }) => {
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
        >
          <LinearGradient
            colors={["#1E293B", "#334155"]}
            style={styles.cardGradient}
          >
            <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{item.title}</Text>

              {/* Progression */}
              <View style={styles.progressContainer}>
                <Progress.Bar
                  progress={progress}
                  width={null}
                  height={10}
                  borderRadius={5}
                  color={progress >= 1 ? "#10B981" : "#3B82F6"}
                  unfilledColor="#1E293B"
                />
                <Text style={styles.progressText}>
                  {item.completedDays}/{item.selectedDays} jours
                </Text>
              </View>

              {/* Bouton d'action */}
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
          </LinearGradient>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FACC15" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Défis en cours</Text>

      {currentChallenges.length > 0 ? (
        <FlatList
          data={currentChallenges}
          renderItem={renderChallengeItem}
          keyExtractor={(item) => `${item.id}_${item.selectedDays}`}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <Text style={styles.noChallenges}>Aucun défi en cours.</Text>
      )}

      {confettiActive && (
        <ConfettiCannon
          ref={confettiRef}
          count={150}
          origin={{ x: 200, y: 0 }}
          fadeOut
          explosionSpeed={600}
          fallSpeed={2500}
          onAnimationEnd={() => setConfettiActive(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#FACC15",
    textAlign: "center",
    marginVertical: 15,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  listContent: {
    paddingBottom: 40,
  },
  noChallenges: {
    fontSize: 16,
    textAlign: "center",
    color: "#9ca3af",
    marginTop: 20,
  },
  cardContainer: {
    borderRadius: 18,
    marginBottom: 15,
    overflow: "hidden",
  },
  cardGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
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
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FACC15",
  },
  progressContainer: {
    marginVertical: 8,
  },
  progressText: {
    color: "#FACC15",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "500",
  },
  markTodayButton: {
    backgroundColor: "#22c55e",
    padding: 10,
    borderRadius: 10,
    marginTop: 8,
    alignItems: "center",
  },
  disabledMarkButton: {
    backgroundColor: "#9ca3af",
  },
  markTodayText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0F172A",
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
