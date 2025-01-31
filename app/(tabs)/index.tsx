import React, { useState, useEffect } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "../../constants/firebase-config";
import { Text, Button } from "react-native-paper";
import Carousel from "../../components/Carousel"; // ✅ Import du composant Carousel

interface Challenge {
  id: string;
  title: string;
  category?: string;
  description?: string;
  imageUrl?: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChallenges = async () => {
      try {
        setLoading(true);
        const querySnapshot = await getDocs(collection(db, "challenges"));

        if (!querySnapshot.empty) {
          const fetchedChallenges = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            title: doc.data()?.title || "Untitled Challenge",
            category: doc.data()?.category || "Uncategorized",
            description: doc.data()?.description || "No description available",
            imageUrl: doc.data()?.imageUrl || null,
          })) as Challenge[];

          setChallenges(fetchedChallenges);
        } else {
          setChallenges([]);
        }
      } catch (error) {
        console.error("Error fetching challenges:", error);
        setChallenges([]);
      } finally {
        setLoading(false);
      }
    };

    fetchChallenges();
  }, []);

  const handleChallengePress = (challenge: Challenge) => {
    router.push({
      pathname: "/challenge-details/[id]",
      params: {
        id: challenge.id,
        title: challenge.title,
        category: challenge.category || "Uncategorized",
        description: challenge.description || "No description available",
      },
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔥 Featured Challenges</Text>

      {loading ? (
        <ActivityIndicator animating={true} color="#FF9800" size="large" />
      ) : challenges.length > 0 ? (
        <Carousel
          challenges={challenges}
          onChallengePress={handleChallengePress}
        />
      ) : (
        <Text style={styles.noChallengesText}>No challenges available.</Text>
      )}

      <View style={styles.actionButtons}>
        <Button
          mode="contained"
          icon="trophy"
          style={styles.actionButton}
          onPress={() => router.push("/leaderboard")}
        >
          Leaderboard
        </Button>
        <Button
          mode="contained"
          icon="lightbulb"
          style={styles.actionButton}
          onPress={() => router.push("/tips")}
        >
          Tips & Tricks
        </Button>
        <Button
          mode="contained"
          icon="cog"
          style={styles.actionButton}
          onPress={() => router.push("/new-features")}
        >
          New Features
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 50,
    backgroundColor: "#1A1A2E",
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#FFF",
    textAlign: "center",
    marginBottom: 15,
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  noChallengesText: {
    fontSize: 16,
    color: "#BBB",
    textAlign: "center",
    marginTop: 20,
  },
  actionButtons: {
    flexDirection: "column",
    marginTop: 30,
  },
  actionButton: {
    marginBottom: 10,
    borderRadius: 15,
    paddingVertical: 10,
  },
});
