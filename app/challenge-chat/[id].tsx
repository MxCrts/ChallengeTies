import React, { useState, useRef, useEffect, useCallback, useMemo  } from "react";
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
import { updateDoc, doc, getDoc } from "firebase/firestore";
import ChatWelcomeModal from "../../components/ChatWelcomeModal";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SPACING = 18;

const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

/** Orbes premium non interactives */
const OrbBackground = ({ theme }: { theme: Theme }) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    {/* Orbe TL */}
    <LinearGradient
      colors={[theme.colors.secondary + "55", theme.colors.primary + "11"]}
      start={{ x: 0.1, y: 0.1 }}
      end={{ x: 0.9, y: 0.9 }}
      style={[
        styles.orb,
        {
          width: SCREEN_WIDTH * 1.0,
          height: SCREEN_WIDTH * 1.0,
          borderRadius: (SCREEN_WIDTH * 1.0) / 2,
          top: -SCREEN_WIDTH * 0.6,
          left: -SCREEN_WIDTH * 0.35,
        },
      ]}
    />
    {/* Orbe BR */}
    <LinearGradient
      colors={[theme.colors.primary + "40", theme.colors.secondary + "14"]}
      start={{ x: 0.2, y: 0.2 }}
      end={{ x: 0.8, y: 0.8 }}
      style={[
        styles.orb,
        {
          width: SCREEN_WIDTH * 1.2,
          height: SCREEN_WIDTH * 1.2,
          borderRadius: (SCREEN_WIDTH * 1.2) / 2,
          bottom: -SCREEN_WIDTH * 0.7,
          right: -SCREEN_WIDTH * 0.45,
        },
      ]}
    />
    {/* Voile de fusion */}
    <LinearGradient
      colors={[theme.colors.background + "00", theme.colors.background + "66"]}
      style={StyleSheet.absoluteFill}
    />
  </View>
);

const getDynamicStyles = (currentTheme: Theme, isDarkMode: boolean) => ({
  container: { backgroundColor: currentTheme.colors.background },
  // On laisse voir le fond orbe
  gradientContainer: { backgroundColor: currentTheme.colors.cardBackground + "00" },
  headerGradient: {
    colors: [currentTheme.colors.primary, currentTheme.colors.secondary] as const,
  },
  headerTitle: { color: "#FFFFFF" }, // titre blanc lisible sur gradient
  backButtonIcon: { color: "#FFFFFF" },

  // Liste transparente pour voir le fond
  messageList: { backgroundColor: "transparent" },

  // On garde juste la bordure via hairline, le fond est géré par <LinearGradient/>
  myMessageBubble: {
    borderColor: isDarkMode ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)",
  },
  otherMessageBubble: {
    borderColor: isDarkMode ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)",
  },

  messageText: { color: isDarkMode ? currentTheme.colors.textPrimary : "#222" },
  username: { color: currentTheme.colors.secondary },

  inputWrapper: {
    backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
    borderTopColor: isDarkMode ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)",
  },
  input: {
    borderColor: isDarkMode ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)",
    backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
    color: isDarkMode ? currentTheme.colors.textPrimary : "#000",
    placeholderTextColor: isDarkMode ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.45)",
  },
  sendButtonIcon: { color: "#fff" },
  reportButton: { backgroundColor: currentTheme.colors.error },
  reportButtonText: { color: "#fff" },
  avatarIcon: { color: currentTheme.colors.secondary },
});

interface ChatMessage {
  id: string;
  text: string;
  textKey?: string;
  timestamp: Date | { toMillis?: () => number } | number; // ← tolerate Firestore TS
  userId: string;
  username: string;
  avatar: string;
  reported: boolean;
  type?: "system" | "text";
  systemType?: "welcome" | string;
  pinned?: boolean;          // ← important
  centered?: boolean;
  style?: string;
}


