import React, { useEffect } from "react";
import { View, Text, StyleSheet, Image, Dimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppIntroSlider from "react-native-app-intro-slider";
import { useRouter } from "expo-router";

const { width } = Dimensions.get("window");

const slides = [
  {
    key: "1",
    title: "Welcome to ChallengeTies!",
    text: "Your journey to self-improvement starts here. Join a community dedicated to achieving greatness.",
    image: require("../assets/images/welcome.png"), // Replace with your assets
    backgroundColor: "#2F80ED",
  },
  {
    key: "2",
    title: "Take Inspiring Challenges",
    text: "Choose from hundreds of challenges designed to help you grow, learn, and achieve your goals.",
    image: require("../assets/images/challenges.png"),
    backgroundColor: "#FF6F61",
  },
  {
    key: "3",
    title: "Create Your Own Challenges",
    text: "Unleash your creativity by crafting personalized challenges and sharing them with others.",
    image: require("../assets/images/create.png"),
    backgroundColor: "#8BC34A",
  },
  {
    key: "4",
    title: "Track Your Progress",
    text: "Stay consistent with detailed progress tracking and motivational stats.",
    image: require("../assets/images/progress.png"),
    backgroundColor: "#FFC107",
  },
  {
    key: "5",
    title: "Join the Community",
    text: "Share experiences, connect with like-minded individuals, and motivate each other.",
    image: require("../assets/images/community.webp"),
    backgroundColor: "#6A11CB",
  },
  {
    key: "6",
    title: "Ad-Free Experience with Premium",
    text: "Enjoy the app ad-free with premium for only €2.99/month and unlock exclusive features.",
    image: require("../assets/images/premium.png"),
    backgroundColor: "#D35400",
  },
];

export default function Onboarding() {
  const router = useRouter();

  const onDone = async () => {
    await AsyncStorage.setItem("hasSeenOnboarding", "true");
    router.replace("../index"); // Redirect to home
  };

  const renderItem = ({ item }: { item: (typeof slides)[0] }) => (
    <View style={[styles.slide, { backgroundColor: item.backgroundColor }]}>
      <Image source={item.image} style={styles.image} />
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.text}>{item.text}</Text>
    </View>
  );

  return (
    <AppIntroSlider
      data={slides}
      renderItem={renderItem}
      onDone={onDone}
      renderNextButton={() => <Text style={styles.buttonText}>Next</Text>}
      renderDoneButton={() => (
        <Text style={styles.buttonText}>Get Started</Text>
      )}
    />
  );
}

const styles = StyleSheet.create({
  slide: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  image: {
    width: width * 0.7,
    height: width * 0.7,
    resizeMode: "contain",
    marginBottom: 20,
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
    paddingHorizontal: 20,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
