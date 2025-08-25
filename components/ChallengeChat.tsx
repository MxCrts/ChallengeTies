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
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { auth, db } from "../constants/firebase-config";
import { useChat } from "../context/ChatContext";
import designSystem from "../theme/designSystem";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import { doc, updateDoc } from "firebase/firestore";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface Message {
  id: string;
  text: string;
  timestamp: Date;
  userId: string;
  username: string;
  avatar: string;
  reported: boolean;
}

/** Fond orbes premium, non interactif */
const OrbBackground = ({ colors }: { colors: { primary: string; secondary: string; background: string } }) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <LinearGradient
      colors={[colors.secondary + "55", colors.primary + "11"]}
      style={[
        styles.orb,
        {
          width: SCREEN_WIDTH * 0.95,
          height: SCREEN_WIDTH * 0.95,
          borderRadius: (SCREEN_WIDTH * 0.95) / 2,
          top: -SCREEN_WIDTH * 0.55,
          left: -SCREEN_WIDTH * 0.35,
        },
      ]}
      start={{ x: 0.1, y: 0.1 }}
      end={{ x: 0.9, y: 0.9 }}
    />
    <LinearGradient
      colors={[colors.primary + "40", colors.secondary + "14"]}
      style={[
        styles.orb,
        {
          width: SCREEN_WIDTH * 1.1,
          height: SCREEN_WIDTH * 1.1,
          borderRadius: (SCREEN_WIDTH * 1.1) / 2,
          bottom: -SCREEN_WIDTH * 0.6,
          right: -SCREEN_WIDTH * 0.4,
        },
      ]}
      start={{ x: 0.2, y: 0.2 }}
      end={{ x: 0.8, y: 0.8 }}
    />
    <LinearGradient
      colors={[colors.background + "00", colors.background + "66"]}
      style={StyleSheet.absoluteFill}
    />
  </View>
);

