import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
} from "react-native";

const { width } = Dimensions.get("window");

export default function History() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Logo */}
      <View style={styles.logoContainer}>
        <Image
          source={require("../../public/images/logo.png")}
          style={styles.logo}
        />
      </View>

      {/* Story */}
      <Text style={styles.title}>Our Story</Text>
      <Text style={styles.paragraph}>
        ChallengeTies was born from a simple yet profound idea: to empower
        individuals to achieve their goals through the power of community. In a
        world filled with distractions, we envisioned a space where people could
        find motivation, connection, and accountability. What started as a dream
        has become a platform where challenges are more than tasks—they are
        opportunities for growth.
      </Text>

      {/* Specificities */}
      <Text style={styles.subtitle}>Key Features</Text>
      <Text style={styles.paragraph}>
        - **Special Challenges**: Dive into thematic challenges like "Holiday
        Cheer" or "New Year Fitness Goals."
        {"\n"}- **Progress Tracking**: Stay motivated with easy-to-read progress
        charts and stats.
        {"\n"}- **Custom Challenges**: Create challenges tailored to your unique
        aspirations.
        {"\n"}- **Community Support**: Collaborate and compete with a community
        of like-minded individuals.
      </Text>

      {/* Motivation */}
      <Text style={styles.subtitle}>Our Motivation</Text>
      <Text style={styles.paragraph}>
        At ChallengeTies, we believe that everyone has untapped potential
        waiting to be unlocked. Our mission is to provide the tools,
        inspiration, and support needed to help individuals take that first
        step—and every step thereafter—toward becoming their best selves.
        Together, we celebrate victories, overcome obstacles, and create a
        ripple effect of positive change.
      </Text>

      {/* The Logo */}
      <Text style={styles.subtitle}>The Logo</Text>
      <Text style={styles.paragraph}>
        The ChallengeTies logo embodies unity, growth, and positivity. The
        dynamic shapes represent the interconnected paths we take toward our
        goals, while the vibrant colors inspire energy and action. It is a
        symbol of the journey, the struggle, and the triumphs we share.
      </Text>

      {/* Vision */}
      <Text style={styles.subtitle}>Our Vision</Text>
      <Text style={styles.paragraph}>
        Our vision is to be more than just a platform—we aim to be a movement. A
        movement where challenges transform lives, where people from all walks
        of life can unite, inspire, and uplift one another. Together, we are
        stronger, and together, we achieve more.
      </Text>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Thank you for being a part of our journey. Here’s to your success and
          the challenges that make us grow.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1C1C1E",
  },
  contentContainer: {
    padding: 20,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  logo: {
    width: width * 0.4,
    height: width * 0.4,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#6A11CB",
    marginTop: 20,
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    color: "#E0E0E0",
    marginBottom: 15,
    textAlign: "justify",
  },
  footer: {
    marginTop: 20,
    padding: 10,
    borderTopWidth: 1,
    borderColor: "#6A11CB",
  },
  footerText: {
    fontSize: 14,
    color: "#aaa",
    textAlign: "center",
  },
});
