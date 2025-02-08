import React, { useEffect, useState } from "react";
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

interface TrophyModalProps {
  visible: boolean;
  trophies: number;
  achievement?: string;
  onClose: (finalTrophies: number) => void; // ✅ onClose retourne le nombre final de trophées
  onWatchAd?: () => void; // ✅ Action pour regarder une pub
}

const TrophyModal: React.FC<TrophyModalProps> = ({
  visible,
  trophies,
  achievement,
  onClose,
  onWatchAd,
}) => {
  const scaleAnim = useState(new Animated.Value(0))[0];
  const [reward, setReward] = useState(trophies);
  const [adWatched, setAdWatched] = useState(false); // ✅ Bloque le spam de la pub

  useEffect(() => {
    if (visible) {
      setReward(trophies); // ✅ Réinitialise les trophées affichés
      setAdWatched(false); // ✅ Réinitialise l’état de la pub

      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, trophies, scaleAnim]);

  if (!visible) return null;

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={() => onClose(reward)}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[styles.modalContainer, { transform: [{ scale: scaleAnim }] }]}
        >
          <Ionicons name="trophy" size={50} color="#FFD700" />
          <Text style={styles.title}>Félicitations ! 🎉</Text>
          <Text style={styles.rewardText}>+{reward} trophées</Text>
          {achievement && (
            <Text style={styles.achievementText}>🏆 {achievement}</Text>
          )}

          <Image
            source={require("../assets/images/trophy-animation.gif")}
            style={styles.trophyImage}
          />

          {/* ✅ Bouton pour regarder une pub et doubler les trophées */}

          <TouchableOpacity
            style={[styles.button, styles.adButton]}
            onPress={() => {
              console.log("Pub regardée ! ✅");
              setAdWatched(true);
              setReward((prev) => prev * 2); // ✅ Double les trophées
              onWatchAd();
            }}
          >
            <Text style={styles.buttonText}>
              🎥 Regarder une pub (+{trophies} 🏆)
            </Text>
          </TouchableOpacity>

          {/* ✅ Bouton pour récupérer les trophées */}
          <TouchableOpacity
            style={styles.button}
            onPress={() => onClose(reward)} // ✅ Ferme et donne les trophées finaux
          >
            <Text style={styles.buttonText}>Réclamer</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default TrophyModal;

// --------------------------------
// 🎨 Styles ultra modernes
// --------------------------------
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: 320,
    backgroundColor: "#1E1E2E",
    borderRadius: 15,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFF",
    marginVertical: 10,
    textAlign: "center",
  },
  rewardText: {
    fontSize: 18,
    color: "#FFD700",
    textAlign: "center",
    marginBottom: 5,
  },
  achievementText: {
    fontSize: 16,
    color: "#FFD700",
    textAlign: "center",
    marginBottom: 10,
  },
  trophyImage: {
    width: 100,
    height: 100,
    marginBottom: 15,
  },
  button: {
    backgroundColor: "#FFD700",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000",
  },
  adButton: {
    backgroundColor: "#FFA500", // ✅ Couleur différente pour l'option pub
  },
});