export default function ChallengeChat() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme = isDarkMode ? designSystem.darkTheme : designSystem.lightTheme;

  const [route, setRoute] = useState<any>(null);
  const [navigation, setNavigation] = useState<any>(null);

  // Lazy load navigation hooks (on ne touche pas la logique)
  useEffect(() => {
    (async () => {
      const { useRoute, useNavigation } = await import("@react-navigation/native");
      setRoute(() => useRoute());
      setNavigation(() => useNavigation());
    })();
  }, []);

  if (!route || !navigation) {
    return (
      <View style={[styles.center, { flex: 1 }]}>
        <Text style={{ color: currentTheme.colors.textPrimary, fontFamily: "Comfortaa_400Regular" }}>
          {t("loading", { defaultValue: "Chargement..." })}
        </Text>
      </View>
    );
  }

  const { challengeId, challengeTitle } = route.params as {
    challengeId: string;
    challengeTitle: string;
  };

  const { messages, sendMessage } = useChat(challengeId);
  const [newMessage, setNewMessage] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const headerGradient: readonly [string, string] = [
    currentTheme.colors.primary,
    currentTheme.colors.secondary,
  ] as const;

  const glassBg = isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
  const hairline = isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)";

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

  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.userId === auth.currentUser?.uid;

    const handleReportMessage = async () => {
      try {
        const messageRef = doc(db, "chats", challengeId, "messages", item.id);
        await updateDoc(messageRef, { reported: true });
        Alert.alert(t("success"), t("messageReported", { defaultValue: "Message signalé." }));
      } catch (error) {
        console.error("Erreur report:", error);
        Alert.alert(t("error"), t("reportMessageFailed", { defaultValue: "Impossible de signaler le message." }));
      }
    };

    const myBubbleColors: [string, string] = [
      currentTheme.colors.primary,
      currentTheme.colors.secondary,
    ];
    const otherBubbleColors: [string, string] = isDarkMode
      ? ["rgba(255,255,255,0.08)", "rgba(255,255,255,0.02)"]
      : ["rgba(0,0,0,0.04)", "rgba(0,0,0,0.02)"];

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
              size={32}
              color={currentTheme.colors.secondary}
            />
          </View>
        )}

        <LinearGradient
          colors={isMyMessage ? myBubbleColors : otherBubbleColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.messageBubble,
            { borderColor: hairline },
            isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
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
              isMyMessage
                ? { color: "#fff" }
                : { color: isDarkMode ? currentTheme.colors.textPrimary : "#222" },
            ]}
          >
            {item.text}
          </Text>

          {!isMyMessage && !item.reported && (
            <TouchableOpacity
              style={[
                styles.reportButton,
                { backgroundColor: "#EF4444" },
              ]}
              onPress={handleReportMessage}
              accessibilityLabel={t("reportMessage", { defaultValue: "Signaler ce message" })}
            >
              <Text style={styles.reportButtonText}>
                {t("report", { defaultValue: "Signaler" })}
              </Text>
            </TouchableOpacity>
          )}
        </LinearGradient>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Fond gradient + orbes */}
      <LinearGradient
        colors={[currentTheme.colors.background, currentTheme.colors.cardBackground + "F0"]}
        style={StyleSheet.absoluteFill}
      />
      <OrbBackground
        colors={{
          primary: currentTheme.colors.primary,
          secondary: currentTheme.colors.secondary,
          background: currentTheme.colors.background,
        }}
      />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Header premium (gradient fin + titre centré + back subtil) */}
        <LinearGradient colors={headerGradient} style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityLabel={t("chat.goBack")}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t("chat.title", { title: challengeTitle })}
          </Text>
          <View style={{ width: 36 }} />
        </LinearGradient>

        <KeyboardAvoidingView
          style={styles.chatContainer}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            accessibilityLabel={t("chat.messagesList")}
            showsVerticalScrollIndicator={false}
          />

          {/* Barre d’entrée “glass” */}
          <View
            style={[
              styles.inputBar,
              { backgroundColor: glassBg, borderColor: hairline },
            ]}
          >
            <TextInput
              style={[
                styles.input,
                {
                  color: isDarkMode ? currentTheme.colors.textPrimary : "#000",
                },
              ]}
              placeholder={t("chat.placeholder")}
              placeholderTextColor={isDarkMode ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.45)"}
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
            />
            <LinearGradient
              colors={[currentTheme.colors.secondary, currentTheme.colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sendBtn}
            >
              <TouchableOpacity onPress={handleSend} activeOpacity={0.8}>
                <Ionicons name="send" size={18} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/* ======================= Styles (statics) ======================= */

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: "#fff",
    fontSize: 18,
    fontFamily: "Comfortaa_700Bold",
  },

  chatContainer: { flex: 1 },
  messageList: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 90,
  },

  messageRow: {
    flexDirection: "row",
    marginVertical: 6,
    alignItems: "flex-end",
  },
  myMessageRow: { justifyContent: "flex-end" },
  otherMessageRow: { justifyContent: "flex-start" },

  avatarContainer: { marginRight: 8 },

  messageBubble: {
    maxWidth: "78%",
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  myMessageBubble: { marginLeft: "22%" },
  otherMessageBubble: { marginRight: "22%" },

  username: {
    fontFamily: "Comfortaa_700Bold",
    marginBottom: 4,
    fontSize: 12,
  },
  messageText: {
    fontSize: 15,
    fontFamily: "Comfortaa_400Regular",
  },

  inputBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: "Comfortaa_400Regular",
    fontSize: 15,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  reportButton: {
    marginTop: 5,
    backgroundColor: "#EF4444",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    alignSelf: "flex-end",
  },
  reportButtonText: {
    color: "#FFF",
    fontSize: 12,
    fontFamily: "Comfortaa_700Bold",
  },

  // orbes
  orb: { position: "absolute", opacity: 0.9 },
});
