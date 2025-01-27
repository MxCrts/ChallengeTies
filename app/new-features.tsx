import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Image,
  Dimensions,
} from "react-native";
import {
  doc,
  collection,
  onSnapshot,
  updateDoc,
  increment,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { db, auth } from "../constants/firebase-config";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useRouter } from "expo-router";

const { width } = Dimensions.get("window");

export default function NewFeatures() {
  const [features, setFeatures] = useState<
    { id: string; title: string; votes: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [userVote, setUserVote] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const userId = auth.currentUser?.uid;
  const router = useRouter();

  useEffect(() => {
    const featuresRef = collection(db, "polls", "new-features", "features");

    // Real-time listener for features
    const unsubscribeFeatures = onSnapshot(featuresRef, (snapshot) => {
      const updatedFeatures = snapshot.docs.map((doc) => ({
        id: doc.id,
        title: doc.data().title,
        votes: doc.data().votes,
      }));
      setFeatures(updatedFeatures);
      setLoading(false);
    });

    const fetchUserVote = async () => {
      if (userId) {
        const userDoc = doc(db, "users", userId);
        const userSnapshot = await getDoc(userDoc);
        if (userSnapshot.exists()) {
          setUserVote(userSnapshot.data().votedFor || null);
        }
      }
    };

    fetchUserVote();

    // Timer for 31 January 2025 at 23:00 French time
    const targetDate = new Date("2025-01-31T22:00:00Z"); // UTC equivalent
    const updateTimer = () => {
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft("Voting has ended.");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    };

    // Set timer immediately and update every second
    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);

    return () => {
      unsubscribeFeatures();
      clearInterval(timerInterval);
    };
  }, [userId]);

  const handleVote = async (featureId: string) => {
    if (!userId) {
      Alert.alert("Login Required", "Please log in to vote.");
      return;
    }

    if (userVote) {
      Alert.alert("Vote Already Cast", "You have already voted.");
      return;
    }

    try {
      setLoading(true);

      // Increment vote count
      const featureRef = doc(
        db,
        "polls",
        "new-features",
        "features",
        featureId
      );
      await updateDoc(featureRef, {
        votes: increment(1),
      });

      // Save user vote
      const userRef = doc(db, "users", userId);
      await setDoc(userRef, { votedFor: featureId }, { merge: true });

      setUserVote(featureId);

      Alert.alert("Vote Cast", "Thank you for voting!");
    } catch (error) {
      console.error("Error casting vote:", error);
      Alert.alert("Error", "Failed to cast your vote. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>Loading features...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.elegantBackButton}
        onPress={() => router.back()}
      >
        <View style={styles.elegantBackButtonContainer}>
          <Text style={styles.elegantBackButtonArrow}>←</Text>
          <Text style={styles.elegantBackButtonText}>Back</Text>
        </View>
      </TouchableOpacity>

      {/* Header */}
      <Text style={styles.header}>Vote for the Next Feature</Text>
      <Text style={styles.description}>
        We value your feedback! Choose a feature you’d like us to prioritize.
        The feature with the most votes will be implemented next month.
      </Text>

      {/* Features */}
      <FlatList
        data={features}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.featureList}
        renderItem={({ item }) => (
          <Animated.View entering={FadeInUp} style={styles.featureCard}>
            <Text style={styles.featureTitle}>{item.title}</Text>
            <Text style={styles.featureVotes}>
              {item.votes} vote{item.votes !== 1 ? "s" : ""}
            </Text>
            <TouchableOpacity
              style={[
                styles.voteButton,
                userVote === item.id && styles.votedButton,
              ]}
              onPress={() => handleVote(item.id)}
              disabled={!!userVote}
            >
              <Text style={styles.voteButtonText}>
                {userVote === item.id ? "Voted" : "Vote"}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      />

      {/* Thank You Message */}
      {userVote && (
        <Text style={styles.thankYouText}>
          Thank you for voting! You’ve voted for:{" "}
          {features.find((feature) => feature.id === userVote)?.title}
        </Text>
      )}

      {/* Countdown Timer */}
      <View style={styles.timerContainer}>
        <Text style={styles.timerLabel}>Time Left:</Text>
        <Text style={styles.timerText}>{timeLeft}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#1C1C1E",
  },
  elegantBackButton: {
    marginBottom: 20,
    alignSelf: "flex-start",
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2C2C2E",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  elegantBackButtonContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  elegantBackButtonArrow: {
    fontSize: 20,
    color: "#007bff",
    marginRight: 5,
  },
  elegantBackButtonText: {
    fontSize: 16,
    color: "#007bff",
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    color: "#BBBBBB",
    textAlign: "center",
    marginBottom: 20,
  },
  featureList: {
    paddingBottom: 20,
  },
  featureCard: {
    backgroundColor: "#2C2C2E",
    borderRadius: 10,
    padding: 20,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  featureVotes: {
    fontSize: 14,
    color: "#AAAAAA",
    marginBottom: 10,
  },
  voteButton: {
    backgroundColor: "#007bff",
    padding: 10,
    borderRadius: 5,
  },
  votedButton: {
    backgroundColor: "#6c757d",
  },
  voteButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    textAlign: "center",
  },
  thankYouText: {
    marginTop: 20,
    fontSize: 16,
    color: "#BBBBBB",
    textAlign: "center",
  },
  timerContainer: {
    marginTop: 20,
    alignItems: "center",
    backgroundColor: "#2C2C2E",
    borderRadius: 8,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  timerLabel: {
    fontSize: 18,
    color: "#BBBBBB",
    marginBottom: 5,
  },
  timerText: {
    fontSize: 22,
    color: "#FFD700",
    fontWeight: "bold",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1C1C1E",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#BBBBBB",
  },
});
