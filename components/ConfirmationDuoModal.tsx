// components/ConfirmationDuoModal.tsx
import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;

  title: string;
  subtitle: string;
  warningLine?: string;

  cancelLabel: string;
  confirmLabel: string;

  // Accessibilité
  a11yCloseLabel?: string;
  a11yConfirmHint?: string;
  a11yCancelHint?: string;
};

export default function ConfirmationDuoModal({
  visible,
  onClose,
  onConfirm,
  loading = false,
  title,
  subtitle,
  warningLine,
  cancelLabel,
  confirmLabel,
  a11yCloseLabel = "Fermer",
  a11yConfirmHint,
  a11yCancelHint,
}: Props) {
  const { width: W } = useWindowDimensions();
  const maxW = useMemo(() => Math.min(520, Math.round(W - 40)), [W]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={StyleSheet.absoluteFill}>
        {/* Backdrop premium */}
        <BlurView intensity={52} tint="dark" style={StyleSheet.absoluteFill} />
<LinearGradient
  pointerEvents="none"
  colors={["rgba(0,0,0,0.42)", "rgba(0,0,0,0.78)"]}
  start={{ x: 0.5, y: 0 }}
  end={{ x: 0.5, y: 1 }}
  style={StyleSheet.absoluteFill}
/>

        {/* Tap outside to close */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={a11yCloseLabel}
        />

        {/* Centered */}
        <View style={styles.center}>
          <Animated.View
            entering={FadeInUp.duration(220)}
            style={[styles.cardWrap, { width: maxW }]}
          >
            <BlurView
              intensity={Platform.OS === "ios" ? 28 : 18}
              tint="dark"
              style={styles.cardBlur}
            >
              <LinearGradient
                colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0.04)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardInner}
              >
                {/* Stroke */}
                <View pointerEvents="none" style={styles.stroke} />
                <View pointerEvents="none" style={styles.darkWash} />

                {/* Header */}
                <View style={styles.header}>
                  <View style={styles.iconPill}>
                    <Ionicons name="people" size={18} color="#fff" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.title} numberOfLines={2}>
                      {title}
                    </Text>
                    <Text style={styles.subtitle} numberOfLines={4}>
                      {subtitle}
                    </Text>
                  </View>

                  <Pressable
                    onPress={onClose}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={a11yCloseLabel}
                  >
                    <View style={styles.closePill}>
                      <Ionicons name="close" size={18} color="#fff" />
                    </View>
                  </Pressable>
                </View>

                {/* Warning */}
                {!!warningLine && (
                  <View style={styles.warningBox}>
                    <View style={styles.warningIcon}>
                      <Ionicons name="warning" size={16} color="#fff" />
                    </View>
                    <Text style={styles.warningText}>{warningLine}</Text>
                  </View>
                )}

                {/* Actions */}
                <View style={styles.actions}>
                  <Pressable
                    onPress={onClose}
                    disabled={loading}
                    accessibilityRole="button"
                    accessibilityHint={a11yCancelHint}
                    style={({ pressed }) => [
                      styles.btn,
                      styles.btnGhost,
                      pressed && !loading ? styles.pressed : null,
                      loading ? styles.disabled : null,
                    ]}
                  >
                    <Text style={styles.btnGhostText}>{cancelLabel}</Text>
                  </Pressable>

                  <Pressable
                    onPress={onConfirm}
                    disabled={loading}
                    accessibilityRole="button"
                    accessibilityHint={a11yConfirmHint}
                    style={({ pressed }) => [
                      styles.btn,
                      styles.btnPrimary,
                      pressed && !loading ? styles.pressed : null,
                      loading ? styles.disabled : null,
                    ]}
                  >
                    <LinearGradient
                      pointerEvents="none"
                      colors={["rgba(244,211,94,0.95)", "rgba(244,211,94,0.72)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.btnPrimaryBg}
                    />
                    <Text style={styles.btnPrimaryText}>
                      {loading ? "..." : confirmLabel}
                    </Text>
                  </Pressable>
                </View>
              </LinearGradient>
            </BlurView>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  cardWrap: {
    borderRadius: 26,
    overflow: "hidden",
    transform: [{ translateY: 0 }],
  },
  cardBlur: {
    borderRadius: 26,
    overflow: "hidden",
  },
  cardInner: {
    padding: 18,
  },
  stroke: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 26,
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconPill: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  closePill: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  title: {
    color: "#fff",
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 6,
    color: "rgba(255,255,255,0.78)",
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: "600",
  },

  warningBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  warningIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  warningText: {
    flex: 1,
    color: "rgba(255,255,255,0.86)",
    fontSize: 12.8,
    lineHeight: 17,
    fontWeight: "700",
  },

  actions: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
  },

  btn: {
    flex: 1,
    height: 46,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
darkWash: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: "rgba(10, 10, 15, 0.42)",
  borderRadius: 26,
},
  btnGhost: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  btnGhostText: {
    color: "rgba(255,255,255,0.86)",
    fontWeight: "800",
    fontSize: 13.5,
    letterSpacing: 0.2,
  },

  btnPrimary: {
    borderWidth: 1,
    borderColor: "rgba(244,211,94,0.35)",
  },
  btnPrimaryBg: {
    ...StyleSheet.absoluteFillObject,
  },
  btnPrimaryText: {
    color: "rgba(18,18,18,0.96)",
    fontWeight: "900",
    fontSize: 13.5,
    letterSpacing: 0.2,
  },

  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.95,
  },
  disabled: {
    opacity: 0.6,
  },
});