export default function ChallengeChat() {
  const { t } = useTranslation();
  const { id: challengeIdParam, title: challengeTitleParam } = useLocalSearchParams();
  const challengeId = Array.isArray(challengeIdParam) ? challengeIdParam[0] : challengeIdParam;
  const navigation = useNavigation();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme = isDarkMode ? designSystem.darkTheme : designSystem.lightTheme;
  const dynamicStyles = getDynamicStyles(currentTheme, isDarkMode);
const [composerHeight, setComposerHeight] = useState(SPACING * 4);
const { messages, sendMessage } = useChat(challengeId as string);
  const [newMessage, setNewMessage] = useState("");
  const [isListReady, setIsListReady] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const insets = useSafeAreaInsets();

// helper simple pour normaliser le timestamp (Firestore/Date/number)
// helper pour normaliser le timestamp
const toMs = (ts: any) => {
  if (!ts) return 0;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === "number") return ts;
  return typeof ts?.toMillis === "function" ? ts.toMillis() : 0;
};

// messages triés: pinned d'abord, puis timestamp asc
const sortedMessages = useMemo<ChatMessage[]>(() => {
  const arr = (Array.isArray(messages) ? messages : []) as ChatMessage[];
  return arr.slice().sort((a, b) => {
    const pa = a?.pinned ? 1 : 0;
    const pb = b?.pinned ? 1 : 0;
    if (pa !== pb) return pb - pa; // pinned en premier
    return toMs(a.timestamp) - toMs(b.timestamp);
  });
}, [messages]);

// Fallback : si aucun welcome dans le snapshot, on injecte un message système local
const finalMessages = useMemo<ChatMessage[]>(() => {
  const arr = [...sortedMessages];
  const hasWelcome = arr.some(
    (m) => m?.type === "system" && m?.systemType === "welcome"
  );
  if (!hasWelcome) {
    arr.unshift({
      id: "welcome-local",
      text: "",
      textKey: "chat.systemWelcome",
      timestamp: Date.now(),
      userId: "system",
      username: "Moderation",
      avatar: "",
      reported: false,
      type: "system",
      systemType: "welcome",
      pinned: true,
      centered: true,
      style: "notice",
    } as ChatMessage);
  }
  return arr;
}, [sortedMessages]);

