import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "@/constants/firebase-config";
import BackButton from "../components/BackButton";
import { useTranslation } from "react-i18next";

type ReportedMessage = {
  chatId: string;
  messageId: string;
  text: string;
  senderId: string;
  timestamp: any;
};

export default function AdminModerateChats() {
  const { t } = useTranslation();
  const adminUID = "GiN2yTfA7NWISeb4QjXmDPq5TgK2"; // Ton UID admin
  const currentUser = auth.currentUser;

  // Vérifie si l'utilisateur est admin
  if (!currentUser || currentUser.uid !== adminUID) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          {t("accessDenied", {
            defaultValue:
              "Accès refusé. Vous n'êtes pas autorisé à voir cette page.",
          })}
        </Text>
      </View>
    );
  }

  const [reportedMessages, setReportedMessages] = useState<ReportedMessage[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  // Charger tous les messages signalés depuis tous les chats
  useEffect(() => {
    // D'abord, récupère tous les chats
    const chatsRef = collection(db, "challenges");
    const unsubscribeChats = onSnapshot(chatsRef, (chatsSnapshot) => {
      const reportedMessagesList: ReportedMessage[] = [];

      // Pour chaque chat, vérifie les messages signalés
      const chatPromises = chatsSnapshot.docs.map(async (chatDoc) => {
        const chatId = chatDoc.id;
        const messagesRef = collection(db, "chats", chatId, "messages");
        const q = query(messagesRef, where("reported", "==", true));

        return new Promise<void>((resolve) => {
          onSnapshot(q, (messagesSnapshot) => {
            messagesSnapshot.forEach((messageDoc) => {
              const messageData = messageDoc.data();
              reportedMessagesList.push({
                chatId,
                messageId: messageDoc.id,
                text: messageData.text,
                senderId: messageData.senderId,
                timestamp: messageData.timestamp,
              });
            });
            resolve();
          });
        });
      });

      // Une fois tous les messages signalés récupérés, met à jour l'état
      Promise.all(chatPromises).then(() => {
        setReportedMessages(reportedMessagesList);
        setLoading(false);
      });
    });

    return () => unsubscribeChats();
  }, []);

  // Supprimer un message signalé
  const handleDeleteMessage = async (chatId: string, messageId: string) => {
    try {
      const messageRef = doc(db, "chats", chatId, "messages", messageId);
      await deleteDoc(messageRef);
      Alert.alert(
        t("success"),
        t("messageDeleted", { defaultValue: "Message supprimé." })
      );
    } catch (error) {
      console.error("Erreur lors de la suppression du message :", error);
      Alert.alert(
        t("error"),
        t("deleteMessageFailed", {
          defaultValue: "Impossible de supprimer le message.",
        })
      );
    }
  };

  // Ignorer un signalement (remettre reported à false)
  const handleIgnoreReport = async (chatId: string, messageId: string) => {
    try {
      const messageRef = doc(db, "chats", chatId, "messages", messageId);
      await updateDoc(messageRef, { reported: false });
      Alert.alert(
        t("success"),
        t("reportIgnored", { defaultValue: "Signalement ignoré." })
      );
    } catch (error) {
      console.error("Erreur lors de l'ignorance du signalement :", error);
      Alert.alert(
        t("error"),
        t("ignoreReportFailed", {
          defaultValue: "Impossible d'ignorer le signalement.",
        })
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>
          {t("loadingMessages", {
            defaultValue: "Chargement des messages signalés...",
          })}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BackButton />
      <Text style={styles.header}>
        {t("moderateChatsTitle", { defaultValue: "Modérer les messages" })}
      </Text>
      <Text style={styles.description}>
        {t("moderateChatsDescription", {
          defaultValue:
            "Voici la liste des messages signalés. Vous pouvez les supprimer ou ignorer le signalement.",
        })}
      </Text>
      {reportedMessages.length === 0 ? (
        <Text style={styles.noMessagesText}>
          {t("noReportedMessages", { defaultValue: "Aucun message signalé." })}
        </Text>
      ) : (
        <FlatList
          data={reportedMessages}
          keyExtractor={(item) => `${item.chatId}-${item.messageId}`}
          renderItem={({ item }) => (
            <View style={styles.messageCard}>
              <Text style={styles.messageText}>{item.text}</Text>
              <Text style={styles.messageSender}>Sender: {item.senderId}</Text>
              <Text style={styles.messageChat}>Chat: {item.chatId}</Text>
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() =>
                    handleDeleteMessage(item.chatId, item.messageId)
                  }
                >
                  <Text style={styles.buttonText}>
                    {t("delete", { defaultValue: "Supprimer" })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.ignoreButton}
                  onPress={() =>
                    handleIgnoreReport(item.chatId, item.messageId)
                  }
                >
                  <Text style={styles.buttonText}>
                    {t("ignore", { defaultValue: "Ignorer" })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#0F172A",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0F172A",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#FFF",
    textAlign: "center",
    fontFamily: "Comfortaa_400Regular",
  },
  errorText: {
    fontSize: 16,
    color: "#FFF",
    textAlign: "center",
    fontFamily: "Comfortaa_400Regular",
  },
  header: {
    fontSize: 24,
    color: "#FFF",
    marginBottom: 10,
    fontFamily: "Comfortaa_700Bold",
  },
  description: {
    fontSize: 14,
    color: "#FFF",
    marginBottom: 20,
    fontFamily: "Comfortaa_400Regular",
  },
  noMessagesText: {
    fontSize: 16,
    color: "#FFF",
    textAlign: "center",
    marginTop: 20,
    fontFamily: "Comfortaa_400Regular",
  },
  messageCard: {
    backgroundColor: "#1E293B",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  messageText: {
    fontSize: 16,
    color: "#FFF",
    fontFamily: "Comfortaa_400Regular",
    marginBottom: 5,
  },
  messageSender: {
    fontSize: 14,
    color: "#A1A1AA",
    fontFamily: "Comfortaa_400Regular",
    marginBottom: 5,
  },
  messageChat: {
    fontSize: 14,
    color: "#A1A1AA",
    fontFamily: "Comfortaa_400Regular",
    marginBottom: 10,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  deleteButton: {
    backgroundColor: "#EF4444",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  ignoreButton: {
    backgroundColor: "#22C55E",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  buttonText: {
    color: "#FFF",
    fontSize: 14,
    fontFamily: "Comfortaa_700Bold",
  },
});
