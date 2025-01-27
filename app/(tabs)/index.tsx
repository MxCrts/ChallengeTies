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
import { auth, db } from "../../constants/firebase-config";
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
      params: {
        id: string;
        title: string;
        category: string;
        description: string;
      };
    };

export default function HomeScreen() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchChallenges = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.log("User not authenticated. Fetching challenges skipped.");
        setLoading(false);
        return;
      }

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
        {/* Logo and Hero Section */}
        <ImageBackground
          source={require("../../public/images/backgroundbase.jpg")}
          style={styles.heroSection}
          imageStyle={{
            resizeMode: "cover",
            borderBottomLeftRadius: 20,
            borderBottomRightRadius: 20,
          }}
        >
          <Image
            source={require("../../public/images/logo.png")}
            style={styles.logo}
          />
          <Text style={styles.heroTitle}>Welcome to ChallengeTies!</Text>
          <Text style={styles.heroSubtitle}>
            Take on challenges and grow every day.
          </Text>
        </ImageBackground>

        {/* Carousel Section */}
        <View style={styles.carouselContainer}>
          <Swiper
            style={styles.swiper}
            autoplay
            autoplayTimeout={3}
            loop
            showsPagination
            dotStyle={styles.swiperDot}
            activeDotStyle={styles.swiperActiveDot}
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
          <TouchableOpacity
            style={[styles.linkCard, styles.orangeWoodBackground]}
            onPress={() => handleNavigation("/new-features")}
          >
            <Text style={styles.linkText}>🚀 New Features</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.linkCard, styles.steelBlackBackground]}
            onPress={() => handleNavigation("/tips")}
          >
            <Text style={styles.linkText}>📈 Tips & Tricks</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.linkCard, styles.elegantDarkWoodBackground]}
            onPress={() => handleNavigation("/leaderboard")}
          >
            <Text style={styles.linkText}>🌍 LeaderBoard</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          © 2025 ChallengeTies. All Rights Reserved.
        </Text>
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
    paddingBottom: 80,
  },
  heroSection: {
    height: 320,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 15,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: "bold",
    color: "#FFF",
    textAlign: "center",
    marginBottom: 8,
    zIndex: 1,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
  },
  heroSubtitle: {
    fontSize: 20,
    color: "#FFF",
    textAlign: "center",
    marginBottom: 25,
    zIndex: 1,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
  },
  carouselContainer: {
    marginTop: 30,
  },
  swiper: {
    height: 240,
  },
  swiperDot: {
    backgroundColor: "#FFF",
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 3,
  },
  swiperActiveDot: {
    backgroundColor: "#FF9800",
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 3,
  },
  slide: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  challengeCard: {
    width: width * 0.8,
    borderRadius: 12,
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
    height: 160,
  },
  cardContent: {
    padding: 15,
    alignItems: "center",
  },
  challengeTitle: {
    fontSize: 18,
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
  linksSection: {
    marginTop: 40,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 20,
    textAlign: "center",
  },
  linkCard: {
    marginVertical: 10,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  orangeWoodBackground: {
    backgroundColor: "#D2691E",
  },
  steelBlackBackground: {
    backgroundColor: "#2F4F4F",
  },
  elegantDarkWoodBackground: {
    backgroundColor: "#8B4513",
  },
  linkText: {
    fontSize: 18,
    color: "#FFF",
    fontWeight: "bold",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 3,
  },
  footer: {
    alignItems: "center",
    padding: 20,
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
    fontSize: 18,
  },
});