// DEBUG court: vérifie ce que le flatlist reçoit
useEffect(() => {
  const head = finalMessages.slice(0, 3).map((m) => ({
    id: m.id,
    type: m.type,
    systemType: m.systemType,
    pinned: m.pinned,
    textKey: m.textKey,
  }));
  console.log("▶ finalMessages(head):", head);
}, [finalMessages]);

  
  // Vérif règles (logique inchangée)
  useEffect(() => {
    const checkRulesAcceptance = async () => {
      const userId = auth.currentUser?.uid;
      if (!userId || !challengeId) return;

      const acceptanceRef = doc(db, `users/${userId}/acceptedChatRules`, challengeId as string);
      const acceptanceDoc = await getDoc(acceptanceRef);
      if (acceptanceDoc.exists()) return;

      const chatRef = doc(db, "chats", challengeId as string);
      const chatDoc = await getDoc(chatRef);
      if (chatDoc.exists() && chatDoc.data()?.welcomeRules) {
        setModalVisible(true);
      }
    };
    checkRulesAcceptance();
  }, [challengeId]);

  const handleSend = useCallback(async () => {
    if (!newMessage.trim()) return;
    try {
      await sendMessage(challengeId as string, newMessage);
      setNewMessage("");
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert(t("error"), t("errorSendingMessage"));
    }
  }, [newMessage, challengeId, sendMessage, t]);

  useEffect(() => {
    if (messages.length > 0 && isListReady) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages, isListReady]);

  const handleListLayout = useCallback(() => {
    if (messages.length > 0 && !isListReady) {
      flatListRef.current?.scrollToEnd({ animated: false });
      setIsListReady(true);
    }
  }, [messages.length, isListReady]);

  const renderMessage = useCallback(
  ({ item }: { item: ChatMessage }) => {
    // 👇 BRANCHE SYSTÈME: message d’accueil
    if (item.type === "system" && item.systemType === "welcome") {
      const body = item.textKey ? t(item.textKey) : (item.text || "");
      return (
        <View style={styles.systemWelcomeRow}>
          <View
            style={[
              styles.systemWelcomeWrap,
              {
                borderColor: currentTheme.colors.secondary,
                backgroundColor: currentTheme.colors.secondary + "14",
              },
            ]}
          >
            <Text
              style={[
                styles.systemWelcomeTitle,
                { color: currentTheme.colors.secondary },
              ]}
            >
              {t("chat.welcomeTitle", { defaultValue: "Bienvenue 👋" })}
            </Text>
            <Text
              style={[
                styles.systemWelcomeText,
                { color: isDarkMode ? currentTheme.colors.textPrimary : "#222" },
              ]}
            >
              {body}
            </Text>
          </View>
        </View>
      );
    }

      const isMyMessage = item.userId === auth.currentUser?.uid;

      const handleReportMessage = async () => {
        try {
          const messageRef = doc(db, "chats", challengeId as string, "messages", item.id);
          await updateDoc(messageRef, { reported: true });
          Alert.alert(t("success"), t("messageReported"));
        } catch (error) {
          console.error("Erreur report:", error);
          Alert.alert(t("error"), t("reportMessageFailed"));
        }
      };

      const myBubbleColors: [string, string] = [
        currentTheme.colors.primary,
        currentTheme.colors.secondary,
      ];
      const otherBubbleColors: [string, string] = isDarkMode
        ? ["rgba(255,255,255,0.10)", "rgba(255,255,255,0.03)"]
        : ["rgba(0,0,0,0.05)", "rgba(0,0,0,0.02)"];

      const borderClr = isDarkMode ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)";

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
                size={normalizeSize(32)}
                color={dynamicStyles.avatarIcon.color}
              />
            </View>
          )}

          <LinearGradient
            colors={isMyMessage ? myBubbleColors : otherBubbleColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.messageBubble,
              { borderColor: borderClr },
              isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
            ]}
          >
            {!isMyMessage && (
              <Text style={[styles.username, dynamicStyles.username]}>
                {item.username}
              </Text>
            )}

            <Text
              style={[
                styles.messageText,
                isMyMessage ? { color: "#fff" } : dynamicStyles.messageText,
              ]}
            >
              {item.text}
            </Text>

            {!isMyMessage && !item.reported && (
              <TouchableOpacity
                style={[styles.reportButton, dynamicStyles.reportButton]}
                onPress={handleReportMessage}
                accessibilityLabel={t("reportMessage")}
              >
                <Text style={[styles.reportButtonText, dynamicStyles.reportButtonText]}>
                  {t("report")}
                </Text>
              </TouchableOpacity>
            )}
          </LinearGradient>
        </View>
      );
    },
    [challengeId, t, dynamicStyles, currentTheme.colors, isDarkMode]
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

      {/* Fond gradient + orbes */}
      <LinearGradient
        colors={[currentTheme.colors.background, currentTheme.colors.cardBackground + "F0"]}
        style={StyleSheet.absoluteFill}
      />
      <OrbBackground theme={currentTheme} />

      <ChatWelcomeModal
        chatId={challengeId as string}
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />

      {/* Header dégradé, hairline subtile */}
      <LinearGradient
        colors={getDynamicStyles(currentTheme, isDarkMode).headerGradient.colors}
        style={[
          styles.header,
          {
            paddingTop: insets.top,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
            shadowOpacity: 0, // kill shadow
            elevation: 0,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => (navigation as any).goBack()}
          style={styles.backButton}
          accessibilityLabel={t("challengeChat.backButton")}
          testID="back-button"
          activeOpacity={0.7}
        >
          <Ionicons
            name="chevron-back"
            size={normalizeSize(22)}
            color={getDynamicStyles(currentTheme, isDarkMode).backButtonIcon.color}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, getDynamicStyles(currentTheme, isDarkMode).headerTitle]}>
          {challengeTitle || t("challengeChat.defaultTitle")}
        </Text>
        <View style={{ width: normalizeSize(22) }} />
      </LinearGradient>

      <KeyboardAvoidingView
  style={styles.chatContainer}
  behavior={Platform.OS === "ios" ? "padding" : "height"}  // 👈 mieux pour Android
  keyboardVerticalOffset={insets.top + normalizeSize(56)}  // 👈 ~ hauteur header
