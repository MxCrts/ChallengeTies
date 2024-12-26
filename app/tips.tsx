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

const { width } = Dimensions.get("window");

export default function Tips() {
  const tips = [
    {
      id: "1",
      title: "Set SMART Goals",
      description:
        "Specific, Measurable, Achievable, Relevant, and Time-Bound goals are essential for success.",
      icon: "checkmark-circle-outline",
    },
    {
      id: "2",
      title: "Track Your Progress",
      description:
        "Keep a journal or use apps like ChallengeTies to monitor your progress.",
      icon: "analytics-outline",
    },
    {
      id: "3",
      title: "Stay Consistent",
      description:
        "Dedicate a fixed time every day for your goal, and never skip it.",
      icon: "time-outline",
    },
    {
      id: "4",
      title: "Find Motivation",
      description:
        "Join communities, read inspiring stories, or find a partner to keep you motivated.",
      icon: "people-outline",
    },
    {
      id: "5",
      title: "Reward Yourself",
      description:
        "Celebrate small wins to stay motivated and feel accomplished.",
      icon: "gift-outline",
    },
  ];

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <Image
          source={require("../assets/images/logo.png")}
          style={styles.logo}
        />
        <Text style={styles.headerText}>Achieve Your Goals Faster</Text>
        <Text style={styles.subHeaderText}>
          Discover practical tips to stay motivated and succeed.
        </Text>
      </View>

      {/* Tips Section */}
      <Animated.View entering={FadeInUp} style={styles.tipsContainer}>
        {tips.map((tip) => (
          <View key={tip.id} style={styles.tipCard}>
            <Ionicons
              name={tip.icon as keyof typeof Ionicons.glyphMap}
              size={32}
              color="#007bff"
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
          Need more guidance?{" "}
          <Text
            style={styles.footerLink}
            onPress={() => Linking.openURL("mailto:support@challengeme.com")}
          >
            Contact Us
          </Text>
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1C1C1E",
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 10,
  },
  headerText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  subHeaderText: {
    fontSize: 16,
    color: "#BBBBBB",
    textAlign: "center",
    marginTop: 10,
  },
  tipsContainer: {
    marginVertical: 20,
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2C2C2E",
    borderRadius: 10,
    padding: 16,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  tipIcon: {
    marginRight: 16,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 5,
  },
  tipDescription: {
    fontSize: 14,
    color: "#BBBBBB",
  },
  footer: {
    marginTop: 20,
    alignItems: "center",
  },
  footerText: {
    fontSize: 14,
    color: "#AAAAAA",
    textAlign: "center",
  },
  footerLink: {
    color: "#007bff",
    fontWeight: "bold",
  },
});
