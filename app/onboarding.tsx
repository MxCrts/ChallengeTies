import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  SafeAreaView,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppIntroSlider from "react-native-app-intro-slider";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

const slides = [
  {
    key: "1",
    title: "Welcome to ChallengeTies!",
    text: "Your journey to self-improvement starts now. Join a vibrant community striving for greatness.",
    image: require("../assets/images/welcome.png"),
    colors: ["#00c6ff", "#0072ff"] as const,
  },
  {
    key: "2",
    title: "Take Inspiring Challenges",
    text: "Choose from uplifting challenges and let every day be an achievement in the making.",
    image: require("../assets/images/challenges.png"),
    colors: ["#ff9966", "#ff5e62"] as const,
  },
  {
    key: "3",
    title: "Create Your Own",
    text: "Design personal challenges, share them, and motivate others to go beyond their limits.",
    image: require("../assets/images/create.png"),
    colors: ["#11998e", "#38ef7d"] as const,
  },
  {
    key: "4",
    title: "Track Your Progress & Earn Trophies",
    text: "Stay consistent with daily tracking. Unlock trophies and achievements for every milestone.",
    image: require("../assets/images/progress.png"),
    colors: ["#f7971e", "#FFD200"] as const,
  },
  {
    key: "5",
    title: "Invite Friends & Grow Together",
    text: "Connect with like-minded people, share experiences, and push each other to new heights.",
    image: require("../assets/images/community.webp"),
    colors: ["#8E2DE2", "#4A00E0"] as const,
  },
  {
    key: "6",
    title: "Celebrate Consistency",
    text: "Conquer 3-day streaks, 30-day finishes, big leaps—every step has a reward. Join the top rank!",
    image: require("../assets/images/streaks.webp"),
    colors: ["#FF512F", "#DD2476"] as const,
  },
  {
    key: "7",
    title: "Unlock Premium for More",
    text: "Go ad-free, invite unlimited friends, and access exclusive features for just €2.99/month.",
    image: require("../assets/images/premium.png"),
    colors: ["#D1913C", "#FFD194"] as const,
  },
  {
    key: "8",
    title: "Ready to Begin?",
    text: "Self-discovery, community support, and daily growth await. Start your ChallengeTies journey now!",
    image: require("../assets/images/wow.webp"),
    colors: ["#52c234", "#061700"] as const,
  },
];

export default function Onboarding() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const onDone = async () => {
    try {
      await AsyncStorage.setItem("hasSeenOnboarding", "true");
      router.replace("/"); // Redirect to the main page
    } catch (error) {
      console.error("❌ Erreur lors de l'enregistrement d'Onboarding :", error);
    }
  };

  const renderItem = ({ item }: { item: (typeof slides)[number] }) => {
    return (
      <LinearGradient
        colors={item.colors}
        style={styles.slide}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView style={styles.slideContent}>
          <Animated.Image
            source={item.image}
            style={[
              styles.image,
              { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
            ]}
          />
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.text}>{item.text}</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  };

  const renderNextButton = () => (
    <View style={styles.buttonCircle}>
      <Ionicons name="arrow-forward-outline" color="#fff" size={22} />
    </View>
  );

  const renderDoneButton = () => (
    <View style={styles.buttonCircle}>
      <Ionicons name="checkmark-done-outline" color="#fff" size={22} />
    </View>
  );

  return (
    <AppIntroSlider
      data={slides}
      renderItem={renderItem}
      onDone={onDone}
      renderNextButton={renderNextButton}
      renderDoneButton={renderDoneButton}
      dotStyle={styles.dotStyle}
      activeDotStyle={styles.activeDotStyle}
    />
  );
}

const styles = StyleSheet.create({
  slide: {
    flex: 1,
  },
  slideContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 25,
  },
  image: {
    width: width * 0.6,
    height: width * 0.6,
    resizeMode: "contain",
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 10,
  },
  text: {
    fontSize: 16,
    color: "#fff",
    textAlign: "center",
    lineHeight: 22,
  },
  buttonCircle: {
    width: 44,
    height: 44,
    backgroundColor: "rgba(255, 255, 255, .3)",
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  dotStyle: {
    backgroundColor: "rgba(255, 255, 255, 0.4)",
  },
  activeDotStyle: {
    backgroundColor: "#fff",
  },
});
