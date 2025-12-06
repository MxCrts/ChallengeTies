import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  ActivityIndicator,
  AppState,
  AccessibilityInfo,
  Easing,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import {
  useFonts,
  Comfortaa_400Regular,
  Comfortaa_700Bold,
} from "@expo-google-fonts/comfortaa";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { useTutorial } from "../../../context/TutorialContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavGuard } from "@/hooks/useNavGuard";
import { useIsFocused } from "@react-navigation/native";
import { Asset } from "expo-asset";

const { width, height } = Dimensions.get("window");

export default function Screen1() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [fontsLoaded] = useFonts({ Comfortaa_400Regular, Comfortaa_700Bold });
  const videoRef = useRef<Video>(null);
  const router = useRouter();
  const nav = useNavGuard(router);
  const isFocused = useIsFocused();

  const { setTutorialStep, setIsTutorialActive } = useTutorial();

  // Anim values
  const introTextOpacity = useRef(new Animated.Value(0)).current;
  const introOverlayOpacity = useRef(new Animated.Value(0)).current;
  const challengeTiesOpacity = useRef(new Animated.Value(0)).current;
  const challengeTiesScale = useRef(new Animated.Value(0.92)).current;
  const finalTextOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [isNavigating, setIsNavigating] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [shouldPlay, setShouldPlay] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const timersRef = useRef<number[]>([]);
  const appStateRef = useRef(AppState.currentState);
  const ctaShownRef = useRef(false);
  const playbackMsRef = useRef(0);

  // Reduced motion (accessibility)
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => setReduceMotion(Boolean(v)))
      .catch(() => {});
  }, []);

  // Control play state based on focus/app state/navigation
  useEffect(() => {
    const recompute = () =>
      setShouldPlay(
        isFocused &&
          appStateRef.current === "active" &&
          !isNavigating &&
          !reduceMotion
      );
    recompute();
    const sub = AppState.addEventListener("change", (s) => {
      appStateRef.current = s;
      recompute();
    });
    return () => sub.remove();
  }, [isFocused, isNavigating, reduceMotion]);

  // Preload vidéo
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const asset = Asset.fromModule(
          require("../../../assets/videos/test4.mp4")
        );
        if (!asset.downloaded) {
          await asset.downloadAsync();
        }
        if (mounted) setVideoError(null);
      } catch (e: any) {
        if (mounted) setVideoError(e?.message ?? "Video preload failed");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  // Lecture/pause pilotées quand shouldPlay change
  useEffect(() => {
    const v = videoRef.current;

    // 🔒 Tant que la vidéo n'est pas chargée, on ne touche à rien
    if (!v || !videoLoaded) return;

    (async () => {
      try {
        if (shouldPlay) {
          await v.playAsync();
        } else {
          await v.pauseAsync();
        }
      } catch (e) {
        console.warn("[OnboardingVideo] play/pause error", e);
      }
    })();
  }, [shouldPlay, videoLoaded]);



  // Apparition logo + texte final + CTA (9s de playback ou fallback 10s)
  const showCTA = useCallback(() => {
    if (ctaShownRef.current) return;
    ctaShownRef.current = true;
    Animated.parallel([
      Animated.timing(challengeTiesOpacity, {
        toValue: 1,
        duration: 900,
        easing: Easing?.out
          ? Easing.out(Easing.cubic)
          : undefined,
        useNativeDriver: true,
      }),
      Animated.spring(challengeTiesScale, {
        toValue: 1,
        speed: 10,
        bounciness: 6,
        useNativeDriver: true,
      }),
      Animated.timing(finalTextOpacity, {
        toValue: 1,
        duration: 900,
        easing: Easing?.out
          ? Easing.out(Easing.cubic)
          : undefined,
        useNativeDriver: true,
      }),
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 900,
        easing: Easing?.out
          ? Easing.out(Easing.cubic)
          : undefined,
        useNativeDriver: true,
      }),
    ]).start();
  }, [buttonOpacity, challengeTiesOpacity, challengeTiesScale, finalTextOpacity]);

  useEffect(() => {
    if (reduceMotion) {
      // Mode accessibilité : on montre directement le CTA,
      // le bouton "Passer" sera géré dans l'effet dédié au skip.
      showCTA();
    }
  }, [showCTA, reduceMotion]);

    // Bouton "Passer" visible à partir de 3s
  useEffect(() => {
    if (reduceMotion) {
      // En mode réduit, on le montre directement
      setShowSkip(true);
      return;
    }

    const id = setTimeout(() => {
      setShowSkip(true);
    }, 3000);

    return () => clearTimeout(id);
  }, [reduceMotion]);


  // Clean video + timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
      const v = videoRef.current;
      if (v) {
        try {
          v.stopAsync?.();
        } catch {}
        try {
          v.unloadAsync?.();
        } catch {}
      }
    };
  }, []);

    const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status || !("isLoaded" in status) || !status.isLoaded) {
      return;
    }

    const pos = "positionMillis" in status && status.positionMillis != null
      ? status.positionMillis
      : 0;

    playbackMsRef.current = pos;

    // ✅ Pop CTA exactement à 35s de lecture
    if (!reduceMotion && !ctaShownRef.current && pos >= 35000) {
      showCTA();
    }
  };


  const onVideoLoad = () => {
    setVideoLoaded(true);
    setVideoError(null);
  };

  const onVideoError = (e: any) => {
    const msg = e?.nativeEvent?.error ?? e?.message ?? "Video error";
    setVideoError(msg);
    // On ne bloque pas l'onboarding : on montre le CTA
    showCTA();
  };

  const finishOnboarding = useCallback(async () => {
    if (isNavigating) return;
    setIsNavigating(true);

    const v = videoRef.current;
    if (v) {
      try {
        await v.stopAsync?.();
      } catch {}
      try {
        await v.unloadAsync?.();
      } catch {}
    }

    // Si l'utilisateur a demandé la réduction des animations,
    // on passe directement à la suite sans fade.
    if (reduceMotion) {
      try {
        await AsyncStorage.removeItem("hasCompletedTutorialAfterSignup");
        setIsTutorialActive?.(false);
        setTutorialStep?.(0);
        nav.replace("/first-pick");
      } catch {
        setIsNavigating(false);
      }
      return;
    }

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 280,
      useNativeDriver: true,
    }).start(async () => {
      try {
        await AsyncStorage.removeItem("hasCompletedTutorialAfterSignup");
        setIsTutorialActive?.(false);
        setTutorialStep?.(0);
        nav.replace("/first-pick");
      } catch {
        setIsNavigating(false);
      }
    });
  }, [fadeAnim, isNavigating, nav, setIsTutorialActive, setTutorialStep, reduceMotion]);

  if (!fontsLoaded) {
    return (
      <View style={styles.fontLoader}>
        <ActivityIndicator size="large" color="#FFB800" />
      </View>
    );
  }

  return (
    <Animated.View
      style={[styles.fullscreenContainer, { opacity: fadeAnim }]}
    >
      <StatusBar style="light" translucent backgroundColor="transparent" />

      {/* Skip top-right (safe-area) */}
      {showSkip && (
        <View
          style={[
            styles.topBar,
            {
              paddingTop: Math.max(insets.top, 12),
              paddingRight: 12,
            },
          ]}
        >
          <TouchableOpacity
            onPress={finishOnboarding}
            accessibilityRole="button"
            accessibilityLabel={t("screen8.skip") || "Passer"}
            accessibilityHint={
              t("tutorial.buttons.skip") ||
              "Passer l’intro et commencer le tutoriel."
            }
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            style={styles.skipPill}
            disabled={isNavigating}
          >
            <Ionicons name="close" size={16} color="#fff" />
            <Text style={styles.skipText}>
              {t("tutorial.buttons.skip") || "Passer"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.container}>
        {/* Fond vidéo */}
        <Video
          ref={videoRef}
          source={require("../../../assets/videos/test4.mp4")}
          style={styles.backgroundVideo}
          resizeMode={ResizeMode.COVER}
          shouldPlay={shouldPlay}
          isMuted={false}
          isLooping
          rate={1.0}
          volume={1.0}
          progressUpdateIntervalMillis={250}
          useNativeControls={false}
          onLoad={onVideoLoad}
          onError={onVideoError}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
           // Accessibilité : décoratif, ne pas l'annoncer
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />

        {/* Loader discret tant que la vidéo n’est pas prête */}
        {!videoLoaded && !videoError && (
          <View style={styles.loaderOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#FFB800" />
          </View>
        )}

        {/* assombrissement doux + vignette premium */}
        <LinearGradient
          colors={[
            "rgba(0,0,0,0.70)",
            "rgba(0,0,0,0.45)",
            "rgba(0,0,0,0.20)",
            "rgba(0,0,0,0.70)",
          ]}
          locations={[0, 0.25, 0.6, 1]}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Overlay intro (0→~3s) */}
        <Animated.View
          style={[styles.overlay, { opacity: introOverlayOpacity }]}
        />

        {/* Logo haut */}
        <Animated.View
          style={[styles.logoContainer, { opacity: challengeTiesOpacity }]}
        >
          <Image
            source={require("../../../assets/images/icon2.png")}
            style={styles.logo}
            contentFit="contain"
            accessibilityLabel={t("screen1.logoLabel")}
            accessibilityHint={t("screen8.imReadyHint") || undefined}
          />
        </Animated.View>

        {/* Texte intro */}
        <Animated.View
          style={[
            styles.introTextContainer,
            { opacity: introTextOpacity },
          ]}
        >
          <Text style={styles.introText}>
            {t("screen1.presentationText")}
          </Text>
        </Animated.View>

        {/* “ChallengeTies” titre */}
        <Animated.View
          style={[
            styles.challengeTiesContainer,
            { opacity: challengeTiesOpacity },
          ]}
        >
          <Animated.Text
            style={[
              styles.challengeTiesText,
              { transform: [{ scale: challengeTiesScale }] },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            ChallengeTies
          </Animated.Text>
        </Animated.View>

        {/* CTA final + texte */}
        <Animated.View
          style={[
            styles.finalTextContainer,
            {
              opacity: finalTextOpacity,
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          <Text style={styles.finalText}>{t("screen8.readyQuestion")}</Text>

          <TouchableOpacity
            onPress={finishOnboarding}
            disabled={isNavigating}
            accessibilityRole="button"
            accessibilityLabel={t("screen8.imReady")}
            accessibilityHint={t("screen8.imReadyHint") || undefined}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={["#FFB800", "#FF8A00"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.readyButton}
            >
              {isNavigating ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Animated.Text
                  style={[
                    styles.readyButtonText,
                    { opacity: buttonOpacity },
                  ]}
                >
                  {t("screen8.imReady")}
                </Animated.Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fullscreenContainer: {
    flex: 1,
    backgroundColor: "black",
  },
  fontLoader: {
    flex: 1,
    backgroundColor: "black",
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flex: 1,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  backgroundVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  topBar: {
    position: "absolute",
    right: 0,
    left: 0,
    top: 0,
    alignItems: "flex-end",
    zIndex: 1000,
  },
  skipPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginRight: 8,
  },
  skipText: {
    color: "#fff",
    fontFamily: "Comfortaa_700Bold",
    fontSize: 13,
  },
  logoContainer: {
    position: "absolute",
    top: height * 0.06,
    alignSelf: "center",
  },
  logo: {
    width: 150,
    height: 150,
  },
  introTextContainer: {
    position: "absolute",
    top: height * 0.28,
    width: "88%",
    alignItems: "center",
    alignSelf: "center",
  },
  introText: {
    fontSize: 20,
    fontFamily: "Comfortaa_400Regular",
    color: "#fff",
    textAlign: "center",
    lineHeight: 28,
  },
  challengeTiesContainer: {
    position: "absolute",
    top: height * 0.18,
    width: "90%",
    alignItems: "center",
  },
  challengeTiesText: {
    fontSize: 48,
    fontFamily: "Comfortaa_700Bold",
    color: "#FFB800",
    textAlign: "center",
    textShadowColor: "rgba(255, 184, 0, 0.7)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  finalTextContainer: {
    position: "absolute",
    bottom: 50,
    width: "90%",
    alignItems: "center",
  },
  finalText: {
    fontSize: 24,
    fontFamily: "Comfortaa_400Regular",
    color: "#fff",
    textAlign: "center",
    marginBottom: 20,
  },
  readyButton: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
    minWidth: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  readyButtonText: {
    fontSize: 18,
    fontFamily: "Comfortaa_700Bold",
    color: "#000",
    textAlign: "center",
  },
});
