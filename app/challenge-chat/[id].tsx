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
  Alert,
} from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { auth, db } from "../../constants/firebase-config";
import { useChat } from "../../context/ChatContext";
import { useTheme } from "../../context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Theme } from "../../theme/designSystem";
import designSystem from "../../theme/designSystem";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  updateDoc,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import ChatWelcomeModal from "../../components/ChatWelcomeModal";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SPACING = 18;


const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

const getDynamicStyles = (currentTheme: Theme, isDarkMode: boolean) => ({
  container: {
    backgroundColor: currentTheme.colors.background,
  },
  gradientContainer: {
    backgroundColor: currentTheme.colors.cardBackground + "F0",
  },
  headerGradient: {
    colors: [
      currentTheme.colors.primary,
      currentTheme.colors.secondary,
    ] as const,
  },
  headerTitle: {
    color: currentTheme.colors.textPrimary,
  },
  backButtonIcon: {
    color: currentTheme.colors.textPrimary,
  },
  messageList: {
    backgroundColor: currentTheme.colors.cardBackground + "F0",
  },
  myMessageBubble: {
    backgroundColor: currentTheme.colors.secondary,
    borderColor: isDarkMode
      ? currentTheme.colors.border
      : currentTheme.colors.primary,
  },
  otherMessageBubble: {
   backgroundColor: isDarkMode
     ? currentTheme.colors.cardBackground
     : "#e9ecef",
    borderColor: isDarkMode
      ? currentTheme.colors.border
      : currentTheme.colors.border,
  },
  messageText: {
    color: isDarkMode ? "#000" : "#333",
  },
  username: {
    color: currentTheme.colors.secondary,
  },
  inputWrapper: {
    backgroundColor: currentTheme.colors.cardBackground,
    borderTopColor: currentTheme.colors.border,
  },
  input: {
    borderColor: currentTheme.colors.border,
    backgroundColor:
      currentTheme.colors.overlay || currentTheme.colors.cardBackground,
    color: currentTheme.colors.textPrimary,
    placeholderTextColor: currentTheme.colors.textSecondary,
  },
  sendButton: {
    backgroundColor: currentTheme.colors.secondary,
  },
  sendButtonIcon: {
    color: currentTheme.colors.textPrimary,
  },
  reportButton: {
    backgroundColor: currentTheme.colors.error,
  },
  reportButtonText: {
    color: currentTheme.colors.textPrimary,
  },
  avatarIcon: {
    color: currentTheme.colors.secondary,
  },
});

interface Message {
  id: string;
  text: string;
  timestamp: Date;
  userId: string;
  username: string;
  avatar: string;
  reported: boolean;
}