>

        <FlatList
          ref={flatListRef}
          data={finalMessages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
    styles.messageList,
    dynamicStyles.messageList,
    { paddingBottom: composerHeight + (insets.bottom || 0) + SPACING } // 👈 NEW
  ]}
          initialNumToRender={10}
          windowSize={5}
          onLayout={handleListLayout}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
        />

        {/* Barre d’entrée “glass” premium */}
        <View
  style={[
    styles.inputWrapper,
    dynamicStyles.inputWrapper,
    { paddingBottom: insets.bottom || SPACING },
  ]}
  onLayout={(e) => setComposerHeight(e.nativeEvent.layout.height)}   // 👈 NEW
>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: getDynamicStyles(currentTheme, isDarkMode).input.borderColor,
                backgroundColor: getDynamicStyles(currentTheme, isDarkMode).input.backgroundColor,
                color: getDynamicStyles(currentTheme, isDarkMode).input.color,
              },
            ]}
            placeholder={t("challengeChat.placeholder")}
            placeholderTextColor={getDynamicStyles(currentTheme, isDarkMode).input.placeholderTextColor}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            accessibilityLabel={t("challengeChat.inputA11yLabel")}
            accessibilityHint={t("challengeChat.inputA11yHint")}
            testID="message-input"
          />
          <LinearGradient
            colors={[currentTheme.colors.secondary, currentTheme.colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sendButton}
          >
            <TouchableOpacity onPress={handleSend} activeOpacity={0.85}>
              <Ionicons
                name="send"
                size={normalizeSize(18)}
                color={getDynamicStyles(currentTheme, isDarkMode).sendButtonIcon.color}
              />
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING,
    paddingHorizontal: SPACING,
  },
  backButton: {
    marginRight: SPACING,
    width: normalizeSize(36),
    height: normalizeSize(36),
    borderRadius: normalizeSize(18),
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: normalizeSize(18),
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
    flex: 1,
  },

  chatContainer: { flex: 1 },

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
  myMessageRow: { justifyContent: "flex-end" },
  otherMessageRow: { justifyContent: "flex-start" },

  avatarContainer: { marginRight: SPACING },

  messageBubble: {
    maxWidth: "78%",
    borderRadius: normalizeSize(20),
    padding: SPACING,
    borderWidth: StyleSheet.hairlineWidth,
    // no heavy shadows
    shadowOpacity: 0,
    elevation: 0,
  },
  myMessageBubble: { marginLeft: "22%" },
  otherMessageBubble: { marginRight: "22%" },

  username: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(12),
    marginBottom: normalizeSize(4),
  },
  messageText: {
    fontSize: normalizeSize(15),
    fontFamily: "Comfortaa_400Regular",
  },

  inputWrapper: {
    flexDirection: "row",
    padding: SPACING,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  input: {
    flex: 1,
    minHeight: normalizeSize(44),
    maxHeight: normalizeSize(140),
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: normalizeSize(18),
    paddingHorizontal: SPACING,
    paddingVertical: normalizeSize(10),
    marginRight: SPACING,
    fontFamily: "Comfortaa_400Regular",
    fontSize: normalizeSize(15),
  },
  sendButton: {
    width: normalizeSize(40),
    height: normalizeSize(40),
    borderRadius: normalizeSize(20),
    alignItems: "center",
    justifyContent: "center",
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
  systemWelcomeRow: {
  flexDirection: "row",
  justifyContent: "center",
  marginVertical: normalizeSize(10),
},

systemWelcomeWrap: {
  alignSelf: "center",
  maxWidth: "92%",
  paddingVertical: normalizeSize(12),
  paddingHorizontal: normalizeSize(14),
  borderRadius: normalizeSize(14),
  borderWidth: 1.5,
  borderStyle: "dashed",
},

systemWelcomeTitle: {
  fontFamily: "Comfortaa_700Bold",
  fontSize: normalizeSize(13),
  textAlign: "center",
  marginBottom: normalizeSize(6),
},

systemWelcomeText: {
  fontFamily: "Comfortaa_400Regular",
  fontSize: normalizeSize(13),
  lineHeight: normalizeSize(18),
  textAlign: "center",
},


  // Orbes
  orb: { position: "absolute", opacity: 0.9 },
});
