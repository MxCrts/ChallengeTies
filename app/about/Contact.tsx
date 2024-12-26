import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Linking,
  TouchableOpacity,
} from "react-native";

export default function Contact() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Contact Us</Text>

      <Text style={styles.paragraph}>
        We value your feedback and are here to assist you. Feel free to contact
        us using the information below:
      </Text>

      <Text style={styles.sectionTitle}>Email</Text>
      <TouchableOpacity
        onPress={() => Linking.openURL("mailto:support@challengeties.com")}
      >
        <Text style={styles.link}>support@challengeties.com</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Phone</Text>
      <TouchableOpacity onPress={() => Linking.openURL("tel:+123456789")}>
        <Text style={styles.link}>+1 234 567 89</Text>
      </TouchableOpacity>
    </View>
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
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    color: "#E0E0E0",
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#6A11CB",
    marginBottom: 10,
  },
  link: {
    fontSize: 16,
    color: "#1E90FF",
    textDecorationLine: "underline",
    marginBottom: 10,
  },
});
