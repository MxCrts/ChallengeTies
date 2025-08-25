// src/context/ChatContext.tsx
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
  updateDoc,
  doc,
  increment,
} from "firebase/firestore";
import { db, auth } from "../constants/firebase-config";
import { checkForAchievements } from "../helpers/trophiesHelpers";

// On décrit TOUS les champs possibles, y compris ceux des messages système
export interface ChatMessage {
  id: string;
  text: string;
  textKey?: string;
  timestamp: any; // Firestore Timestamp | Date | number | null
  userId: string;
  username: string;
  avatar?: string;
  reported?: boolean;
  type?: "system" | "text";
  systemType?: "welcome" | string;
  pinned?: boolean;
  centered?: boolean;
  style?: string;
}

interface ChatContextType {
  messages: ChatMessage[];
  sendMessage: (challengeId: string, text: string) => Promise<void>;
  fetchMessages: (challengeId: string) => () => void;
  loadingMessages: boolean;
}

const ChatContext = createContext<ChatContextType | null>(null);

// helper robuste pour normaliser les timestamps
const toDateSafe = (ts: any): Date => {
  if (!ts) return new Date(0);
  if (ts instanceof Date) return ts;
  if (typeof ts?.toDate === "function") return ts.toDate(); // Firestore Timestamp
  if (typeof ts === "number") return new Date(ts);
  return new Date(0);
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(true);

  const fetchMessages = useCallback((challengeId: string) => {
    const messagesRef = collection(db, "chats", challengeId, "messages");
    // IMPORTANT : on ne filtre pas par type → on récupère aussi les messages système
const q = query(messagesRef);

    setLoadingMessages(true);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: ChatMessage[] = snapshot.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            text: data.text ?? "",
            textKey: data.textKey,
            userId: data.userId ?? "",
            username: data.username ?? "",
            avatar: data.avatar ?? "",
            reported: !!data.reported,
            type: data.type,
            systemType: data.systemType,
            pinned: !!data.pinned,
            centered: !!data.centered,
            style: data.style,
            // on garde le brut pour l’écran (il re-triera s’il veut),
            // mais on expose aussi une Date utilisable (toDateSafe).
            timestamp: data.timestamp || data.createdAt || null,
          };
        });

        setMessages(fetched);
        setLoadingMessages(false);
      },
      (error) => {
        console.error("Error fetching messages:", error);
        setLoadingMessages(false);
      }
    );

    return unsubscribe;
  }, []);

  const sendMessage = useCallback(async (challengeId: string, text: string) => {
    if (!auth.currentUser) throw new Error("User not authenticated.");

    const { uid, displayName, photoURL } = auth.currentUser;
    const messageRef = collection(db, "chats", challengeId, "messages");

    await addDoc(messageRef, {
      text,
      userId: uid,
      username: displayName || "Anonymous",
      avatar: photoURL || "",
      reported: false,
      type: "text",
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp(),
    });

    // compteur utilisateur + trophées
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, { messageSent: increment(1) });
    await checkForAchievements(uid);
  }, []);

  return (
    <ChatContext.Provider
      value={{ messages, sendMessage, fetchMessages, loadingMessages }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = (challengeId: string) => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within a ChatProvider");

  const { fetchMessages, ...rest } = ctx;

  useEffect(() => {
    if (!challengeId) return;
    const unsub = fetchMessages(challengeId);
    return () => unsub();
  }, [challengeId, fetchMessages]);

  return rest;
};
