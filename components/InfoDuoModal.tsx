// components/InfoDuoModal.tsx
import React from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";


interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function InfoDuoModal({ visible, onClose }: Props) {
      const { t } = useTranslation();
    
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.backdrop}>
        <LinearGradient
          colors={["#1E1E1E", "#3A3A3A"]}
          style={styles.modal}
        >
          <Ionicons name="people-outline" size={48} color="#FF8C00" />
          <Text style={styles.title}>{t("duoInfoModal.title")}</Text>
          <Text style={styles.desc}>{t("duoInfoModal.desc")}</Text>
          <TouchableOpacity style={styles.btn} onPress={onClose}>
            <Text style={styles.btnText}>{t("duoInfoModal.button")}</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 20,
  },
  modal: {
    borderRadius: 20,
    padding: 24,
    width: "90%",
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontFamily: "Comfortaa_700Bold",
    color: "#fff",
    marginTop: 12,
    marginBottom: 8,
    textAlign: "center",
  },
  desc: {
    fontSize: 14,
    fontFamily: "Comfortaa_400Regular",
    color: "#D1D5DB",
    textAlign: "center",
    marginBottom: 20,
  },
  btn: {
    backgroundColor: "#FF8C00",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 999,
  },
  btnText: {
    color: "#fff",
    fontFamily: "Comfortaa_700Bold",
    fontSize: 16,
  },
});
