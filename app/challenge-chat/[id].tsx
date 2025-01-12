import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useChat } from "../../context/ChatContext";
import { Ionicons } from "@expo/vector-icons";
import { auth } from "../../constants/firebase-config";

export default function ChallengeChat() {
  const { id: challengeId, title: challengeTitle } = useLocalSearchParams();
  const { messages, sendMessage } = useChat(
    Array.isArray(challengeId) ? challengeId[0] : challengeId
  );
  const [newMessage, setNewMessage] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const handleSend = async () => {
    if (newMessage.trim().length === 0) return;

    try {
      await sendMessage(
        Array.isArray(challengeId) ? challengeId[0] : challengeId,
        newMessage
      );
      setNewMessage("");
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
    const isUserMessage = item.userId === auth.currentUser?.uid;

    return (
      <View
        style={[
          styles.messageContainer,
          isUserMessage
            ? styles.userMessageContainer
            : styles.otherMessageContainer,
        ]}
      >
        {!isUserMessage && (
          <View style={styles.avatarContainer}>
            <Ionicons name="person-circle-outline" size={30} color="#007bff" />
          </View>
        )}
        <View
          style={[
            styles.messageBubble,
            isUserMessage ? styles.userBubble : styles.otherBubble,
          ]}
        >
          {!isUserMessage && (
            <Text style={styles.username}>{item.username}</Text>
          )}
          <Text style={styles.messageText}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{challengeTitle || "Challenge Chat"}</Text>
      </View>
      <Text style={styles.welcomeMessage}>Welcome to the chat!</Text>
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
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type your message..."
          placeholderTextColor="#aaa"
          value={newMessage}
          onChangeText={setNewMessage}
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Ionicons name="send" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f4f8",
  },
  header: {
    padding: 15,
    backgroundColor: "#007bff",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  welcomeMessage: {
    textAlign: "center",
    fontSize: 14,
    color: "#666",
    marginVertical: 10,
  },
  messageList: {
    padding: 10,
    flexGrow: 1,
  },
  messageContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 10,
  },
  userMessageContainer: {
    flexDirection: "row-reverse",
  },
  otherMessageContainer: {
    flexDirection: "row",
  },
  avatarContainer: {
    marginRight: 10,
    alignSelf: "flex-end",
  },
  messageBubble: {
    borderRadius: 20,
    padding: 12,
    maxWidth: "70%",
  },
  userBubble: {
    backgroundColor: "#007bff",
    alignSelf: "flex-end",
  },
  otherBubble: {
    backgroundColor: "#e9ecef",
    alignSelf: "flex-start",
  },
  messageText: {
    fontSize: 16,
    color: "#fff",
  },
  username: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#007bff",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },
  input: {
    flex: 1,
    height: 45,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 25,
    paddingHorizontal: 15,
    backgroundColor: "#f8f9fa",
    marginRight: 10,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: "#007bff",
    borderRadius: 25,
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
