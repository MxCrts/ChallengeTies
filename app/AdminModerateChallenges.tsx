import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import {
  collection,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
} from "firebase/firestore";
import { db, auth } from "@/constants/firebase-config";
import BackButton from "../components/BackButton";
import { useTranslation } from "react-i18next";

type Challenge = {
  id: string;
  title: string;
  description: string;
  category: string;
  daysOptions: number[];
  imageUrl: string;
  participantsCount: number;
  createdAt: any;
  creatorId: string;
  chatId: string;
  usersTakingChallenge: string[];
  approved: boolean;
};

export default function AdminModerateChallenges() {
  const { t } = useTranslation();
  const adminUID = "GiN2yTfA7NWISeb4QjXmDPq5TgK2"; // Ton UID
  const currentUser = auth.currentUser;

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

  const [pendingChallenges, setPendingChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const challengesRef = collection(db, "challenges");
    const unsubscribe = onSnapshot(
      challengesRef,
      (snapshot) => {
        const challenges: Challenge[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as Challenge[];
        const pending = challenges.filter((challenge) => !challenge.approved);
        setPendingChallenges(pending);
        setLoading(false);
      },
      (error) => {
        console.error("Erreur lors du chargement des défis :", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleApprove = async (challengeId: string) => {
    try {
      const challengeRef = doc(db, "challenges", challengeId);
      await updateDoc(challengeRef, { approved: true });

      // Mettre à jour le champ createdChallenges de l'utilisateur
      const challengeSnap = await getDoc(doc(db, "challenges", challengeId));
      const challengeData = challengeSnap.data() as Challenge;
      const userRef = doc(db, "users", challengeData.creatorId);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();
      if (userData && userData.createdChallenges) {
        const updatedChallenges = userData.createdChallenges.map((ch: any) =>
          ch.id === challengeId ? { ...ch, approved: true } : ch
        );
        await updateDoc(userRef, { createdChallenges: updatedChallenges });
      }

      Alert.alert(
        t("success"),
        t("challengeApproved", { defaultValue: "Défi approuvé et publié !" })
      );
    } catch (error) {
      console.error("Erreur lors de l'approbation du défi :", error);
      Alert.alert(
        t("error"),
        t("approveChallengeFailed", {
          defaultValue: "Impossible d'approuver le défi.",
        })
      );
    }
  };

  const handleReject = async (challengeId: string) => {
    try {
      const challengeRef = doc(db, "challenges", challengeId);
      const challengeSnap = await getDoc(challengeRef);
      const challengeData = challengeSnap.data() as Challenge;

      // Supprimer le défi de la collection challenges
      await deleteDoc(challengeRef);

      // Supprimer le défi de createdChallenges de l'utilisateur
      const userRef = doc(db, "users", challengeData.creatorId);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();
      if (userData && userData.createdChallenges) {
        const updatedChallenges = userData.createdChallenges.filter(
          (ch: any) => ch.id !== challengeId
        );
        await updateDoc(userRef, { createdChallenges: updatedChallenges });
      }

      Alert.alert(
        t("success"),
        t("challengeRejected", { defaultValue: "Défi rejeté et supprimé." })
      );
    } catch (error) {
      console.error("Erreur lors du rejet du défi :", error);
      Alert.alert(
        t("error"),
        t("rejectChallengeFailed", {
          defaultValue: "Impossible de rejeter le défi.",
        })
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>
          {t("loadingChallenges", {
            defaultValue: "Chargement des défis en attente...",
          })}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BackButton />
      <Text style={styles.header}>
        {t("moderateChallengesTitle", { defaultValue: "Modérer les défis" })}
      </Text>
      <Text style={styles.description}>
        {t("moderateChallengesDescription", {
          defaultValue:
            "Voici la liste des défis en attente d'approbation. Vous pouvez les approuver pour les rendre visibles aux utilisateurs ou les rejeter pour les supprimer.",
        })}
      </Text>
      {pendingChallenges.length === 0 ? (
        <Text style={styles.noChallengesText}>
          {t("noPendingChallenges", { defaultValue: "Aucun défi en attente." })}
        </Text>
      ) : (
        <FlatList
          data={pendingChallenges}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.challengeCard}>
              <Text style={styles.challengeTitle}>{item.title}</Text>
              <Text style={styles.challengeDescription}>
                {item.description}
              </Text>
              <Text style={styles.challengeCategory}>
                {t("category")}:{" "}
                {t(`categories.${item.category}`, {
                  defaultValue: item.category,
                })}
              </Text>
              {item.imageUrl && (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.challengeImage}
                />
              )}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.approveButton}
                  onPress={() => handleApprove(item.id)}
                >
                  <Text style={styles.buttonText}>
                    {t("approve", { defaultValue: "Approuver" })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectButton}
                  onPress={() => handleReject(item.id)}
                >
                  <Text style={styles.buttonText}>
                    {t("reject", { defaultValue: "Rejeter" })}
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
  noChallengesText: {
    fontSize: 16,
    color: "#FFF",
    textAlign: "center",
    marginTop: 20,
    fontFamily: "Comfortaa_400Regular",
  },
  challengeCard: {
    backgroundColor: "#1E293B",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  challengeTitle: {
    fontSize: 18,
    color: "#FFF",
    fontFamily: "Comfortaa_700Bold",
    marginBottom: 5,
  },
  challengeDescription: {
    fontSize: 14,
    color: "#FFF",
    fontFamily: "Comfortaa_400Regular",
    marginBottom: 5,
  },
  challengeCategory: {
    fontSize: 14,
    color: "#FFF",
    fontFamily: "Comfortaa_400Regular",
    marginBottom: 5,
  },
  challengeImage: {
    width: "100%",
    height: 150,
    borderRadius: 10,
    marginBottom: 10,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  approveButton: {
    backgroundColor: "#22C55E",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  rejectButton: {
    backgroundColor: "#EF4444",
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
