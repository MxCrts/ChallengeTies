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
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { auth, db } from "../constants/firebase-config";
import { useChat } from "../context/ChatContext";
import designSystem from "../theme/designSystem";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";

import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  updateDoc,
  doc,
} from "firebase/firestore";

const { width } = Dimensions.get("window");
const { theme } = useTheme();
 const isDarkMode = theme === "dark";
 const currentTheme = isDarkMode
   ? designSystem.darkTheme
   : designSystem.lightTheme;

// Interface pour les messages, alignée avec ChatContext.tsx
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
  const [route, setRoute] = useState<any>(null);
  const [navigation, setNavigation] = useState<any>(null);

  // Charger useRoute et useNavigation dynamiquement
  useEffect(() => {
    const loadNavigation = async () => {
      const { useRoute, useNavigation } = await import(
        "@react-navigation/native"
      );
      setRoute(() => useRoute());
      setNavigation(() => useNavigation());
    };
    loadNavigation();
  }, []);

  // Vérifier si route et navigation sont chargés
  if (!route || !navigation) {
    return (
      <View style={styles.container}>
        <Text style={styles.messageText}>Chargement...</Text>
      </View>
    );
  }

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

  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.userId === auth.currentUser?.uid;

    // Fonction pour signaler un message
    const handleReportMessage = async () => {
      try {
        const messageRef = doc(db, "chats", challengeId, "messages", item.id);
        await updateDoc(messageRef, { reported: true });
        Alert.alert(
          t("success"),
          t("messageReported", { defaultValue: "Message signalé." })
        );
      } catch (error) {
        console.error("Erreur lors du signalement du message :", error);
        Alert.alert(
          t("error"),
          t("reportMessageFailed", {
            defaultValue: "Impossible de signaler le message.",
          })
        );
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
          {!isMyMessage && !item.reported && (
            <TouchableOpacity
              style={styles.reportButton}
              onPress={handleReportMessage}
              accessibilityLabel={t("reportMessage", {
                defaultValue: "Signaler ce message",
              })}
            >
              <Text style={styles.reportButtonText}>
                {t("report", { defaultValue: "Signaler" })}
              </Text>
            </TouchableOpacity>
          )}
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
        <Text style={styles.headerTitle}>
          {t("chat.title", { title: challengeTitle })}
        </Text>
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
    backgroundColor: currentTheme.colors.background,
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
     backgroundColor: currentTheme.colors.primary,
    marginLeft: "25%",
  },
  otherMessageBubble: {
    backgroundColor: isDarkMode
     ? currentTheme.colors.cardBackground
     : "#e9ecef",
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
    color: isDarkMode ? "#000000" : "#333",
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
});
