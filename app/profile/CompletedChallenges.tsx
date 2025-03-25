import React, { useEffect, useState } from "react";
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
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../../constants/firebase-config";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn } from "react-native-reanimated";
import BackButton from "../../components/BackButton";
import designSystem from "../../theme/designSystem";

const { width } = Dimensions.get("window");
const currentTheme = designSystem.lightTheme;

interface CompletedChallenge {
  id: string;
  title: string;
  imageUrl?: string;
  completedAt: string;
  category?: string;
  description?: string;
  selectedDays: number;
  history?: { completedAt: string; selectedDays: number }[];
}

export default function CompletedChallenges() {
  const [completedChallenges, setCompletedChallenges] = useState<
    CompletedChallenge[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<{
    title: string;
    history: { completedAt: string; selectedDays: number }[];
  } | null>(null);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setIsLoading(false);
      return;
    }
    const userDocRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(
      userDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const userData = snapshot.data() || {};
          const challenges = Array.isArray(userData.CompletedChallenges)
            ? userData.CompletedChallenges
            : [];
          // On mappe les défis complétés avec des valeurs par défaut
          const mappedChallenges = challenges.map((c: any) => ({
            id: c.id,
            title: c.title || "Défi sans titre",
            imageUrl: c.imageUrl || null,
            completedAt: c.completedAt || "Date inconnue",
            category: c.category || "Non catégorisé",
            description: c.description || "Pas de description",
            selectedDays: c.selectedDays || 0,
            history: c.history || [],
          }));
          setCompletedChallenges(mappedChallenges);
        } else {
          setCompletedChallenges([]);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error("Erreur lors du chargement :", error);
        Alert.alert("Erreur", "Impossible de charger les défis complétés.");
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const renderChallenge = ({ item }: { item: CompletedChallenge }) => (
    <Animated.View style={styles.challengeCard} entering={FadeIn}>
      <TouchableOpacity
        style={styles.challengeContent}
        onPress={() =>
          router.push({
            pathname: "/challenge-details/[id]",
            params: {
              id: item.id,
              title: item.title,
              category: item.category,
              description: item.description,
            },
          })
        }
      >
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.challengeImage}
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons name="image-outline" size={40} color="#b0bec5" />
          </View>
        )}
        <View style={styles.challengeDetails}>
          <Text style={styles.challengeTitle}>{item.title}</Text>
          <Text style={styles.challengeDate}>
            Complété le {new Date(item.completedAt).toLocaleDateString("fr-FR")}
          </Text>
          <Text style={styles.challengeCategory}>{item.category}</Text>
          <Text style={styles.challengeSelectedDays}>
            {item.selectedDays} jours de défi
          </Text>
        </View>
      </TouchableOpacity>
      {/* Bouton Historique en bas à gauche */}
      {item.history && item.history.length > 0 && (
        <TouchableOpacity
          style={styles.historyButton}
          onPress={() => {
            setSelectedHistory({ title: item.title, history: item.history! });
            setHistoryModalVisible(true);
          }}
        >
          <Ionicons
            name="time-outline"
            size={24}
            color={currentTheme.colors.primary}
          />
        </TouchableOpacity>
      )}
    </Animated.View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={currentTheme.colors.primary} />
        <Text style={styles.loadingText}>
          Chargement des défis complétés...
        </Text>
      </SafeAreaView>
    );
  }

  if (completedChallenges.length === 0) {
    return (
      <SafeAreaView style={styles.noChallengesContainer}>
        <LinearGradient
          colors={[
            currentTheme.colors.background,
            currentTheme.colors.cardBackground,
          ]}
          style={styles.noChallengesBackground}
        >
          <Ionicons name="checkmark-done-outline" size={60} color="#b0bec5" />
          <Text style={styles.noChallengesText}>Aucun défi complété !</Text>
          <Text style={styles.noChallengesSubtext}>
            Terminez des défis pour les voir ici.
          </Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[
          currentTheme.colors.background,
          currentTheme.colors.cardBackground,
        ]}
        style={styles.container}
      >
        <BackButton color={currentTheme.colors.primary} />
        <Text style={styles.header}>Défis Complétés</Text>
        <FlatList
          data={completedChallenges}
          renderItem={renderChallenge}
          keyExtractor={(item) => `${item.id}_${item.selectedDays}`}
          contentContainerStyle={styles.listContainer}
        />
        {selectedHistory && (
          <Modal
            visible={historyModalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setHistoryModalVisible(false)}
          >
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>
                  Historique de {selectedHistory.title}
                </Text>
                <FlatList
                  data={selectedHistory.history}
                  keyExtractor={(item, index) => `${index}`}
                  renderItem={({ item }) => (
                    <View style={styles.historyItem}>
                      <Text style={styles.historyText}>
                        Complété le{" "}
                        {new Date(item.completedAt).toLocaleDateString("fr-FR")}{" "}
                        - {item.selectedDays} jours
                      </Text>
                    </View>
                  )}
                />
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setHistoryModalVisible(false)}
                >
                  <Text style={styles.closeButtonText}>Fermer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
    backgroundColor: currentTheme.colors.background,
  },
  header: {
    fontSize: 25,
    fontFamily: "Comfortaa_700Bold",
    color: "#000000",
    marginVertical: 20,
    textAlign: "center",
    marginBottom: 30,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  challengeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: currentTheme.colors.cardBackground,
    padding: 15,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: currentTheme.colors.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4.65,
    elevation: 3,
  },
  challengeContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  challengeImage: {
    width: 70,
    height: 70,
    borderRadius: 10,
    marginRight: 15,
  },
  placeholderImage: {
    width: 70,
    height: 70,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  challengeDetails: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: 18,
    fontFamily: "Comfortaa_700Bold",
    color: "#000000",
  },
  challengeDate: {
    fontSize: 14,
    color: "#555555",
    marginBottom: 3,
    fontFamily: "Comfortaa_400Regular",
  },
  challengeCategory: {
    fontSize: 14,
    color: "#555555",
    fontFamily: "Comfortaa_400Regular",
    textTransform: "capitalize",
  },
  challengeSelectedDays: {
    fontSize: 14,
    color: "#555555",
    marginTop: 3,
    fontFamily: "Comfortaa_400Regular",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: currentTheme.colors.background,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#000000",
  },
  noChallengesContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: currentTheme.colors.background,
  },
  noChallengesBackground: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  noChallengesText: {
    fontSize: 18,
    fontFamily: "Comfortaa_700Bold",
    color: "#000000",
    marginTop: 10,
    textAlign: "center",
  },
  noChallengesSubtext: {
    fontSize: 14,
    fontFamily: "Comfortaa_400Regular",
    color: "#777777",
    textAlign: "center",
    marginTop: 5,
    maxWidth: 250,
  },
  historyButton: {
    padding: 8,
    backgroundColor: "#000000",
    borderRadius: 20,
    position: "absolute",
    bottom: 10,
    right: 10,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    width: "80%",
    maxHeight: "80%",
    borderRadius: 10,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Comfortaa_700Bold",
    marginBottom: 10,
    textAlign: "center",
  },
  historyItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  historyText: {
    fontSize: 16,
    fontFamily: "Comfortaa_400Regular",
  },
  closeButton: {
    marginTop: 15,
    backgroundColor: currentTheme.colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Comfortaa_700Bold",
  },
});
