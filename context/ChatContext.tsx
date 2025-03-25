import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDocs,
  updateDoc,
  doc,
  increment,
} from "firebase/firestore";
import { db, auth } from "../constants/firebase-config";
import { checkForAchievements } from "../helpers/trophiesHelpers";

interface Message {
  id: string;
  text: string;
  timestamp: Date;
  userId: string;
  username: string;
  avatar: string;
}

interface ChatContextType {
  messages: Message[];
  sendMessage: (challengeId: string, text: string) => Promise<void>;
  fetchMessages: (challengeId: string) => () => void;
  loadingMessages: boolean;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(true);

  const fetchMessages = useCallback((challengeId: string) => {
    const messagesRef = collection(db, "chats", challengeId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    setLoadingMessages(true);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedMessages = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date(),
        })) as Message[];
        setMessages(fetchedMessages);
        setLoadingMessages(false);
      },
      (error) => {
        console.error("Error fetching messages:", error);
        setLoadingMessages(false);
      }
    );

    return unsubscribe;
  }, []);

  /**
   * Envoi un message et incrémente le compteur global des messages envoyés pour l'utilisateur.
   */
  const sendMessage = async (challengeId: string, text: string) => {
    if (!auth.currentUser) {
      throw new Error("User not authenticated.");
    }
    const { uid, displayName, photoURL } = auth.currentUser;
    const messageRef = collection(db, "chats", challengeId, "messages");

    // Envoi du message
    await addDoc(messageRef, {
      text,
      timestamp: serverTimestamp(),
      userId: uid,
      username: displayName || "Anonymous",
      avatar: photoURL || "",
    });

    // Incrémente le compteur de messages dans le document utilisateur
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
      messageSent: increment(1),
    });

    // Optionnel : déclencher une vérification des succès (pour "messageSent")
    await checkForAchievements(uid);
  };

  return (
    <ChatContext.Provider
      value={{ messages, sendMessage, fetchMessages, loadingMessages }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = (challengeId: string) => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }

  const { fetchMessages, ...rest } = context;

  useEffect(() => {
    if (!challengeId) return;

    const unsubscribe = fetchMessages(challengeId);
    return () => unsubscribe();
  }, [challengeId, fetchMessages]);

  return rest;
};
