// components/MissedChallengeModal.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import designSystem from "../theme/designSystem";
import { useTranslation } from "react-i18next";
import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  TestIds,
} from "react-native-google-mobile-ads";
import { useState, useEffect } from "react";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const currentTheme = designSystem.lightTheme;
// ID vidéo récompensée
const adUnitId = __DEV__
  ? TestIds.REWARDED
  : "ca-app-pub-4725616526467159/6366749139";
const rewarded = RewardedAd.createForAdRequest(adUnitId, {
  requestNonPersonalizedAdsOnly: true,
});

const normalizeSize = (size: number) => {
  const scale = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) / 375;
  return Math.round(size * scale);
};

interface MissedChallengeModalProps {
  visible: boolean;
  onClose: () => void;
  onReset: () => void;
  onWatchAd: () => void;
  onUseTrophies: () => void;
  trophyCost: number;
}

const MissedChallengeModal: React.FC<MissedChallengeModalProps> = ({
  visible,
  onClose,
  onReset,
  onWatchAd,
  onUseTrophies,
  trophyCost,
}) => {
  const { t } = useTranslation();

  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeLoaded = rewarded.addAdEventListener(
      RewardedAdEventType.LOADED,
      () => {
        setAdLoaded(true);
        setAdError(null);
        console.log("Vidéo récompensée chargée");
      }
    );
    const unsubscribeEarned = rewarded.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      () => {
        console.log("✅ Récompense gagnée !");
      }
    );
    const unsubscribeError = rewarded.addAdEventListener(
      AdEventType.ERROR,
      (error) => {
        console.error("Erreur vidéo récompensée:", error.message);
        setAdLoaded(false);
        setAdError(t("missedChallenge.adNotReady"));
      }
    );
    rewarded.load();
    return () => {
      unsubscribeLoaded();
      unsubscribeEarned();
      unsubscribeError();
    };
  }, [t]);

  if (!visible) return null;

  const handleWatchAd = () => {
    if (adLoaded) {
      rewarded.show();
      onWatchAd();
      setAdLoaded(false);
      rewarded.load();
    } else {
      setAdError(t("missedChallenge.adNotReady"));
      rewarded.load();
    }
  };

  return (
    <View style={styles.overlay}>
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
        style={styles.modalContainer}
      >
        <LinearGradient
          colors={["#1E1E1E", "#3A3A3A"]}
          style={styles.modalContent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.header}>
            <Ionicons
              name="warning-outline"
              size={normalizeSize(48)}
              color="#FF4444"
            />
            <Text style={styles.title}>{t("missedChallenge.title")}</Text>
            <Text style={styles.subtitle}>{t("missedChallenge.subtitle")}</Text>
          </View>
          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={styles.optionButton}
              onPress={onReset}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#FF6200", "#FF8C00"]}
                style={styles.optionGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons
                  name="refresh-outline"
                  size={normalizeSize(28)}
                  color="#FFF"
                />
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionText}>
                    {t("missedChallenge.reset.title")}
                  </Text>
                  <Text style={styles.optionSubtext}>
                    {t("missedChallenge.reset.subtitle")}
                  </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.optionButton}
              onPress={handleWatchAd}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#6EE7B7", "#34D399"]}
                style={styles.optionGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons
                  name="play-circle-outline"
                  size={normalizeSize(28)}
                  color="#FFF"
                />
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionText}>
                    {t("missedChallenge.ad.title")}
                  </Text>
                  <Text style={styles.optionSubtext}>
                    {t("missedChallenge.ad.subtitle")}
                  </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.optionButton}
              onPress={onUseTrophies}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#FACC15", "#F59E0B"]}
                style={styles.optionGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons
                  name="trophy-outline"
                  size={normalizeSize(28)}
                  color="#FFF"
                />
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionText}>
                    {t("missedChallenge.useTrophies.title", {
                      count: trophyCost,
                    })}
                  </Text>
                  <Text style={styles.optionSubtext}>
                    {t("missedChallenge.useTrophies.subtitle")}
                  </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
          {adError && <Text style={styles.errorText}>{adError}</Text>}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons
              name="close-circle"
              size={normalizeSize(36)}
              color="#FFF"
            />
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modalContainer: {
    width: SCREEN_WIDTH * 0.9,
    maxWidth: 400,
    maxHeight: SCREEN_HEIGHT * 0.85,
    borderRadius: normalizeSize(24),
    overflow: "hidden",
  },
  modalContent: {
    width: "100%",
    padding: normalizeSize(24),
    borderRadius: normalizeSize(24),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 25,
  },
  header: {
    alignItems: "center",
    marginBottom: normalizeSize(24),
  },
  title: {
    fontSize: normalizeSize(28),
    fontFamily: currentTheme.typography.title.fontFamily,
    color: "#FFF",
    marginTop: normalizeSize(12),
    textShadowColor: "#FF4444",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: normalizeSize(16),
    fontFamily: currentTheme.typography.body.fontFamily,
    color: "#D1D5DB",
    textAlign: "center",
    marginTop: normalizeSize(8),
    paddingHorizontal: normalizeSize(10),
  },
  optionsContainer: {
    gap: normalizeSize(16),
  },
  optionButton: {
    borderRadius: normalizeSize(16),
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  optionGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: normalizeSize(16),
    borderRadius: normalizeSize(16),
    minHeight: normalizeSize(70),
  },
  optionTextContainer: {
    flex: 1,
    marginLeft: normalizeSize(12),
  },
  optionText: {
    fontSize: normalizeSize(18),
    fontFamily: currentTheme.typography.title.fontFamily,
    color: "#FFF",
    lineHeight: normalizeSize(22),
  },
  optionSubtext: {
    fontSize: normalizeSize(14),
    fontFamily: currentTheme.typography.body.fontFamily,
    color: "#E5E7EB",
    lineHeight: normalizeSize(18),
  },
  closeButton: {
    position: "absolute",
    top: normalizeSize(3),
    right: normalizeSize(3),
    backgroundColor: "#FF4444",
    borderRadius: normalizeSize(18),
    padding: normalizeSize(6),
    elevation: 10,
  },
  errorText: {
    color: "#FF4444",
    fontSize: normalizeSize(14),
    textAlign: "center",
    marginVertical: normalizeSize(10),
  },
});

export default MissedChallengeModal;
