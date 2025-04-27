import React, { useState, useRef, useEffect, useCallback } from "react";
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
  StatusBar,
} from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { auth } from "../../constants/firebase-config";
import { useChat } from "../../context/ChatContext";
import { useTheme } from "../../context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SPACING = 15;

const normalizeSize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

export default function ChallengeChat() {
  const { id: challengeId, title: challengeTitle } = useLocalSearchParams();
  const navigation = useNavigation();
  const { messages, sendMessage } = useChat(
    Array.isArray(challengeId) ? challengeId[0] : challengeId
  );
  const [newMessage, setNewMessage] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();

  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode ? designSystem.darkTheme : designSystem.lightTheme;
  const headerGradient: readonly [string, string] = [
    currentTheme.colors.primary,
    currentTheme.colors.secondary,
  ] as const;

  const handleSend = useCallback(async () => {
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
  }, [newMessage, challengeId, sendMessage]);

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const renderMessage = useCallback(
    ({ item }: { item: any }) => {
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
                size={normalizeSize(34)}
                color={currentTheme.colors.secondary}
              />
            </View>
          )}
          <View
            style={[
              styles.messageBubble,
              isMyMessage
                ? [
                    styles.myMessageBubble,
                    { backgroundColor: currentTheme.colors.secondary },
                  ]
                : [
                    styles.otherMessageBubble,
                    { backgroundColor: currentTheme.colors.cardBackground },
                  ],
            ]}
          >
            {!isMyMessage && (
              <Text
                style={[
                  styles.username,
                  { color: currentTheme.colors.secondary },
                ]}
              >
                {item.username}
              </Text>
            )}
            <Text
              style={[
                styles.messageText,
                { color: isMyMessage ? currentTheme.colors.textPrimary : currentTheme.colors.textSecondary },
              ]}
            >
              {item.text}
            </Text>
          </View>
        </View>
      );
    },
    [currentTheme]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDarkMode ? "light-content" : "dark-content"}
      />
      {/* Header avec gradient */}
      <LinearGradient colors={headerGradient} style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityLabel="Retour à la page précédente"
          testID="back-button"
        >
          <Ionicons name="arrow-back" size={normalizeSize(24)} color={currentTheme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: currentTheme.colors.textPrimary }]}>
          {challengeTitle || "Challenge Chat"}
        </Text>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 80}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          initialNumToRender={10}
          windowSize={5}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />
        {/* Zone d'envoi */}
        <View
          style={[
            styles.inputWrapper,
            {
              paddingBottom: insets.bottom || SPACING,
              backgroundColor: currentTheme.colors.cardBackground,
              borderTopColor: currentTheme.colors.border,
            },
          ]}
        >
          <TextInput
            style={[
              styles.input,
              {
                borderColor: currentTheme.colors.border,
                backgroundColor: currentTheme.colors.overlay,
                color: currentTheme.colors.textPrimary,
              },
            ]}
            placeholder="Votre message..."
            placeholderTextColor={currentTheme.colors.textSecondary}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            accessibilityLabel="Champ pour écrire un message"
            accessibilityHint="Tapez votre message ici"
            testID="message-input"
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: currentTheme.colors.secondary },
            ]}
            onPress={handleSend}
            accessibilityLabel="Envoyer le message"
            testID="send-button"
          >
            <Ionicons
              name="send"
              size={normalizeSize(24)}
              color={currentTheme.colors.textPrimary}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING,
    paddingHorizontal: SPACING,
  },
  backButton: {
    marginRight: SPACING,
  },
  headerTitle: {
    fontSize: normalizeSize(20),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    flex: 1,
  },
  chatContainer: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: SPACING,
    paddingVertical: SPACING,
    paddingBottom: normalizeSize(100), // Espace pour la zone d'envoi
  },
  messageRow: {
    flexDirection: "row",
    marginVertical: normalizeSize(5),
    alignItems: "flex-end",
  },
  myMessageRow: {
    justifyContent: "flex-end",
  },
  otherMessageRow: {
    justifyContent: "flex-start",
  },
  avatarContainer: {
    marginRight: SPACING,
  },
  messageBubble: {
    maxWidth: "75%",
    borderRadius: normalizeSize(20),
    padding: SPACING,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(2) },
    shadowOpacity: 0.1,
    shadowRadius: normalizeSize(4),
    elevation: 2,
  },
  myMessageBubble: {
    marginLeft: "25%",
  },
  otherMessageBubble: {
    marginRight: "25%",
  },
  username: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(14),
    marginBottom: normalizeSize(3),
  },
  messageText: {
    fontSize: normalizeSize(16),
    fontFamily: "Comfortaa_400Regular",
  },
  inputWrapper: {
    flexDirection: "row",
    padding: SPACING,
    borderTopWidth: 1,
    alignItems: "center",
  },
  input: {
    flex: 1,
    minHeight: normalizeSize(45),
    borderWidth: 1,
    borderRadius: normalizeSize(25),
    paddingHorizontal: SPACING,
    paddingVertical: normalizeSize(10),
    marginRight: SPACING,
    fontFamily: "Comfortaa_400Regular",
    fontSize: normalizeSize(16),
  },
  sendButton: {
    borderRadius: normalizeSize(25),
    paddingHorizontal: normalizeSize(16),
    paddingVertical: normalizeSize(10),
    justifyContent: "center",
    alignItems: "center",
  },
});