export default function ChallengeChat() {
  const { t } = useTranslation();
  const { id: challengeIdParam, title: challengeTitleParam } =
    useLocalSearchParams();
  const challengeId = Array.isArray(challengeIdParam)
    ? challengeIdParam[0]
    : challengeIdParam;
  const navigation = useNavigation();
  const { messages, sendMessage } = useChat(challengeId);
  const [newMessage, setNewMessage] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
const isDarkMode = theme === "dark";
const currentTheme = isDarkMode
  ? designSystem.darkTheme
  : designSystem.lightTheme;
  const dynamicStyles = getDynamicStyles(currentTheme, isDarkMode);
  const [isListReady, setIsListReady] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  
  useEffect(() => {
    const checkRulesAcceptance = async () => {
      const userId = auth.currentUser?.uid;
      if (!userId || !challengeId) return;

      const acceptanceRef = doc(
        db,
        `users/${userId}/acceptedChatRules`,
        challengeId
      );
      const acceptanceDoc = await getDoc(acceptanceRef);
      if (acceptanceDoc.exists()) return;

      const chatRef = doc(db, "chats", challengeId);
      const chatDoc = await getDoc(chatRef);
      if (chatDoc.exists() && chatDoc.data()?.welcomeRules) {
        setModalVisible(true);
      }
    };

    checkRulesAcceptance();
  }, [challengeId]);

  const handleSend = useCallback(async () => {
    if (newMessage.trim().length === 0) return;
    try {
      await sendMessage(challengeId, newMessage);
      setNewMessage("");
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert(t("error"), t("errorSendingMessage"));
    }
  }, [newMessage, challengeId, sendMessage, t]);

  // Scroll au dernier message quand un nouveau message arrive
  useEffect(() => {
    if (messages.length > 0 && isListReady) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages, isListReady]);

  // Scroll initial au dernier message après le rendu de la FlatList
  const handleListLayout = useCallback(() => {
    if (messages.length > 0 && !isListReady) {
      flatListRef.current?.scrollToEnd({ animated: false });
      setIsListReady(true);
    }
  }, [messages.length, isListReady]);

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      const isMyMessage = item.userId === auth.currentUser?.uid;

      const handleReportMessage = async () => {
        try {
          const messageRef = doc(db, "chats", challengeId, "messages", item.id);
          await updateDoc(messageRef, { reported: true });
          Alert.alert(t("success"), t("messageReported"));
        } catch (error) {
          console.error("Erreur lors du signalement du message :", error);
          Alert.alert(t("error"), t("reportMessageFailed"));
        }
      };

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
                color={dynamicStyles.avatarIcon.color}
              />
            </View>
          )}
          <View
            style={[
              styles.messageBubble,
              isMyMessage
                ? [styles.myMessageBubble, dynamicStyles.myMessageBubble]
                : [styles.otherMessageBubble, dynamicStyles.otherMessageBubble],
            ]}
          >
            {!isMyMessage && (
              <Text style={[styles.username, dynamicStyles.username]}>
                {item.username}
              </Text>
            )}
            <Text style={[styles.messageText, dynamicStyles.messageText]}>
              {item.text}
            </Text>
            {!isMyMessage && !item.reported && (
              <TouchableOpacity
                style={[styles.reportButton, dynamicStyles.reportButton]}
                onPress={handleReportMessage}
                accessibilityLabel={t("reportMessage")}
              >
                <Text
                  style={[
                    styles.reportButtonText,
                    dynamicStyles.reportButtonText,
                  ]}
                >
                  {t("report")}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    },
    [challengeId, t, dynamicStyles]
  );

  const challengeTitle =
    typeof challengeTitleParam === "string"
      ? challengeTitleParam
      : challengeTitleParam?.[0] || "";

  return (
    <SafeAreaView style={[styles.container, dynamicStyles.container]}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDarkMode ? "light-content" : "dark-content"}
      />
      <LinearGradient
        colors={[
          currentTheme.colors.background,
          dynamicStyles.gradientContainer.backgroundColor,
        ]}
        style={[styles.container, dynamicStyles.container]}
      >
        <ChatWelcomeModal
          chatId={challengeId}
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
        />
        {/* Header */}
        <LinearGradient
          colors={dynamicStyles.headerGradient.colors}
          style={[styles.header, { paddingTop: insets.top }]}
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessibilityLabel={t("challengeChat.backButton")}
            testID="back-button"
          >
            <Ionicons
              name="arrow-back"
              size={normalizeSize(24)}
              color={dynamicStyles.backButtonIcon.color}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, dynamicStyles.headerTitle]}>
            {challengeTitle || t("challengeChat.defaultTitle")}
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
            contentContainerStyle={[
              styles.messageList,
              dynamicStyles.messageList,
            ]}
            initialNumToRender={10}
            windowSize={5}
            onLayout={handleListLayout}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
          />

          {/* Input area */}
          <View
            style={[
              styles.inputWrapper,
              dynamicStyles.inputWrapper,
              { paddingBottom: insets.bottom || SPACING },
            ]}
          >
            <TextInput
              style={[styles.input, dynamicStyles.input]}
              placeholder={t("challengeChat.placeholder")}
              placeholderTextColor={dynamicStyles.input.placeholderTextColor}
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              accessibilityLabel={t("challengeChat.inputA11yLabel")}
              accessibilityHint={t("challengeChat.inputA11yHint")}
              testID="message-input"
            />
            <TouchableOpacity
              style={[styles.sendButton, dynamicStyles.sendButton]}
              onPress={handleSend}
              accessibilityLabel={t("challengeChat.sendButtonLabel")}
              testID="send-button"
            >
              <Ionicons
                name="send"
                size={normalizeSize(24)}
                color={dynamicStyles.sendButtonIcon.color}
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(6),
    elevation: 8,
  },
  backButton: {
    marginRight: SPACING,
  },
  headerTitle: {
    fontSize: normalizeSize(24),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    flex: 1,
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  chatContainer: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: SPACING,
    paddingVertical: SPACING,
    paddingBottom: normalizeSize(100),
  },
  messageRow: {
    flexDirection: "row",
    marginVertical: normalizeSize(8),
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
    borderWidth: 2.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(6) },
    shadowOpacity: 0.35,
    shadowRadius: normalizeSize(8),
    elevation: 10,
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
    marginBottom: normalizeSize(4),
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(-4) },
    shadowOpacity: 0.2,
    shadowRadius: normalizeSize(4),
    elevation: 4,
  },
  input: {
    flex: 1,
    minHeight: normalizeSize(48),
    borderWidth: 2,
    borderRadius: normalizeSize(24),
    paddingHorizontal: SPACING,
    paddingVertical: normalizeSize(12),
    marginRight: SPACING,
    fontFamily: "Comfortaa_400Regular",
    fontSize: normalizeSize(16),
  },
  sendButton: {
    borderRadius: normalizeSize(24),
    paddingHorizontal: normalizeSize(16),
    paddingVertical: normalizeSize(12),
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: normalizeSize(4) },
    shadowOpacity: 0.3,
    shadowRadius: normalizeSize(6),
    elevation: 8,
  },
  reportButton: {
    marginTop: SPACING / 2,
    paddingVertical: normalizeSize(6),
    paddingHorizontal: normalizeSize(12),
    borderRadius: normalizeSize(8),
    alignSelf: "flex-end",
  },
  reportButtonText: {
    fontSize: normalizeSize(12),
    fontFamily: "Comfortaa_700Bold",
  },
});
