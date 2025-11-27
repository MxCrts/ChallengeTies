import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  memo,
  useContext,
} from "react";
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
  Keyboard,
} from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { auth, db } from "../../constants/firebase-config";
import { useChat } from "../../context/ChatContext";
import { useTheme } from "../../context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import designSystem, { Theme } from "../../theme/designSystem";
import { updateDoc, doc, getDoc } from "firebase/firestore";
import ChatWelcomeModal from "../../components/ChatWelcomeModal";
import BannerSlot from "@/components/BannerSlot";
import { useAdsVisibility } from "../../src/context/AdsVisibilityContext";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { useToast } from "@/src/ui/Toast";
import { tap, success, warning } from "@/src/utils/haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SPACING = 18;
const SLOWMODE_MS = 2500; // anti-flood
const REPLY_EXCERPT_MAX = 80;

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
  gradientContainer: {
    backgroundColor: currentTheme.colors.cardBackground + "00",
  },
  headerGradient: {
    colors: [currentTheme.colors.primary, currentTheme.colors.secondary] as const,
  },
  headerTitle: { color: "#FFFFFF" },
  backButtonIcon: { color: "#FFFFFF" },

  messageList: { backgroundColor: "transparent" },

  myMessageBubble: {
    borderColor: isDarkMode
      ? "rgba(255,255,255,0.14)"
      : "rgba(0,0,0,0.08)",
  },
  otherMessageBubble: {
    borderColor: isDarkMode
      ? "rgba(255,255,255,0.14)"
      : "rgba(0,0,0,0.08)",
  },

  messageText: {
    color: isDarkMode ? currentTheme.colors.textPrimary : "#222222",
  },
  username: { color: currentTheme.colors.secondary },

  inputWrapper: {
    backgroundColor: isDarkMode
      ? "rgba(255,255,255,0.06)"
      : "rgba(0,0,0,0.04)",
    borderTopColor: isDarkMode
      ? "rgba(255,255,255,0.14)"
      : "rgba(0,0,0,0.08)",
  },
  input: {
    borderColor: isDarkMode
      ? "rgba(255,255,255,0.14)"
      : "rgba(0,0,0,0.08)",
    backgroundColor: isDarkMode
      ? "rgba(255,255,255,0.04)"
      : "rgba(0,0,0,0.03)",
    color: isDarkMode ? currentTheme.colors.textPrimary : "#000000",
    placeholderTextColor: isDarkMode
      ? "rgba(255,255,255,0.6)"
      : "rgba(0,0,0,0.45)",
  },
  sendButtonIcon: { color: "#FFFFFF" },
  reportButton: { backgroundColor: currentTheme.colors.error },
  reportButtonText: { color: "#FFFFFF" },
  avatarIcon: { color: currentTheme.colors.secondary },
});

interface ChatMessage {
  id: string;
  text: string;
  textKey?: string;
  timestamp: Date | { toMillis?: () => number } | number;
  userId: string;
  username: string;
  avatar: string;
  reported: boolean;
  type?: "system" | "text";
  systemType?: "welcome" | string;
  pinned?: boolean;
  centered?: boolean;
  style?: string;
}

type ReplyContext = {
  id: string;
  username: string;
  text: string;
} | null;

/** Utils */
const toMs = (ts: any) => {
  if (!ts) return 0;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === "number") return ts;
  return typeof ts?.toMillis === "function" ? ts.toMillis() : 0;
};

