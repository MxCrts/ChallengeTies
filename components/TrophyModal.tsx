import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Animated,
  Image,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTrophy } from "../context/TrophyContext";

const TrophyModal: React.FC = () => {
  const {
    showTrophyModal,
    trophiesEarned,
    achievementEarned,
    activateDoubleReward,
    resetTrophyData,
  } = useTrophy();

  const scaleAnim = useState(new Animated.Value(0))[0];
  const [reward, setReward] = useState(trophiesEarned);
  const [adWatched, setAdWatched] = useState(false);
  const [message, setMessage] = useState("");

  // Animation d'apparition du modal
  useEffect(() => {
    if (showTrophyModal) {
      setReward(trophiesEarned);
      setAdWatched(false);
      setMessage("");
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }).start();
    }
  }, [showTrophyModal, trophiesEarned, scaleAnim]);

  const handleAdPress = useCallback(() => {
    console.log("✅ Pub regardée !");
    setAdWatched(true);
    activateDoubleReward();
    setReward((prev) => prev * 2);
    setMessage(`🔥 Tu as gagné ${trophiesEarned * 2} trophées !`);
  }, [activateDoubleReward, trophiesEarned]);

  const handleClaimPress = useCallback(() => {
    console.log(`✅ Réclamation : ${reward} trophées`);
    setMessage(`🎉 Tu as gagné ${reward} trophées !`);
    setTimeout(() => resetTrophyData(), 1000);
  }, [reward, resetTrophyData]);

  if (!showTrophyModal) return null;

  return (
    <Modal animationType="fade" transparent visible={showTrophyModal}>
      <View style={styles.overlay}>
        <Animated.View
          style={[styles.modalContainer, { transform: [{ scale: scaleAnim }] }]}
        >
          <Ionicons name="trophy" size={50} color="#FFD700" />
          <Text style={styles.title}>Félicitations ! 🎉</Text>
          <Text style={styles.rewardText}>+{reward} trophées</Text>
          {achievementEarned && (
            <Text style={styles.achievementText}>🏆 {achievementEarned}</Text>
          )}
          <Image
            source={require("../assets/images/trophy-animation.gif")}
            style={styles.trophyImage}
          />
          {message !== "" && <Text style={styles.message}>{message}</Text>}
          {!adWatched && (
            <TouchableOpacity
              style={[styles.button, styles.adButton]}
              onPress={handleAdPress}
            >
              <Text style={styles.buttonText}>
                🎥 Regarder une pub (+{trophiesEarned} 🏆)
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.button} onPress={handleClaimPress}>
            <Text style={styles.buttonText}>Réclamer</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default TrophyModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: 340,
    backgroundColor: "#2A2A3B",
    borderRadius: 18,
    padding: 25,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFD700",
    marginVertical: 10,
    textAlign: "center",
  },
  rewardText: {
    fontSize: 20,
    color: "#FFD700",
    textAlign: "center",
    marginBottom: 5,
  },
  achievementText: {
    fontSize: 18,
    color: "#FFD700",
    textAlign: "center",
    marginBottom: 10,
  },
  trophyImage: {
    width: 110,
    height: 110,
    marginBottom: 15,
  },
  message: {
    fontSize: 16,
    color: "#00FF88",
    textAlign: "center",
    marginTop: 5,
    fontWeight: "bold",
  },
  button: {
    backgroundColor: "#FFD700",
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 10,
    marginTop: 10,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000",
  },
  adButton: {
    backgroundColor: "#FF8C00",
  },
});
