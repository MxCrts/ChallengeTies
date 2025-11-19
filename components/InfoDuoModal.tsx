// components/InfoDuoModal.tsx
import React, { useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Pressable,
  Platform,
  AccessibilityInfo,
  ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  FadeInUp,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MAX_W = Math.min(440, SCREEN_WIDTH - 32);

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Optionnel : nom du défi courant pour contextualiser */
  challengeTitle?: string;
  /** Optionnel : action custom “Inviter un ami” (sinon no-op) */
  onInvitePress?: () => void;
  /** Optionnel : action custom “Ouvrir la boîte de réception” (sinon push /profile/notifications) */
  onOpenInboxPress?: () => void;
};

export default function InfoDuoModal({
  visible,
  onClose,
  challengeTitle,
  onInvitePress,
  onOpenInboxPress,
}: Props) {
  const { t } = useTranslation();
  const router = useRouter();

  // Haptique + annonce d’accessibilité
  useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      // courte annonce screen-reader
      AccessibilityInfo.announceForAccessibility?.(
        t("duoInfoModal.title", { defaultValue: "Défis en duo" })
      );
    }
  }, [visible, t]);

  // Backdrop fade
  const bg = useSharedValue(0);
  useEffect(() => {
    bg.value = withTiming(visible ? 1 : 0, { duration: 180 });
  }, [visible]);
  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(0,0,0,${0.6 * bg.value})`,
  }));

  // Card anim: opacity + scale + lift
  const scale = useSharedValue(0.95);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(8);
  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 14, stiffness: 140, mass: 0.8 });
      translateY.value = withSpring(0, { damping: 14, stiffness: 140, mass: 0.8 });
      opacity.value = withTiming(1, { duration: 220 });
    } else {
      opacity.value = withTiming(0, { duration: 140 });
      translateY.value = withTiming(8, { duration: 140 });
      scale.value = withTiming(0.98, { duration: 140 });
    }
  }, [visible]);

 const cardAnim = useAnimatedStyle<ViewStyle>(() => {
   return {
     opacity: opacity.value,
     transform: [
       { translateY: translateY.value },
       { scale: scale.value },
     ] as ViewStyle["transform"],
   };
 });

  const handleOpenInbox = () => {
    Haptics.selectionAsync().catch(() => {});
    try {
      if (onOpenInboxPress) onOpenInboxPress();
      else router.push("/profile/notifications");
    } finally {
      onClose();
    }
  };

  const handleInvite = () => {
    Haptics.selectionAsync().catch(() => {});
    onInvitePress?.();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none" // animé à la main
      statusBarTranslucent
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      <Animated.View style={[styles.backdrop, bgStyle]}>
        {/* Backdrop cliquable */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View
          entering={FadeInUp.duration(200)}
          style={[styles.cardWrap, cardAnim]}
          accessibilityViewIsModal
          accessibilityLiveRegion="polite"
        >
          <LinearGradient
            colors={["#101826", "#171F2E"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <View style={styles.iconRow}>
              <View style={styles.iconWrap} accessible accessibilityLabel="Duo">
                <Ionicons name="people-outline" size={36} color="#A7F3D0" />
              </View>
              {challengeTitle ? (
                <View style={{ flex: 1 }}>
                  <Text style={styles.badge}>
                    {t("duoInfoModal.badge", { defaultValue: "Mode Duo" })}
                  </Text>
                  <Text style={styles.title} accessibilityRole="header">
                    {challengeTitle}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.title, { flex: 1 }]} accessibilityRole="header">
                  {t("duoInfoModal.title", { defaultValue: "Défis en duo" })}
                </Text>
              )}
            </View>

            <Text style={styles.desc}>
              {t("duoInfoModal.desc", {
                defaultValue:
                  "Invitez un ami, progressez ensemble et suivez vos barres synchronisées en temps réel.",
              })}
            </Text>

            {/* Tips premium */}
            <View style={styles.tips}>
              <Tip
                icon="flash-outline"
                text={t("duoInfoModal.tips.fast", {
                  defaultValue: "Invitation en 2 clics, lien partageable partout.",
                })}
              />
              <Tip
                icon="sync-outline"
                text={t("duoInfoModal.tips.sync", {
                  defaultValue: "Progression synchronisée et notifications instantanées.",
                })}
              />
              <Tip
                icon="shield-checkmark-outline"
                text={t("duoInfoModal.tips.safe", {
                  defaultValue: "Contrôles anti-spam et annulation en un geste.",
                })}
              />
            </View>

            {/* CTA row */}
            <View style={styles.ctaRow}>
              <SecondaryButton
                title={t("duoInfoModal.openInbox", { defaultValue: "Voir mes invitations" })}
                icon="mail-unread-outline"
                onPress={handleOpenInbox}
              />
              <PrimaryButton
                title={t("duoInfoModal.inviteNow", { defaultValue: "Inviter un ami" })}
                icon="person-add-outline"
                onPress={handleInvite}
              />
            </View>

            {/* Close */}
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel={t("duoInfoModal.button", { defaultValue: "Compris" })}
            >
              <Ionicons name="close" size={18} color="#E5E7EB" />
              <Text style={styles.closeText}>
                {t("duoInfoModal.button", { defaultValue: "Compris" })}
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

/* ---------- Atoms ---------- */

const Tip = ({ icon, text }: { icon: any; text: string }) => (
  <View style={styles.tipItem}>
    <View style={styles.tipIcon}>
      <Ionicons name={icon} size={16} color="#93C5FD" />
    </View>
    <Text style={styles.tipText}>{text}</Text>
  </View>
);

const PrimaryButton = ({
  title,
  icon,
  onPress,
}: {
  title: string;
  icon?: any;
  onPress: () => void;
}) => (
  <TouchableOpacity onPress={onPress} style={styles.primaryBtn} accessibilityRole="button" accessibilityLabel={title}>
    {icon ? <Ionicons name={icon} size={18} color="#0B1220" /> : null}
    <Text style={styles.primaryBtnText}>{title}</Text>
  </TouchableOpacity>
);

const SecondaryButton = ({
  title,
  icon,
  onPress,
}: {
  title: string;
  icon?: any;
  onPress: () => void;
}) => (
  <TouchableOpacity onPress={onPress} style={styles.secondaryBtn} accessibilityRole="button" accessibilityLabel={title}>
    {icon ? <Ionicons name={icon} size={18} color="#E5E7EB" /> : null}
    <Text style={styles.secondaryBtnText}>{title}</Text>
  </TouchableOpacity>
);

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  cardWrap: {
    maxWidth: MAX_W,
    width: "100%",
  },
  card: {
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: "stretch",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 6,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(167,243,208,0.12)",
  },
  badge: {
    color: "#93C5FD",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
  },
  title: {
    fontSize: 20,
    fontFamily: "Comfortaa_700Bold",
    color: "#fff",
  },
  desc: {
    fontSize: 14,
    fontFamily: "Comfortaa_400Regular",
    color: "#D1D5DB",
    textAlign: "left",
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  tips: {
    gap: 8,
    marginBottom: 14,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tipIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(59,130,246,0.12)",
  },
  tipText: {
    color: "#E5E7EB",
    fontSize: 13,
    flex: 1,
  },
  ctaRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: "#0B1220", fontWeight: "700", fontSize: 15 },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  secondaryBtnText: { color: "#E5E7EB", fontWeight: "700", fontSize: 15 },
  closeBtn: {
    marginTop: 14,
    alignSelf: "center",
    flexDirection: "row",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  closeText: {
    color: "#E5E7EB",
    fontFamily: "Comfortaa_700Bold",
    fontSize: 14,
  },
});