/** MessageItem optimisé (memo) */
const MessageItem = memo(function MessageItem({
  item,
  isDarkMode,
  currentTheme,
  dynamicStyles,
  t,
  challengeId,
  onReply,
  showToast,
}: {
  item: ChatMessage;
  isDarkMode: boolean;
  currentTheme: Theme;
  dynamicStyles: ReturnType<typeof getDynamicStyles>;
  t: (k: string, o?: any) => string;
  challengeId: string;
  onReply: (ctx: ReplyContext) => void;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}) {
  // Branche système : message d'accueil
  if (item.type === "system" && item.systemType === "welcome") {
    const body = item.textKey ? t(item.textKey) : item.text || "";
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
              {
                color: isDarkMode
                  ? currentTheme.colors.textPrimary
                  : "#222222",
              },
            ]}
          >
            {body}
          </Text>
        </View>
      </View>
    );
  }

  const isMyMessage = item.userId === auth.currentUser?.uid;

  const myBubbleColors: [string, string] = useMemo(
    () => [currentTheme.colors.primary, currentTheme.colors.secondary],
    [currentTheme.colors.primary, currentTheme.colors.secondary]
  );

  const otherBubbleColors: [string, string] = useMemo(
    () =>
      isDarkMode
        ? ["rgba(255,255,255,0.10)", "rgba(255,255,255,0.03)"]
        : ["rgba(0,0,0,0.05)", "rgba(0,0,0,0.02)"],
    [isDarkMode]
  );

  const borderClr = useMemo(
    () => (isDarkMode ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)"),
    [isDarkMode]
  );

  const handleReportMessage = useCallback(async () => {
    if (item.reported) return; // idempotent
    tap();
    try {
      const messageRef = doc(db, "chats", challengeId, "messages", item.id);
      await updateDoc(messageRef, { reported: true });
      success();
      showToast(
        t("messageReported", {
          defaultValue: "Message signalé à la modération.",
        }),
        "success"
      );
    } catch (error) {
      console.error("Erreur report:", error);
      warning();
      showToast(
        t("reportMessageFailed", {
          defaultValue:
            "Impossible de signaler ce message pour le moment. Réessaie plus tard.",
        }),
        "error"
      );
    }
  }, [challengeId, item.id, item.reported, t, showToast]);

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

      <TouchableOpacity
        activeOpacity={0.95}
        delayLongPress={250}
        onLongPress={() => {
          if (isMyMessage) return; // on ne répond pas à soi-même
          Haptics.selectionAsync().catch(() => {});
          onReply({ id: item.id, username: item.username, text: item.text });
        }}
        accessibilityLabel={t("challengeChat.longPressReply", {
          defaultValue: "Répondre à ce message",
        })}
        accessibilityRole="button"
      >
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
              isMyMessage ? { color: "#FFFFFF" } : dynamicStyles.messageText,
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
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
});

