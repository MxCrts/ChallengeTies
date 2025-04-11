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
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db, auth } from "../constants/firebase-config";
import BackButton from "../components/BackButton";

// Définition du type Feature pour typer les données des propositions
type Feature = {
  id: string;
  title?: string;
  description?: string;
  votes?: number;
  approved?: boolean;
};

export default function AdminFeatures() {
  // Remplacer "TON_UID_ADMIN" par ton UID Firebase réel
  const adminUID = "mAEyXdH3J5bcBt6SxZP7lWz0EW43";
  const currentUser = auth.currentUser;

  if (!currentUser || currentUser.uid !== adminUID) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          Accès refusé. Vous n'êtes pas autorisé à voir cette page.
        </Text>
      </View>
    );
  }

  const [pendingFeatures, setPendingFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const featuresRef = collection(db, "polls", "new-features", "features");
    const unsubscribe = onSnapshot(
      featuresRef,
      (snapshot) => {
        const features: Feature[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Feature;
          return {
            id: docSnap.id,
            ...data,
          };
        });
        // Filtrer les propositions non approuvées (approved !== true)
        const pending = features.filter((feature) => feature.approved !== true);
        setPendingFeatures(pending);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching features", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleApprove = async (featureId: string) => {
    try {
      const featureRef = doc(
        db,
        "polls",
        "new-features",
        "features",
        featureId
      );
      await updateDoc(featureRef, { approved: true });
      Alert.alert("Succès", "La proposition a été approuvée !");
    } catch (error) {
      console.error("Error approving feature:", error);
      Alert.alert("Erreur", "Impossible d'approuver la proposition.");
    }
  };

  const handleReject = async (featureId: string) => {
    try {
      const featureRef = doc(
        db,
        "polls",
        "new-features",
        "features",
        featureId
      );
      await deleteDoc(featureRef);
      Alert.alert("Proposition Rejetée", "La proposition a été supprimée.");
    } catch (error) {
      console.error("Error rejecting feature:", error);
      Alert.alert("Erreur", "Impossible de rejeter la proposition.");
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>
          Chargement des propositions en attente...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BackButton />
      <Text style={styles.header}>Interface de Modération</Text>
      <Text style={styles.description}>
        Voici la liste des propositions en attente d'approbation. Vous pouvez
        les approuver pour les rendre visibles aux utilisateurs ou les rejeter
        pour les supprimer.
      </Text>
      {pendingFeatures.length === 0 ? (
        <Text style={styles.noFeaturesText}>
          Aucune proposition en attente.
        </Text>
      ) : (
        <FlatList
          data={pendingFeatures}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.featureCard}>
              <Text style={styles.featureTitle}>{item.title}</Text>
              {item.description && (
                <Text style={styles.featureDescription}>
                  {item.description}
                </Text>
              )}
              <Text style={styles.featureVotes}>Votes : {item.votes || 0}</Text>
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.approveButton}
                  onPress={() => handleApprove(item.id)}
                >
                  <Text style={styles.buttonText}>Approuver</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectButton}
                  onPress={() => handleReject(item.id)}
                >
                  <Text style={styles.buttonText}>Rejeter</Text>
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
    backgroundColor: "#1C1C1E",
  },
  errorText: {
    fontSize: 18,
    color: "#dc3545",
    textAlign: "center",
    marginTop: 50,
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginVertical: 20,
  },
  description: {
    fontSize: 16,
    color: "#BBBBBB",
    textAlign: "center",
    marginBottom: 20,
  },
  noFeaturesText: {
    fontSize: 16,
    color: "#AAAAAA",
    textAlign: "center",
  },
  featureCard: {
    backgroundColor: "#2C2C2E",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 5,
  },
  featureDescription: {
    fontSize: 16,
    color: "#BBBBBB",
    marginBottom: 5,
  },
  featureVotes: {
    fontSize: 14,
    color: "#FFD700",
    marginBottom: 10,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  approveButton: {
    backgroundColor: "#28a745",
    padding: 10,
    borderRadius: 5,
    width: "40%",
    alignItems: "center",
  },
  rejectButton: {
    backgroundColor: "#dc3545",
    padding: 10,
    borderRadius: 5,
    width: "40%",
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1C1C1E",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#BBBBBB",
  },
});
