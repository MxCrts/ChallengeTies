import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
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

const normalize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.8), 1.4);
  return Math.round(size * scale);
};

interface Message {
  id: string;
  text: string;
  timestamp: Date;
  userId: string;
  username: string;
 avatar?: string;   // 👈 optionnel
  reported?: boolean;
}

/** Fond orbes premium, non interactif */
const OrbBackground = ({
  colors,
}: {
  colors: { primary: string; secondary: string; background: string };
}) => (
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
  const currentTheme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  const [route, setRoute] = useState<any>(null);
  const [navigation, setNavigation] = useState<any>(null);

  // Lazy load navigation hooks (on garde ta logique)
  useEffect(() => {
    (async () => {
      const { useRoute, useNavigation } = await import(
        "@react-navigation/native"
      );
      setRoute(() => useRoute());
      setNavigation(() => useNavigation());
    })();
  }, []);

  if (!route || !navigation) {
    return (
      <View style={[styles.center, { flex: 1 }]}>
        <Text
          style={{
            color: currentTheme.colors.textPrimary,
            fontFamily: "Comfortaa_400Regular",
            fontSize: normalize(15),
          }}
        >
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
  const flatListRef = useRef<FlatList<Message>>(null);

  const headerGradient: readonly [string, string] = [
    currentTheme.colors.primary,
    currentTheme.colors.secondary,
  ] as const;

  const glassBg = isDarkMode
    ? "rgba(15,23,42,0.9)"
    : "rgba(255,255,255,0.9)";
  const hairline = isDarkMode
    ? "rgba(255,255,255,0.12)"
    : "rgba(0,0,0,0.10)";

  const canSend = newMessage.trim().length > 0;

  const handleSend = useCallback(async () => {
    const content = newMessage.trim();
    if (!content.length) return;

    try {
      await sendMessage(challengeId, content);
      setNewMessage("");
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (error) {
      console.error(t("chat.errorSending"), error);
      Alert.alert(
        t("error", { defaultValue: "Erreur" }),
        t("chat.errorSending", {
          defaultValue: "Impossible d'envoyer le message.",
        }) as string
      );
    }
  }, [newMessage, sendMessage, challengeId, t]);

  const handleReportMessage = useCallback(
    async (messageId: string) => {
      try {
        const messageRef = doc(db, "chats", challengeId, "messages", messageId);
        await updateDoc(messageRef, { reported: true });

        Alert.alert(
          t("success", { defaultValue: "Succès" }),
          t("messageReported", {
            defaultValue: "Message signalé.",
          }) as string
        );
      } catch (error) {
        console.error("Erreur report:", error);
        Alert.alert(
          t("error", { defaultValue: "Erreur" }),
          t("reportMessageFailed", {
            defaultValue: "Impossible de signaler le message.",
          }) as string
        );
      }
    },
    [challengeId, t]
  );

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      const isMyMessage = item.userId === auth.currentUser?.uid;

      const myBubbleColors: [string, string] = [
        currentTheme.colors.primary,
        currentTheme.colors.secondary,
      ];
      const otherBubbleColors: [string, string] = isDarkMode
        ? ["rgba(255,255,255,0.08)", "rgba(255,255,255,0.02)"]
        : ["rgba(0,0,0,0.04)", "rgba(0,0,0,0.02)"];

      const accessibleLabel = isMyMessage
        ? (t("chat.myMessageA11y", {
            defaultValue: "Ton message",
          }) as string)
        : (t("chat.userMessageA11y", {
            user: item.username,
            defaultValue: `Message de ${item.username}`,
          }) as string);

      return (
        <View
          style={[
            styles.messageRow,
            isMyMessage ? styles.myMessageRow : styles.otherMessageRow,
          ]}
          accessible
          accessibilityLabel={accessibleLabel}
        >
          {!isMyMessage && (
            <View style={styles.avatarContainer}>
              <Ionicons
                name="person-circle-outline"
                size={normalize(32)}
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
                numberOfLines={1}
              >
                {item.username}
              </Text>
            )}

            <Text
              style={[
                styles.messageText,
                isMyMessage
                  ? { color: "#fff" }
                  : {
                      color: isDarkMode
                        ? currentTheme.colors.textPrimary
                        : "#222",
                    },
              ]}
            >
              {item.text}
            </Text>

            {!isMyMessage && !item.reported && (
              <TouchableOpacity
                style={styles.reportButton}
                onPress={() => handleReportMessage(item.id)}
                accessibilityLabel={t("reportMessage", {
                  defaultValue: "Signaler ce message",
                })}
              >
                <Text style={styles.reportButtonText}>
                  {t("report", { defaultValue: "Signaler" })}
                </Text>
              </TouchableOpacity>
            )}

            {!isMyMessage && item.reported && (
              <Text style={styles.reportedTag}>
                {t("messageAlreadyReported", {
                  defaultValue: "Message signalé",
                })}
              </Text>
            )}
          </LinearGradient>
        </View>
      );
    },
    [currentTheme.colors.primary, currentTheme.colors.secondary, hairline, isDarkMode, handleReportMessage, t]
  );

  const renderEmpty = useCallback(
    () => (
      <View style={styles.emptyState}>
        <Ionicons
          name="chatbubble-ellipses-outline"
          size={normalize(40)}
          color={
            isDarkMode
              ? "rgba(248,250,252,0.75)"
              : "rgba(15,23,42,0.6)"
          }
        />
        <Text
          style={[
            styles.emptyTitle,
            {
              color: isDarkMode
                ? currentTheme.colors.textPrimary
                : "#111827",
            },
          ]}
        >
          {t("chat.emptyTitle", {
            defaultValue: "Aucun message pour l’instant",
          })}
        </Text>
        <Text
          style={[
            styles.emptySubtitle,
            { color: currentTheme.colors.textSecondary },
          ]}
        >
          {t("chat.emptySubtitle", {
            defaultValue: "Sois le premier à lancer la conversation ✨",
          })}
        </Text>
      </View>
    ),
    [currentTheme, isDarkMode, t]
  );

  return (
    <View style={{ flex: 1 }}>
      {/* Fond gradient + orbes */}
      <LinearGradient
        colors={[
          currentTheme.colors.background,
          currentTheme.colors.cardBackground + "F0",
        ]}
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
        {/* Header premium */}
        <LinearGradient colors={headerGradient} style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityLabel={t("chat.goBack", {
              defaultValue: "Revenir en arrière",
            })}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={normalize(20)} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {t("chat.title", {
              title: challengeTitle,
              defaultValue: `Chat - ${challengeTitle}`,
            })}
          </Text>
          {/* Espace réservé pour centrer le titre */}
          <View style={{ width: normalize(36) }} />
        </LinearGradient>

        <KeyboardAvoidingView
          style={styles.chatContainer}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
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
            accessibilityLabel={t("chat.messagesList", {
              defaultValue: "Liste des messages du chat",
            })}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={renderEmpty}
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
                  color: isDarkMode
                    ? currentTheme.colors.textPrimary
                    : "#000",
                },
              ]}
              placeholder={t("chat.placeholder", {
                defaultValue: "Écris un message…",
              })}
              placeholderTextColor={
                isDarkMode
                  ? "rgba(248,250,252,0.65)"
                  : "rgba(15,23,42,0.45)"
              }
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              accessibilityLabel={t("chat.inputA11y", {
                defaultValue: "Champ de saisie du message",
              })}
            />
            <LinearGradient
              colors={[
                currentTheme.colors.secondary,
                currentTheme.colors.primary,
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.sendBtn,
                { opacity: canSend ? 1 : 0.4 },
              ]}
            >
              <TouchableOpacity
                onPress={handleSend}
                activeOpacity={0.8}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel={t("chat.sendMessage", {
                  defaultValue: "Envoyer le message",
                })}
              >
                <Ionicons name="send" size={normalize(18)} color="#fff" />
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
    paddingVertical: 10,
  },
  backBtn: {
    width: normalize(36),
    height: normalize(36),
    borderRadius: normalize(18),
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: "#fff",
    fontSize: normalize(17),
    fontFamily: "Comfortaa_700Bold",
  },

  chatContainer: { flex: 1 },
  messageList: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: normalize(90),
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
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  myMessageBubble: { marginLeft: "18%" },
  otherMessageBubble: { marginRight: "18%" },

  username: {
    fontFamily: "Comfortaa_700Bold",
    marginBottom: 2,
    fontSize: normalize(11),
  },
  messageText: {
    fontSize: normalize(14.5),
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
    fontSize: normalize(14),
  },
  sendBtn: {
    width: normalize(40),
    height: normalize(40),
    borderRadius: normalize(20),
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  reportButton: {
    marginTop: 5,
    backgroundColor: "#EF4444",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: "flex-end",
  },
  reportButtonText: {
    color: "#FFF",
    fontSize: normalize(11),
    fontFamily: "Comfortaa_700Bold",
  },
  reportedTag: {
    marginTop: 4,
    alignSelf: "flex-end",
    fontSize: normalize(10.5),
    fontFamily: "Comfortaa_400Regular",
    color: "rgba(248,250,252,0.85)",
  },

  emptyState: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    marginTop: 10,
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalize(16),
    textAlign: "center",
  },
  emptySubtitle: {
    marginTop: 6,
    fontFamily: "Comfortaa_400Regular",
    fontSize: normalize(13),
    textAlign: "center",
  },

  // orbes
  orb: { position: "absolute", opacity: 0.9 },
});
