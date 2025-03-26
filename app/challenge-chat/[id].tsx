import React, { useState, useRef, useEffect } from "react";
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
import { useLocalSearchParams, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { auth } from "../../constants/firebase-config";
import { useChat } from "../../context/ChatContext";
import { useTheme } from "../../context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import designSystem from "../../theme/designSystem";

const { width } = Dimensions.get("window");

export default function ChallengeChat() {
  const { id: challengeId, title: challengeTitle } = useLocalSearchParams();
  const navigation = useNavigation();
  const { messages, sendMessage } = useChat(
    Array.isArray(challengeId) ? challengeId[0] : challengeId
  );
  const [newMessage, setNewMessage] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const { theme } = useTheme();
  const currentTheme =
    theme === "dark" ? designSystem.darkTheme : designSystem.lightTheme;
  const headerGradient: readonly [string, string] = [
    currentTheme.colors.primary,
    currentTheme.colors.secondary,
  ] as const;

  // Utilisation du hook pour récupérer les insets (notamment le bottom)
  const insets = useSafeAreaInsets();

  const handleSend = async () => {
    if (newMessage.trim().length === 0) return;
    try {
      await sendMessage(
        Array.isArray(challengeId) ? challengeId[0] : challengeId,
        newMessage
      );
      setNewMessage("");
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

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
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {challengeTitle || "Challenge Chat"}
        </Text>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        // Sur Android, on peut définir un offset pour éviter que le clavier ne masque la zone d'envoi
        keyboardVerticalOffset={Platform.OS === "ios" ? 120 : 80}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />
        {/* Zone d'envoi positionnée absolument */}
        <View
          style={[styles.inputWrapper, { paddingBottom: insets.bottom || 10 }]}
        >
          <TextInput
            style={styles.input}
            placeholder="Votre message..."
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
          >
            <Ionicons name="send" size={24} color="#fff" />
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
    paddingBottom: 20, // Pour descendre le titre
  },
  backButton: {
    marginRight: 10,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    flex: 1,
  },
  chatContainer: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    paddingBottom: 100, // Espace supplémentaire pour la zone d'envoi
  },
  messageRow: {
    flexDirection: "row",
    marginVertical: 5,
    alignItems: "flex-end",
  },
  myMessageRow: {
    justifyContent: "flex-end",
  },
  otherMessageRow: {
    justifyContent: "flex-start",
  },
  avatarContainer: {
    marginRight: 10,
  },
  messageBubble: {
    maxWidth: "75%",
    borderRadius: 20,
    padding: 10,
  },
  myMessageBubble: {
    backgroundColor: "#ed8f03", // Orange ChallengeTies
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
    fontSize: 16,
    fontFamily: "Comfortaa_400Regular",
    color: "#fff",
  },
  inputWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    padding: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    alignItems: "center",
  },
  input: {
    flex: 1,
    minHeight: 45,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 25,
    paddingHorizontal: 15,
    backgroundColor: "#f8f9fa",
    marginRight: 10,
    fontFamily: "Comfortaa_400Regular",
    fontSize: 16,
  },
  sendButton: {
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
  },
});
