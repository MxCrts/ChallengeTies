import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  Modal,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import { useSavedChallenges } from "../../context/SavedChallengesContext";
import { useCurrentChallenges } from "../../context/CurrentChallengesContext";
import { useRoute } from "@react-navigation/native";
import {
  doc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db, auth } from "../../constants/firebase-config";
import { useRouter } from "expo-router";

type RouteParams = {
  id: string;
  title: string;
  category?: string;
  description?: string;
};

export default function ChallengeDetails() {
  const route = useRoute();
  const router = useRouter();
  const { id, title, category, description } = route.params as RouteParams;

  const { savedChallenges, addChallenge, removeChallenge, isSaved } =
    useSavedChallenges();
  const { takeChallenge, removeChallenge: removeCurrentChallenge } =
    useCurrentChallenges();

  const [userCount, setUserCount] = useState<number>(0);
  const [userHasTaken, setUserHasTaken] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [challengeImage, setChallengeImage] = useState<string | null>(null);
  const [daysOptions, setDaysOptions] = useState<number[]>([10, 30, 60, 365]);
  const [selectedDays, setSelectedDays] = useState<number>(10);
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  useEffect(() => {
    const challengeDoc = doc(db, "challenges", id);
    const unsubscribe = onSnapshot(challengeDoc, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const users = data.usersTakingChallenge || [];
        setUserHasTaken(users.includes(auth.currentUser?.uid));
        setUserCount(users.length);
        setChallengeImage(data.imageUrl);
        setDaysOptions(data.daysOptions || [10, 30, 60, 365]);
      }
    });
    return () => unsubscribe();
  }, [id]);

  const handleTakeChallenge = async () => {
    if (!userHasTaken) {
      try {
        setLoading(true);
        const challengeDoc = doc(db, "challenges", id);
        await updateDoc(challengeDoc, {
          usersTakingChallenge: arrayUnion(auth.currentUser?.uid),
        });
        await takeChallenge(
          { id, title, category, description, daysOptions, chatId: id },
          selectedDays
        );
        setUserHasTaken(true);
        setModalVisible(false);
      } catch (error) {
        console.error("Error taking challenge:", error);
        Alert.alert("Error", "Unable to join the challenge. Please try again.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleRemoveChallenge = async () => {
    try {
      setLoading(true);
      const challengeDoc = doc(db, "challenges", id);
      await updateDoc(challengeDoc, {
        usersTakingChallenge: arrayRemove(auth.currentUser?.uid),
      });
      await removeCurrentChallenge(id, selectedDays);
      setUserHasTaken(false);
    } catch (error) {
      console.error("Error removing challenge:", error);
      Alert.alert("Error", "Unable to remove the challenge. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChallenge = async () => {
    if (isSaved(id)) {
      await removeChallenge(id);
    } else {
      await addChallenge({
        id,
        title,
        category,
        description,
        daysOptions,
        chatId: id,
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E90FF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.imageContainer}>
        {challengeImage ? (
          <Image
            source={{ uri: challengeImage }}
            style={styles.challengeImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={80} color="#ccc" />
            <Text style={styles.noImageText}>No Image Available</Text>
          </View>
        )}
      </View>
      <View style={styles.contentContainer}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.category}>{category || "Uncategorized"}</Text>
        <Text style={styles.description}>{description}</Text>

        <TouchableOpacity
          style={[styles.saveButton, isSaved(id) && styles.savedButton]}
          onPress={handleSaveChallenge}
        >
          <Text style={styles.saveButtonText}>
            {isSaved(id) ? "Saved" : "Save Challenge"}
          </Text>
          <Ionicons
            name={isSaved(id) ? "bookmark" : "bookmark-outline"}
            size={20}
            color="#fff"
            style={styles.saveButtonIcon}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.takeChallengeButton,
            userHasTaken && styles.disabledButton,
          ]}
          onPress={() => setModalVisible(true)}
          disabled={userHasTaken}
        >
          <Text style={styles.takeChallengeButtonText}>
            {userHasTaken ? "Challenge Taken" : "Take the Challenge"}
          </Text>
        </TouchableOpacity>
        {userHasTaken && (
          <TouchableOpacity
            style={styles.removeChallengeButton}
            onPress={handleRemoveChallenge}
          >
            <Text style={styles.removeChallengeButtonText}>
              Remove Challenge
            </Text>
          </TouchableOpacity>
        )}
        <Text style={styles.userCountText}>
          {userCount} {userCount === 1 ? "person" : "people"} taking this
          challenge
        </Text>
      </View>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose Duration (Days)</Text>
            <Picker
              selectedValue={selectedDays}
              style={styles.daysPicker}
              onValueChange={(itemValue: number) => setSelectedDays(itemValue)}
            >
              {daysOptions.map((days) => (
                <Picker.Item key={days} label={`${days} days`} value={days} />
              ))}
            </Picker>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleTakeChallenge}
            >
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f4f8",
  },
  imageContainer: {
    height: 250,
    width: "100%",
    backgroundColor: "#eee",
    justifyContent: "center",
    alignItems: "center",
  },
  challengeImage: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  noImageText: {
    color: "#ccc",
    marginTop: 10,
  },
  contentContainer: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  category: {
    fontSize: 16,
    color: "#666",
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    color: "#555",
    lineHeight: 24,
    marginBottom: 20,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    backgroundColor: "#007bff",
    padding: 12,
    borderRadius: 8,
  },
  savedButton: {
    backgroundColor: "#6c757d",
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "bold",
    marginRight: 5,
  },
  saveButtonIcon: {
    marginLeft: 5,
  },
  takeChallengeButton: {
    marginTop: 20,
    backgroundColor: "#28a745",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  takeChallengeButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  disabledButton: {
    backgroundColor: "#999",
  },
  removeChallengeButton: {
    marginTop: 16,
    backgroundColor: "#dc3545",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  removeChallengeButtonText: { color: "#fff", fontWeight: "bold" },
  userCountText: { marginTop: 16, fontSize: 16, color: "#444" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { marginTop: 10, fontSize: 16, color: "#444" },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    width: "80%",
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },
  daysPicker: {
    width: "100%",
    height: 50,
    marginBottom: 20,
  },
  confirmButton: {
    backgroundColor: "#28a745",
    padding: 10,
    borderRadius: 8,
    width: "80%",
    alignItems: "center",
    marginBottom: 10,
  },
  confirmButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  cancelButton: {
    backgroundColor: "#dc3545",
    padding: 10,
    borderRadius: 8,
    width: "80%",
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
