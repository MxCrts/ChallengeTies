import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp, FadeOutDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { doc, getDoc, updateDoc, serverTimestamp, setDoc, } from "firebase/firestore";
import { db, auth } from "../constants/firebase-config";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import designSystem from "../theme/designSystem";
import ConfettiCannon from "react-native-confetti-cannon";
import * as Notifications from "expo-notifications";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const normalize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

interface InvitationModalProps {
  visible: boolean;
  inviteId: string | null;
  challengeId: string;
  onClose: () => void;
  clearInvitation: () => void;
}

export default function InvitationModal({
  visible,
  inviteId,
  challengeId,
  onClose,
  clearInvitation,
}: InvitationModalProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const isDarkMode = theme === "dark";
  const currentTheme = isDarkMode
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  const [loading, setLoading] = useState(true);
  const [inviterUsername, setInviterUsername] = useState("");
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const confettiRef = React.useRef<ConfettiCannon | null>(null);

  useEffect(() => {
    if (!inviteId) return;

    const fetchInvite = async () => {
      try {
        const inviteSnap = await getDoc(doc(db, "invitations", inviteId));
        if (inviteSnap.exists()) {
          const data = inviteSnap.data();
          setInviterUsername(data.inviterUsername || "Unknown");
          setSelectedDays(data.days || null);
        }
      } catch (error) {
        console.error("Erreur récupération invitation :", error);
      } finally {
        setLoading(false);
      }
    };

    fetchInvite();
  }, [inviteId]);

  const proceedAccept = async (inviterId, inviteeId, days) => {
  const inviterRef = doc(db, "users", inviterId, "CurrentChallenges", challengeId);
  const inviteeRef = doc(db, "users", inviteeId, "CurrentChallenges", challengeId);

  // ➜ Vérifier solo A
  const inviterSnap = await getDoc(inviterRef);
  const inviterIsSolo = inviterSnap.exists() && !inviterSnap.data()?.duo;

  if (inviterIsSolo) {
    await updateDoc(inviterRef, { deletedAt: serverTimestamp() }); // ou deleteDoc si tu préfères hard delete
  }

  // ➜ Créer ou recréer A
  await updateDoc(inviterRef, {
    selectedDays: days,
    completedDays: 0,
    streak: 0,
    duo: true,
    updatedAt: serverTimestamp(),
  }).catch(async () => {
    await setDoc(inviterRef, {
      selectedDays: days,
      completedDays: 0,
      streak: 0,
      duo: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  // ➜ Créer ou recréer B
  await updateDoc(inviteeRef, {
    selectedDays: days,
    completedDays: 0,
    streak: 0,
    duo: true,
    updatedAt: serverTimestamp(),
  }).catch(async () => {
    await setDoc(inviteeRef, {
      selectedDays: days,
      completedDays: 0,
      streak: 0,
      duo: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  // ➜ Marquer l’invitation comme acceptée
  await updateDoc(doc(db, "invitations", inviteId), {
    status: "accepted",
    updatedAt: serverTimestamp(),
  });

  // ➜ Notif pour A
  await Notifications.scheduleNotificationAsync({
    content: {
      title: t("notifications.title"),
      body: t("notifications.invitationAccepted", {
        username: inviterUsername,
      }),
    },
    trigger: null,
  });

  confettiRef.current?.start();
  clearInvitation();
  onClose();
};


  const handleAccept = async () => {
  if (!inviteId || !auth.currentUser?.uid) return;

  setLoading(true);

  try {
    // 1. Récupérer l'invitation
    const inviteSnap = await getDoc(doc(db, "invitations", inviteId));
    if (!inviteSnap.exists()) throw new Error("Invitation introuvable");
    const data = inviteSnap.data();
    const inviterId = data?.inviterId;
    const inviteeId = auth.currentUser.uid;
    const days = data?.days;

    // 2. Vérifier si B est déjà dans le challenge en solo
    const inviteeChallengeRef = doc(
      db, "users", inviteeId, "CurrentChallenges", challengeId
    );
    const inviteeChallengeSnap = await getDoc(inviteeChallengeRef);
    const inviteeIsSolo = inviteeChallengeSnap.exists() && !inviteeChallengeSnap.data()?.duo;

    if (inviteeIsSolo) {
      // 3. Prompt confirmation UX
      Alert.alert(
        t("confirmDuoTitle", "Accept as Duo?"),
        t(
          "confirmDuoMessage",
          "If you accept, your current solo progress will be lost and you will restart this challenge as a duo."
        ),
        [
          { text: t("cancel", "Cancel"), style: "cancel" },
          {
            text: t("confirm", "Confirm"),
            onPress: async () => {
              await proceedAccept(inviterId, inviteeId, days);
            },
          },
        ],
        { cancelable: true }
      );
      setLoading(false);
      return;
    }

    // 4. Pas déjà en solo ➜ accept direct
    await proceedAccept(inviterId, inviteeId, days);

  } catch (err) {
    console.error("Erreur acceptation invitation:", err);
  } finally {
    setLoading(false);
  }
};


  const handleRefuse = async () => {
    if (!inviteId) return;

    try {
      await updateDoc(doc(db, "invitations", inviteId), {
        status: "refused",
        updatedAt: serverTimestamp(),
      });

      await Notifications.scheduleNotificationAsync({
        content: {
          title: t("notifications.title"),
          body: t("notifications.invitationRefused", {
            username: inviterUsername,
          }),
        },
        trigger: null,
      });

      clearInvitation();
      onClose();
    } catch (error) {
      console.error("Erreur refus invitation :", error);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalContainer}>
        <Animated.View
          entering={FadeInUp.springify()}
          exiting={FadeOutDown.duration(300)}
          style={[
            styles.modalContent,
            { backgroundColor: currentTheme.colors.cardBackground },
          ]}
        >
          <ConfettiCannon
            ref={confettiRef}
            count={80}
            origin={{ x: -10, y: 0 }}
            autoStart={false}
          />

          {loading ? (
            <ActivityIndicator
              size="large"
              color={currentTheme.colors.primary}
            />
          ) : (
            <>
              <Text
                style={[
                  styles.modalTitle,
                  { color: currentTheme.colors.secondary },
                ]}
              >
                {t("notifications.invitationReceivedTitle", "New Invitation")}
              </Text>
              <Text
                style={[
                  styles.modalText,
                  { color: currentTheme.colors.textPrimary },
                ]}
              >
                {t("notifications.invitationMessage", {
                  username: inviterUsername,
                  count: selectedDays || 0,
                })}
              </Text>

              <View style={styles.buttonsContainer}>
                <TouchableOpacity onPress={handleAccept} style={styles.button}>
                  <LinearGradient
                    colors={[
                      currentTheme.colors.primary,
                      currentTheme.colors.secondary,
                    ]}
                    style={styles.buttonGradient}
                  >
                    <Text style={styles.buttonText}>
                      {t("notifications.accept", "Accept")}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleRefuse} style={styles.button}>
                  <LinearGradient
                    colors={[currentTheme.colors.error, "#FF6B6B"]}
                    style={styles.buttonGradient}
                  >
                    <Text style={styles.buttonText}>
                      {t("notifications.refuse", "Refuse")}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: normalize(20),
  },
  modalContent: {
    width: "100%",
    borderRadius: normalize(20),
    padding: normalize(20),
    alignItems: "center",
  },
  modalTitle: {
    fontSize: normalize(20),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalize(12),
    textAlign: "center",
  },
  modalText: {
    fontSize: normalize(16),
    fontFamily: "Comfortaa_400Regular",
    marginBottom: normalize(20),
    textAlign: "center",
  },
  buttonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  button: {
    flex: 1,
    marginHorizontal: normalize(6),
    borderRadius: normalize(10),
    overflow: "hidden",
  },
  buttonGradient: {
    paddingVertical: normalize(12),
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: normalize(16),
    fontFamily: "Comfortaa_700Bold",
  },
});
