import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Audio } from "expo-av";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../constants/firebase-config";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp } from "react-native-reanimated";

const { width } = Dimensions.get("window");

interface Challenge {
  id: string;
  title: string;
  category?: string;
  totalDays?: number;
  description?: string;
}

export default function HomeScreen() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchChallenges = async () => {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, "challenges"));
        const fetchedChallenges = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          title: doc.data().title || "Untitled Challenge",
          category: doc.data().category || "Uncategorized",
          description: doc.data().description || "No description available",
        })) as Challenge[];

        setChallenges(fetchedChallenges.slice(0, 3));
      } catch (error) {
        console.error("Error fetching challenges:", error);
        Alert.alert("Error", "Failed to fetch challenges. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchChallenges();
  }, []);

  useEffect(() => {
    const playMusic = async () => {
      const { sound } = await Audio.Sound.createAsync(
        require("../../assets/music/background-music.mp3"),
        { shouldPlay: true, isLooping: true }
      );
      setSound(sound);
      await sound.playAsync();
    };

    if (musicEnabled) {
      playMusic();
    } else {
      sound?.stopAsync();
    }

    return () => {
      sound?.unloadAsync();
    };
  }, [musicEnabled]);

  const renderChallenge = ({ item }: { item: Challenge }) => (
    <Animated.View entering={FadeInUp} style={styles.challengeCard}>
      <View style={styles.cardImageContainer}>
        <Image
          source={require("../../assets/images/challenge-placeholder.png")} // Replace with actual image
          style={styles.cardImage}
          resizeMode="cover"
        />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.challengeTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.challengeCategory}>{item.category}</Text>
      </View>
      <TouchableOpacity
        style={styles.challengeButton}
        onPress={() =>
          router.push({
            pathname: "/challenge-details/[id]",
            params: {
              id: item.id,
              title: item.title,
              category: item.category || "Uncategorized",
              description: item.description || "No description available",
            },
          })
        }
      >
        <Ionicons name="arrow-forward" size={20} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF9800" />
        <Text style={styles.loadingText}>Loading challenges...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Image
          source={require("../../assets/images/logo.png")}
          style={styles.logo}
        />
        <TouchableOpacity
          style={styles.musicToggle}
          onPress={() => setMusicEnabled(!musicEnabled)}
        >
          <Ionicons
            name={musicEnabled ? "volume-high-outline" : "volume-mute-outline"}
            size={24}
            color="#FF9800"
          />
        </TouchableOpacity>
      </View>

      <Image
        source={require("../../assets/images/christmas-banner.png")}
        style={styles.banner}
        resizeMode="cover"
      />

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionHeader}>Explore Special Topics</Text>
        <FlatList
          data={[
            {
              id: "1",
              title: "🎄 Special Challenges for the Holidays!",
              action: () =>
                router.push({
                  pathname: "/explore",
                  params: { filter: "Special" },
                }),
            },
            {
              id: "2",
              title: "🚀 New Features Coming Soon!",
              action: () => router.push("/new-features"),
            },
            {
              id: "3",
              title: "📈 Achieve Your Goals Faster!",
              action: () => router.push("/tips"),
            },
          ]}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.article} onPress={item.action}>
              <Text style={styles.articleText}>{item.title}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionHeader}>Recommended Challenges</Text>
        <FlatList
          data={challenges}
          renderItem={renderChallenge}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.challengeList}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          © 2024 ChallengeTies. All Rights Reserved.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F9F9",
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  logo: {
    width: 120,
    height: 120,
  },
  banner: {
    width: width - 40,
    height: 150,
    alignSelf: "center",
    marginBottom: 10,
    borderRadius: 10,
    overflow: "hidden",
  },
  articlesSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FF9800",
    marginBottom: 10,
  },
  article: {
    backgroundColor: "#FFF3E0",
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  articleText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "500",
  },
  challengesSection: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  challengeList: {
    paddingBottom: 10,
  },
  challengeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    marginRight: 16,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: 260,
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  cardImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: "hidden",
    marginRight: 15,
  },
  cardContent: {
    flex: 1,
    marginRight: 10,
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  challengeTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#444",
    marginBottom: 5,
  },
  sectionContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  challengeCategory: {
    fontSize: 14,
    color: "#888",
  },
  challengeButton: {
    backgroundColor: "#FF9800",
    padding: 8,
    borderRadius: 8,
  },
  footer: {
    alignItems: "center",
    padding: 10,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderColor: "#E0E0E0",
  },
  footerText: {
    fontSize: 14,
    color: "#888",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#888",
    fontSize: 16,
  },
  musicToggle: {
    position: "absolute",
    top: 30,
    right: 20,
    zIndex: 1,
  },
});
