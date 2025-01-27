import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  Dimensions,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

const { width } = Dimensions.get("window");

export default function Tips() {
  const router = useRouter();
  const tips = [
    {
      id: "1",
      title: "Set SMART Goals",
      description:
        "Specific, Measurable, Achievable, Relevant, and Time-Bound objectives keep you focused and disciplined.",
      icon: "checkmark-circle-outline",
    },
    {
      id: "2",
      title: "Embrace Consistency",
      description:
        "Dedicate a fixed time daily for your goal. Small daily actions lead to huge results over time.",
      icon: "time-outline",
    },
    {
      id: "3",
      title: "Track Everything",
      description:
        "Use ChallengeTies’ daily marking and stats to monitor progress, earn trophies, and maintain momentum.",
      icon: "analytics-outline",
    },
    {
      id: "4",
      title: "Find Community Support",
      description:
        "Connect with like-minded individuals, invite friends, share experiences, and keep each other motivated.",
      icon: "people-outline",
    },
    {
      id: "5",
      title: "Reward Yourself Often",
      description:
        "Celebrate every milestone—short streaks, bigger achievements, new trophies—to fuel long-term motivation.",
      icon: "gift-outline",
    },
    {
      id: "6",
      title: "Mix It Up",
      description:
        "Avoid boredom by trying new challenges, exploring different categories, and spicing up your goals.",
      icon: "flask-outline",
    },
    {
      id: "7",
      title: "Invite a Friend",
      description:
        "Challenges get easier (and more fun) with a friend. Send invites to tackle goals together!",
      icon: "person-add-outline",
    },
    {
      id: "8",
      title: "Visualize Success",
      description:
        "Picture your end result—visual cues and daily reminders keep your focus razor-sharp.",
      icon: "eye-outline",
    },
    {
      id: "9",
      title: "Stay Positive",
      description:
        "Even if you slip, remember each day is a fresh start. Learn from mistakes and keep pushing forward.",
      icon: "sunny-outline",
    },
  ];

  return (
    <LinearGradient
      colors={["#1C1C1E", "#2C2C2E"]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.8, y: 1 }}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          style={styles.elegantBackButton}
          onPress={() => router.back()}
        >
          <View style={styles.elegantBackButtonContainer}>
            <Ionicons name="arrow-back-outline" size={24} color="#FFD700" />
            <Text style={styles.elegantBackButtonText}>Back</Text>
          </View>
        </TouchableOpacity>
        {/* Header */}
        <View style={styles.headerContainer}>
          <Image
            source={require("../public/images/logo.png")}
            style={styles.logo}
          />
          <Text style={styles.headerText}>Empower Your Journey</Text>
          <Text style={styles.subHeaderText}>
            Practical tips to stay inspired, achieve goals, and earn trophies!
          </Text>
        </View>

        {/* Tips Section */}
        <Animated.View entering={FadeInUp} style={styles.tipsContainer}>
          {tips.map((tip) => (
            <View key={tip.id} style={styles.tipCard}>
              <Ionicons
                name={tip.icon as keyof typeof Ionicons.glyphMap}
                size={32}
                color="#FFD700"
                style={styles.tipIcon}
              />
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Text style={styles.tipDescription}>{tip.description}</Text>
              </View>
            </View>
          ))}
        </Animated.View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            More questions or need tailored guidance?{" "}
            <Text
              style={styles.footerLink}
              onPress={() => Linking.openURL("mailto:support@challengeme.com")}
            >
              Contact Us
            </Text>
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 10,
    resizeMode: "contain",
  },
  headerText: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 5,
  },
  subHeaderText: {
    fontSize: 15,
    color: "#BBBBBB",
    textAlign: "center",
    marginHorizontal: 10,
    lineHeight: 20,
  },
  tipsContainer: {
    marginVertical: 10,
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#2C2C2E",
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  tipIcon: {
    marginRight: 14,
    marginTop: 2,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFD700",
    marginBottom: 4,
  },
  tipDescription: {
    fontSize: 14,
    color: "#DDDDDD",
    lineHeight: 20,
  },
  footer: {
    marginTop: 25,
    alignItems: "center",
  },
  footerText: {
    fontSize: 14,
    color: "#AAAAAA",
    textAlign: "center",
  },
  footerLink: {
    color: "#FFD700",
    fontWeight: "bold",
  },
  elegantBackButton: {
    marginBottom: 20,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2C2C2E",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  elegantBackButtonContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  elegantBackButtonText: {
    fontSize: 16,
    color: "#FFD700",
    marginLeft: 8,
    fontWeight: "bold",
  },
});