export default function ChallengeChat() {
  const { t } = useTranslation();
  const { show: showToast } = useToast();
  const { id: challengeIdParam, title: challengeTitleParam } =
    useLocalSearchParams();
  const challengeId = Array.isArray(challengeIdParam)
    ? challengeIdParam[0]
    : challengeIdParam;
  const navigation = useNavigation();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  const dynamicStyles = useMemo(
    () => getDynamicStyles(currentTheme, isDarkMode),
    [currentTheme, isDarkMode]
  );

  const [composerHeight, setComposerHeight] = useState(SPACING * 4);
  const { messages, sendMessage } = useChat(challengeId as string);
  const [isDuoChat, setIsDuoChat] = useState<boolean>(false);
  const [newMessage, setNewMessage] = useState("");
  const [isListReady, setIsListReady] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const insets = useSafeAreaInsets();
  const { showBanners } = useAdsVisibility();
  const tabBarHeight = (useContext(BottomTabBarHeightContext) ?? 0) as number;
  const [adHeight, setAdHeight] = useState<number>(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const lastSentRef = useRef<number>(0);
  const [cooldownLeft, setCooldownLeft] = useState<number>(0);
  const [replyTo, setReplyTo] = useState<ReplyContext>(null);

  const clearReply = useCallback(() => setReplyTo(null), []);
  const excerpt = useCallback((s: string) => {
    const one = (s || "").replace(/\s+/g, " ").trim();
    return one.length > REPLY_EXCERPT_MAX
      ? one.slice(0, REPLY_EXCERPT_MAX - 1) + "…"
      : one;
  }, []);

  // Tick du slowmode (sans timer permanent)
  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const id = setInterval(() => {
      setCooldownLeft((m) => Math.max(0, m - 200));
    }, 200);
    return () => clearInterval(id);
  }, [cooldownLeft]);

  useEffect(() => {
    const sh = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setIsKeyboardVisible(true)
    );
    const hh = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setIsKeyboardVisible(false)
    );
    return () => {
      sh.remove();
      hh.remove();
    };
  }, []);

  // messages triés: pinned d'abord, puis timestamp asc
  const sortedMessages = useMemo<ChatMessage[]>(() => {
    const arr = (Array.isArray(messages) ? messages : []) as ChatMessage[];
    return arr.slice().sort((a, b) => {
      const pa = a?.pinned ? 1 : 0;
      const pb = b?.pinned ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return toMs(a.timestamp) - toMs(b.timestamp);
    });
  }, [messages]);

  // Fallback welcome local si rien dans Firestore
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

  // Vérif règles (inchangé fonctionnellement, juste propre)
  useEffect(() => {
    const checkRulesAcceptance = async () => {
      const userId = auth.currentUser?.uid;
      if (!userId || !challengeId) return;

      const acceptanceRef = doc(
        db,
        `users/${userId}/acceptedChatRules`,
        challengeId as string
      );
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

  // 🔎 Détection robuste si le thread est un chat de DUO
  useEffect(() => {
    const run = async () => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid || !challengeId) {
          setIsDuoChat(false);
          return;
        }

        // 1) On regarde d'abord dans mes CurrentChallenges (source de vérité locale)
        const meRef = doc(db, "users", uid);
        const meSnap = await getDoc(meRef);
        let duo = false;
        if (meSnap.exists()) {
          const data = meSnap.data() as any;
          const arr: any[] = Array.isArray(data.CurrentChallenges)
            ? data.CurrentChallenges
            : [];
          const found = arr.find((c) => {
            const cid = c?.challengeId ?? c?.id;
            return String(cid) === String(challengeId);
          });
          duo = !!found?.duo;
        }

        // 2) Fallback : si le doc de chat porte un flag isDuoThread
        if (!duo) {
          const chatRef = doc(db, "chats", String(challengeId));
          const chatSnap = await getDoc(chatRef);
          if (chatSnap.exists()) {
            const cdata = chatSnap.data() as any;
            if (typeof cdata?.isDuoThread === "boolean") {
              duo = cdata.isDuoThread;
            }
          }
        }

        setIsDuoChat(duo);
      } catch {
        setIsDuoChat(false);
      }
    };
    run();
  }, [challengeId]);

  const handleSend = useCallback(async () => {
    const content = newMessage.trim();
    if (!content) return;

    const now = Date.now();
    const elapsed = now - lastSentRef.current;
    if (elapsed < SLOWMODE_MS) {
      const left = SLOWMODE_MS - elapsed;
      setCooldownLeft(left);
      warning();
      showToast(
        t("challengeChat.slowmodeShort", {
          defaultValue: "Ralentis un peu, tu pourras renvoyer dans un instant 😉",
        }),
        "info"
      );
      return;
    }

    try {
      const decorated = replyTo
        ? `↩️ @${replyTo.username}: “${excerpt(
            replyTo.text
          )}”\n${content}`
        : content;

      // Passage du flag isDuo pour tes métriques / succès
      await sendMessage(challengeId as string, decorated, { isDuo: isDuoChat });

      lastSentRef.current = now;
      setCooldownLeft(SLOWMODE_MS);
      setReplyTo(null);
      setNewMessage("");

      requestAnimationFrame(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      });
    } catch (error) {
      console.error("Error sending message:", error);
      warning();
      showToast(
        t("errorSendingMessage", {
          defaultValue:
            "Message non envoyé. Vérifie ta connexion et réessaie.",
        }),
        "error"
      );
    }
  }, [
    newMessage,
    challengeId,
    sendMessage,
    t,
    replyTo,
    excerpt,
    isDuoChat,
    showToast,
  ]);

  // Auto-scroll quand messages prêts
  useEffect(() => {
    if (finalMessages.length > 0 && isListReady) {
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [finalMessages.length, isListReady]);

  const handleListLayout = useCallback(() => {
    if (finalMessages.length > 0 && !isListReady) {
      flatListRef.current?.scrollToEnd({ animated: false });
      setIsListReady(true);
    }
  }, [finalMessages.length, isListReady]);

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <MessageItem
        item={item}
        isDarkMode={isDarkMode}
        currentTheme={currentTheme}
        dynamicStyles={dynamicStyles}
        t={t as any}
        challengeId={challengeId as string}
        onReply={(ctx) => setReplyTo(ctx)}
        showToast={showToast}
      />
    ),
    [isDarkMode, currentTheme, dynamicStyles, t, challengeId, showToast]
  );

  const headerGradientColors = dynamicStyles.headerGradient.colors;
  const placeholderColor = dynamicStyles.input.placeholderTextColor;
  const inputBorderColor = dynamicStyles.input.borderColor;
  const inputBg = dynamicStyles.input.backgroundColor;
  const inputTextColor = dynamicStyles.input.color;
  const backIconColor = dynamicStyles.backButtonIcon.color;
  const sendIconColor = dynamicStyles.sendButtonIcon.color;

  const challengeTitle =
    typeof challengeTitleParam === "string"
      ? challengeTitleParam
      : challengeTitleParam?.[0] || "";

  const canSend = newMessage.trim().length > 0;
  const showAds = !!showBanners;
  const showBanner = useMemo(
    () => showAds && !isKeyboardVisible,
    [showAds, isKeyboardVisible]
  );

  // Offsets bas unifiés (safe-area + tabbar + bannière)
  const bottomUIOffset = (tabBarHeight || 0) + (insets.bottom || 0);
  const bannerOffset = showBanner ? adHeight + 6 : 0; // petite respiration
  const composerBottomSpace = bottomUIOffset + bannerOffset;

  const cooldownSeconds = Math.ceil(cooldownLeft / 1000);

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView style={[styles.container, dynamicStyles.container]}>
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle={isDarkMode ? "light-content" : "dark-content"}
        />

        {/* Fond gradient + orbes */}
        <LinearGradient
          colors={[
            currentTheme.colors.background,
            currentTheme.colors.cardBackground + "F0",
          ]}
          style={StyleSheet.absoluteFill}
        />
        <OrbBackground theme={currentTheme} />

        <ChatWelcomeModal
          chatId={challengeId as string}
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
        />

        {/* Header */}
        <LinearGradient
          colors={headerGradientColors}
          style={[
            styles.header,
            {
              paddingTop: insets.top,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: isDarkMode
                ? "rgba(255,255,255,0.12)"
                : "rgba(0,0,0,0.08)",
              shadowOpacity: 0,
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
              color={backIconColor}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, dynamicStyles.headerTitle]}>
            {challengeTitle || t("challengeChat.defaultTitle")}
            {isDuoChat ? " · Duo" : ""}
          </Text>
          <View style={{ width: normalizeSize(36) }} />
        </LinearGradient>

        <KeyboardAvoidingView
          style={styles.chatContainer}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={insets.top + normalizeSize(56)}
        >
          <FlatList
            ref={flatListRef}
            data={finalMessages}
            renderItem={renderMessage}
            keyExtractor={keyExtractor}
            contentContainerStyle={[
              styles.messageList,
              dynamicStyles.messageList,
              {
                paddingBottom: composerHeight + SPACING + composerBottomSpace,
              },
            ]}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            updateCellsBatchingPeriod={50}
            windowSize={7}
            onLayout={handleListLayout}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={
              Platform.OS === "ios" ? "interactive" : "on-drag"
            }
          />

          {/* Barre d’entrée glass premium */}
          <View
            style={[
              styles.inputWrapper,
              dynamicStyles.inputWrapper,
              {
                paddingBottom: insets.bottom || SPACING,
                marginBottom: bannerOffset,
              },
            ]}
            onLayout={(e) => setComposerHeight(e.nativeEvent.layout.height)}
          >
            {!!replyTo && (
              <View
                style={[
                  styles.replyPreview,
                  {
                    borderColor: inputBorderColor,
                    backgroundColor: inputBg,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.replyTitle,
                      { color: currentTheme.colors.secondary },
                    ]}
                  >
                    ↩️{" "}
                    {t("challengeChat.replyingTo", {
                      defaultValue: "En réponse à",
                    })}{" "}
                    @{replyTo.username}
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={[
                      styles.replyExcerpt,
                      { color: dynamicStyles.messageText.color },
                    ]}
                  >
                    {replyTo.text}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={clearReply}
                  accessibilityLabel={t("common.close", {
                    defaultValue: "Fermer",
                  })}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.replyClose}
                >
                  <Ionicons
                    name="close"
                    size={normalizeSize(16)}
                    color={dynamicStyles.messageText.color as string}
                  />
                </TouchableOpacity>
              </View>
            )}

            <TextInput
              style={[
                styles.input,
                {
                  borderColor: inputBorderColor,
                  backgroundColor: inputBg,
                  color: inputTextColor,
                },
              ]}
              placeholder={t("challengeChat.placeholder")}
              placeholderTextColor={placeholderColor as string}
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              accessibilityLabel={t("challengeChat.inputA11yLabel")}
              accessibilityHint={t("challengeChat.inputA11yHint")}
              testID="message-input"
              returnKeyType="send"
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />

            <LinearGradient
              colors={[
                currentTheme.colors.secondary,
                currentTheme.colors.primary,
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.sendButton,
                (!canSend || cooldownLeft > 0) && { opacity: 0.5 },
              ]}
            >
              <TouchableOpacity
                onPress={handleSend}
                activeOpacity={0.85}
                disabled={!canSend || cooldownLeft > 0}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel={t("challengeChat.sendA11yLabel", {
                  defaultValue: "Envoyer le message",
                })}
                accessibilityHint={
                  cooldownLeft > 0
                    ? t("challengeChat.slowmodeHint", {
                        defaultValue:
                          "Patiente un instant avant d’envoyer un nouveau message.",
                      })
                    : undefined
                }
              >
                <Ionicons
                  name="send"
                  size={normalizeSize(18)}
                  color={sendIconColor}
                />
              </TouchableOpacity>
            </LinearGradient>
          </View>

          {cooldownLeft > 0 && (
            <View style={{ alignItems: "center", marginBottom: 4 }}>
              <Text
                style={[
                  styles.cooldownText,
                  {
                    color: isDarkMode
                      ? "rgba(255,255,255,0.7)"
                      : "rgba(0,0,0,0.6)",
                  },
                ]}
              >
                {t("challengeChat.slowmodeCountdown", {
                  defaultValue:
                    "Patiente encore {{s}}s avant le prochain message",
                  s: cooldownSeconds,
                })}
              </Text>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Hairline au-dessus de la bannière dockée */}
      {showBanner && adHeight > 0 && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: (tabBarHeight as number) + insets.bottom + adHeight + 6,
            height: StyleSheet.hairlineWidth,
            backgroundColor: isDarkMode
              ? "rgba(255,255,255,0.12)"
              : "rgba(0,0,0,0.08)",
            zIndex: 9999,
          }}
        />
      )}

      {/* Bannière dockée bas (masquée si clavier ouvert) */}
      {showBanner && (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: (tabBarHeight as number) + insets.bottom,
            alignItems: "center",
            backgroundColor: "transparent",
            paddingBottom: 6,
            zIndex: 100,
          }}
          pointerEvents="box-none"
        >
          <BannerSlot docked onHeight={(h) => setAdHeight(h)} />
        </View>
      )}
    </View>
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

  replyPreview: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: normalizeSize(14),
    paddingVertical: normalizeSize(8),
    paddingHorizontal: SPACING * 0.8,
    marginBottom: normalizeSize(8),
  },
  replyTitle: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: normalizeSize(12),
    marginBottom: normalizeSize(4),
  },
  replyExcerpt: {
    fontFamily: "Comfortaa_400Regular",
    fontSize: normalizeSize(12),
    opacity: 0.9,
  },
  replyClose: {
    marginLeft: SPACING,
    paddingTop: normalizeSize(2),
  },

  cooldownText: {
    fontFamily: "Comfortaa_400Regular",
    fontSize: normalizeSize(12),
  },

  // Orbes
  orb: { position: "absolute", opacity: 0.9 },
});
