import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  ImageBackground,
} from "react-native";
import { useRouter } from "expo-router";
import { Audio } from "expo-av";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../constants/firebase-config";
import Swiper from "react-native-swiper";

const { width } = Dimensions.get("window");

interface Challenge {
  id: string;
  title: string;
  category?: string;
  description?: string;
  imageUrl?: string;
}

type NavigationPath =
  | "/new-features"
  | "/tips"
  | "/explore"
  | "/leaderboard"
  | {
    pathname: "/challenge-details/[id]";
    params: { id: string; title: string; category: string; description: string };
  };

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
          imageUrl: doc.data().imageUrl || null,
        })) as Challenge[];

        setChallenges(fetchedChallenges);
      } catch (error) {
        console.error("Error fetching challenges:", error);
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

  const handleNavigation = (path: NavigationPath) => {
    if (typeof path === "string") {
      router.push(path);
    } else {
      router.push(path);
    }
  };

  const renderChallenge = (challenge: Challenge) => (
    <TouchableOpacity
      key={challenge.id}
      style={styles.challengeCard}
      onPress={() =>
        handleNavigation({
          pathname: "/challenge-details/[id]",
          params: {
            id: challenge.id,
            title: challenge.title,
            category: challenge.category || "Uncategorized",
            description: challenge.description || "No description available",
          },
        })
      }
    >
      <Image
        source={
          challenge.imageUrl
            ? { uri: challenge.imageUrl }
            : require("../../public/images/default-challenge.webp")
        }
        style={styles.challengeImage}
      />
      <View style={styles.cardContent}>
        <Text style={styles.challengeTitle}>{challenge.title}</Text>
        <Text style={styles.challengeCategory}>{challenge.category}</Text>
      </View>
    </TouchableOpacity>
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Hero Section */}
        <ImageBackground
          source={require("../../public/images/backgroundbase.jpg")}
          style={styles.heroSection}
          imageStyle={{ resizeMode: "cover", borderBottomLeftRadius: 20, borderBottomRightRadius: 20 }}
        >
          <View style={styles.heroOverlay} />
          <Text style={styles.heroTitle}>Welcome to ChallengeTies!</Text>
          <Text style={styles.heroSubtitle}>Take on challenges and grow every day.</Text>
          <TouchableOpacity
            style={styles.heroButton}
            onPress={() => handleNavigation("/explore")}
          >
            <Text style={styles.heroButtonText}>Explore Challenges</Text>
          </TouchableOpacity>
        </ImageBackground>

        {/* Carousel Section */}
        <View style={styles.carouselContainer}>
          <Text style={styles.sectionHeader}>Trending Challenges</Text>
          <Swiper
            style={styles.swiper}
            autoplay
            autoplayTimeout={3}
            loop
            showsPagination={false}
          >
            {challenges.map((challenge) => (
              <View key={challenge.id} style={styles.slide}>
                {renderChallenge(challenge)}
              </View>
            ))}
          </Swiper>
        </View>

        {/* Links Section */}
        <View style={styles.linksSection}>
          <Text style={styles.sectionHeader}>Discover More</Text>
          <View style={styles.linksContainer}>
            {["/new-features", "/tips"].map((path) => (
              <ImageBackground
                key={path}
                source={require("../../public/images/backgroundbase.jpg")}
                style={styles.linkCardBackground}
                imageStyle={{ borderRadius: 15 }}
              >
                <TouchableOpacity
                  style={styles.linkCard}
                  onPress={() => handleNavigation(path as NavigationPath)}
                >
                  <Text style={styles.linkText}>
                    {path === "/new-features"
                      ? "🚀 New Features"
                      : "📈 Tips & Tricks"}
                  </Text>
                </TouchableOpacity>
              </ImageBackground>
            ))}
          </View>
          <ImageBackground
            source={require("../../public/images/backgroundbase.jpg")}
            style={styles.centeredLinkCardBackground}
            imageStyle={{ borderRadius: 15 }}
          >
            <TouchableOpacity
              style={styles.linkCard}
              onPress={() => handleNavigation("/leaderboard")}
            >
              <Text style={styles.linkText}>🌍 LeaderBoard</Text>
            </TouchableOpacity>
          </ImageBackground>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2025 ChallengeTies. All Rights Reserved.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  scrollContent: {
    paddingBottom: 60,
  },
  heroSection: {
    height: 220,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#FFF",
    textAlign: "center",
    marginBottom: 8,
    zIndex: 1,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 3,
  },
  heroSubtitle: {
    fontSize: 16,
    color: "#FFF",
    textAlign: "center",
    marginBottom: 15,
    zIndex: 1,
  },
  heroButton: {
    backgroundColor: "#FFF",
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 8,
    zIndex: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  heroButtonText: {
    fontSize: 16,
    color: "#FF9800",
    fontWeight: "bold",
  },
  carouselContainer: {
    marginTop: 20,
  },
  sectionHeader: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginHorizontal: 20,
    marginBottom: 10,
  },
  linksSection: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  linksContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  linkCardBackground: {
    width: "48%", // Two buttons per row
    aspectRatio: 1.5, // Maintain proper proportions
    borderRadius: 15,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  centeredLinkCardBackground: {
    width: "80%", // Centered button
    aspectRatio: 1.5, // Maintain proportion
    borderRadius: 15,
    overflow: "hidden",
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
    marginTop: 15,
  },
  linkCard: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  linkText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 3,
  },
  footer: {
    alignItems: "center",
    padding: 15,
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
  swiper: {
    height: 240,
  },
  slide: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  challengeCard: {
    width: width * 0.8,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#FFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  challengeImage: {
    width: "100%",
    height: 150,
  },
  cardContent: {
    padding: 10,
    alignItems: "center",
  },
  challengeTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 5,
  },
  challengeCategory: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
  },

});
