import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { db, auth } from "../../constants/firebase-config";
import { doc, updateDoc, onSnapshot, getDoc } from "firebase/firestore";
import Animated, { FadeIn, Layout } from "react-native-reanimated";

export default function FocusScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentChallenges, setCurrentChallenges] = useState<any[]>([]);
  const [completedTodayChallenges, setCompletedTodayChallenges] = useState<
    any[]
  >([]);
  const [trophies, setTrophies] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState("");

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const userRef = doc(db, "users", userId);

    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        setTrophies(userData.trophies || 0);
        setCurrentChallenges(userData?.CurrentChallenges || []);
        setCompletedTodayChallenges(userData?.CompletedTodayChallenges || []);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(23, 59, 59, 999);
      const diff = midnight.getTime() - now.getTime();

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeRemaining(`${hours}h ${minutes}m left`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleCheckIn = async (challenge: any) => {
    if (!challenge || !challenge.id) return;

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) return;

      const userData = userSnap.data();
      const now = new Date().toDateString();

      let updatedCurrentChallenges = [];
      let updatedCompletedTodayChallenges = [
        ...(userData.CompletedTodayChallenges || []),
      ];

      for (const c of userData.CurrentChallenges || []) {
        if (c.id === challenge.id) {
          if (c.completedDays + 1 >= c.selectedDays) {
            continue; // 🔄 Si terminé, ne pas le remettre dans CompletedToday
          }
          updatedCompletedTodayChallenges.push({
            ...c,
            completedDays: c.completedDays + 1,
            lastMarkedDate: now,
          });
        } else {
          updatedCurrentChallenges.push(c);
        }
      }

      await updateDoc(userRef, {
        CurrentChallenges: updatedCurrentChallenges,
        CompletedTodayChallenges: updatedCompletedTodayChallenges,
      });

      setCurrentChallenges(updatedCurrentChallenges);
      setCompletedTodayChallenges(updatedCompletedTodayChallenges);

      Alert.alert("✅ Challenge complété !", "Tu gères 🔥");
    } catch (error) {
      console.error("Erreur lors du check-in :", error);
      Alert.alert("Erreur", "Impossible de valider le challenge.");
    }
  };

  const resetCompletedToday = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        CompletedTodayChallenges: [],
      });

      setCompletedTodayChallenges([]);
      console.log("✅ Reset quotidien effectué !");
    } catch (error) {
      console.error("Erreur lors du reset :", error);
    }
  };

  useEffect(() => {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);

    const timeUntilMidnight = midnight.getTime() - now.getTime();

    const timeout = setTimeout(() => {
      resetCompletedToday();
    }, timeUntilMidnight);

    return () => clearTimeout(timeout);
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1ABC00" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <LinearGradient colors={["#FFFFFF", "#E3F4CA"]} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.trophyContainer}>
          <Ionicons name="trophy-outline" size={28} color="#F6B70E" />
          <Text style={styles.trophyCount}>{trophies}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/create-challenge")}>
          <Ionicons name="add-circle-outline" size={32} color="#1ABC00" />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>📋 Challenges en cours</Text>
      <FlatList
        data={currentChallenges}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Animated.View entering={FadeIn} layout={Layout.springify()}>
            <TouchableOpacity
              style={styles.challengeItem}
              onPress={() => handleCheckIn(item)}
            >
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.challengeIcon}
              />
              <Text style={styles.challengeItemText}>
                {item.title} - Jour {item.completedDays + 1}/{item.selectedDays}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      />

      <Text style={styles.sectionTitle}>
        ✅ Challenges complétés aujourd’hui
      </Text>
      <FlatList
        data={completedTodayChallenges}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.completedChallengeItem}>
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.challengeIcon}
            />
            <Text style={styles.challengeItemText}>
              {item.title} - Jour {item.completedDays}/{item.selectedDays}
            </Text>
          </View>
        )}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  trophyContainer: { flexDirection: "row", alignItems: "center" },
  trophyCount: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#F6B70E",
    marginLeft: 5,
  },
  sectionTitle: { fontSize: 18, fontWeight: "bold", marginTop: 20 },
  challengeItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#FFF",
    borderRadius: 10,
    marginVertical: 5,
  },
  challengeIcon: { width: 40, height: 40, borderRadius: 10, marginRight: 10 },
  challengeItemText: { fontSize: 16, fontWeight: "bold" },
  completedChallengeItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#D4EDDA",
    borderRadius: 10,
    marginVertical: 5,
  },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { fontSize: 16, color: "#FACC15" },
});
