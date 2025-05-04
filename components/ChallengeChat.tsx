import React, { useState, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Dimensions,
  Image,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { auth } from "../constants/firebase-config";
import { useChat } from "../context/ChatContext";
import designSystem from "../theme/designSystem";
import { useTranslation } from "react-i18next";

const { width } = Dimensions.get("window");
const { lightTheme } = designSystem;
const currentTheme = lightTheme;

export default function ChallengeChat() {
  const { t } = useTranslation();
  const route = useRoute();
  const navigation = useNavigation();
  const { challengeId, challengeTitle } = route.params as {
    challengeId: string;
    challengeTitle: string;
  };

  const { messages, sendMessage } = useChat(challengeId);
  const [newMessage, setNewMessage] = useState("");

  // Utilisation des couleurs du design system pour le header (orange dans le thème light)
  const headerGradient: readonly [string, string] = [
    currentTheme.colors.primary,
    currentTheme.colors.secondary,
  ] as const;

  const flatListRef = useRef<FlatList>(null);

  const handleSend = async () => {
    if (newMessage.trim().length === 0) return;
    try {
      await sendMessage(challengeId, newMessage);
      setNewMessage("");
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (error) {
      console.error(t("chat.errorSending"), error);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMyMessage = item.userId === auth.currentUser?.uid;
    return (
      <View
        style={[
          styles.messageRow,
          isMyMessage ? styles.myMessageRow : styles.otherMessageRow,
        ]}
      >
        {!isMyMessage && (
          <View style={styles.avatarContainer}>
            <Ionicons
              name="person-circle-outline"
              size={34}
              color={currentTheme.colors.primary}
            />
          </View>
        )}
        <View
          style={[
            styles.messageBubble,
            isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
          ]}
        >
          {!isMyMessage && (
            <Text style={[styles.username, styles.otherUsername]}>
              {item.username}
            </Text>
          )}
          <Text style={styles.messageText}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header avec gradient */}
      <LinearGradient colors={headerGradient} style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityLabel={t("chat.goBack")}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("chat.title", { title: challengeTitle })}</Text>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 120 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.messageList, { paddingBottom: 80 }]}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          accessibilityLabel={t("chat.messagesList")}
        />
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder={t("chat.placeholder")}
            placeholderTextColor="#aaa"
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: currentTheme.colors.primary },
            ]}
            onPress={handleSend}
            accessibilityLabel={t("chat.sendButton")}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  backButton: {
    marginRight: 10,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 50,
    fontFamily: "Comfortaa_700Bold",
  },
  chatContainer: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  messageRow: {
    flexDirection: "row",
    marginVertical: 5,
    alignItems: "flex-start",
  },
  myMessageRow: {
    justifyContent: "flex-end",
  },
  otherMessageRow: {
    justifyContent: "flex-start",
  },
  avatarContainer: {
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: "75%",
    borderRadius: 20,
    padding: 10,
  },
  myMessageBubble: {
    backgroundColor: "#ed8f03", // Utilise l'orange du thème light
    marginLeft: "25%",
  },
  otherMessageBubble: {
    backgroundColor: "#e9ecef",
    marginRight: "25%",
  },
  username: {
    fontFamily: "Comfortaa_700Bold",
    marginBottom: 3,
  },
  otherUsername: {
    color: "#ed8f03",
  },
  messageText: {
    fontSize: 15,
    fontFamily: "Comfortaa_400Regular",
    color: "#333",
  },
  inputContainer: {
    flexDirection: "row",
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  input: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 20,
    paddingHorizontal: 10,
    marginRight: 10,
    fontFamily: "Comfortaa_400Regular",
    fontSize: 16,
  },
  sendButton: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
  },
});
