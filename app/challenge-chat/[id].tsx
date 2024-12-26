import React, { useState } from "react";
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
import { useRoute } from "@react-navigation/native";
import { useChat } from "../../context/ChatContext";
import { Ionicons } from "@expo/vector-icons";

type RouteParams = {
  id: string; // Challenge ID
  title: string; // Challenge Title
};

export default function ChallengeChat() {
  const route = useRoute();
  const { id: challengeId, title: challengeTitle } =
    route.params as RouteParams; // Define the type explicitly

  const { messages, sendMessage } = useChat(challengeId); // Pass challengeId to useChat
  const [newMessage, setNewMessage] = useState("");

  const handleSend = async () => {
    if (newMessage.trim().length === 0) return;

    try {
      await sendMessage(challengeId, newMessage);
      setNewMessage(""); // Clear input field after sending
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const renderMessage = ({ item }: { item: any }) => (
    <View style={styles.messageContainer}>
      <View style={styles.avatarContainer}>
        <Ionicons name="person-circle-outline" size={40} color="#007bff" />
      </View>
      <View style={styles.messageContent}>
        <Text style={styles.messageUsername}>{item.username}</Text>
        <Text style={styles.messageText}>{item.text}</Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>{challengeTitle}</Text>
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
      />
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
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
    backgroundColor: "#f8f9fa",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 10,
  },
  messageList: {
    padding: 10,
  },
  messageContainer: {
    flexDirection: "row",
    marginBottom: 10,
    alignItems: "flex-start",
  },
  avatarContainer: {
    marginRight: 10,
  },
  messageContent: {
    backgroundColor: "#e9ecef",
    borderRadius: 10,
    padding: 10,
    maxWidth: "80%",
  },
  messageUsername: {
    fontWeight: "bold",
    marginBottom: 5,
  },
  messageText: {
    color: "#343a40",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 20,
    paddingHorizontal: 10,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: "#007bff",
    borderRadius: 20,
    padding: 10,
  },
});
