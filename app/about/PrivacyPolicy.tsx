import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

export default function PrivacyPolicy() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Privacy Policy</Text>

      <Text style={styles.sectionTitle}>Introduction</Text>
      <Text style={styles.paragraph}>
        ChallengeTies values your privacy. This policy explains how we collect,
        use, and protect your data. In compliance with French laws, including
        the GDPR, we ensure the confidentiality of your information.
      </Text>

      <Text style={styles.sectionTitle}>Data Collection</Text>
      <Text style={styles.paragraph}>
        We collect personal data such as your email address, name, and profile
        details to enhance your experience. All data is securely stored and used
        solely for application functionality and communication purposes.
      </Text>

      <Text style={styles.sectionTitle}>Data Usage</Text>
      <Text style={styles.paragraph}>
        Your data is used to:
        {"\n"}- Personalize challenges and user recommendations.
        {"\n"}- Enable communication with our support team.
        {"\n"}- Improve application features based on user feedback.
      </Text>

      <Text style={styles.sectionTitle}>User Rights</Text>
      <Text style={styles.paragraph}>
        As a user, you have the right to:
        {"\n"}- Access your personal data.
        {"\n"}- Request correction or deletion of your information.
        {"\n"}- Withdraw consent for data usage.
      </Text>

      <Text style={styles.sectionTitle}>Contact Us</Text>
      <Text style={styles.paragraph}>
        For any inquiries about your data or this policy, please reach out to
        our support team at privacy@challengeties.com.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#1C1C1E",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#6A11CB",
    marginTop: 15,
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    color: "#E0E0E0",
    marginBottom: 15,
  },
});
