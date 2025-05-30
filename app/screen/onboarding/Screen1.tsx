import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
} from "react-native";
import { useRouter } from "expo-router"; // Ajout pour navigation manuelle
import { Ionicons } from "@expo/vector-icons";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import {
  useFonts,
  Comfortaa_400Regular,
  Comfortaa_700Bold,
} from "@expo-google-fonts/comfortaa";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { useTutorial } from "../../../context/TutorialContext"; // Ajout pour déclencher le tutoriel

const { width, height } = Dimensions.get("window");

export default function Screen1() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [fontsLoaded] = useFonts({
    Comfortaa_400Regular,
    Comfortaa_700Bold,
  });
  const videoRef = useRef<any>(null);
  const router = useRouter(); // Ajout pour navigation manuelle
  const { startTutorial } = useTutorial(); // Ajout pour déclencher le tutoriel

  // Animations pour texte 1 (0-6s)
  const introTextOpacity = useRef(new Animated.Value(0)).current;
  const introOverlayOpacity = useRef(new Animated.Value(0)).current;

  // Animations pour texte final (17-21s) et bouton
  const challengeTiesOpacity = useRef(new Animated.Value(0)).current;
  const challengeTiesScale = useRef(new Animated.Value(0.8)).current;
  const finalTextOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  // Animation pour texte 1 (0-6s)
  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(introOverlayOpacity, {
          toValue: 1,
          duration: 1000, // Fade-in 0-1s
          useNativeDriver: true,
        }),
        Animated.timing(introTextOpacity, {
          toValue: 1,
          duration: 1000, // Fade-in 0-1s
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(13000), // Stay 1-5s (1s de plus)
      Animated.parallel([
        Animated.timing(introTextOpacity, {
          toValue: 0,
          duration: 1000, // Fade-out 5-6s
          useNativeDriver: true,
        }),
        Animated.timing(introOverlayOpacity, {
          toValue: 0,
          duration: 1000, // Fade-out 5-6s
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [introTextOpacity, introOverlayOpacity]);

  // Animation pour texte final et bouton (17-21s)
  useEffect(() => {
    Animated.sequence([
      Animated.delay(26000), // Start at 17s
      Animated.parallel([
        Animated.timing(challengeTiesOpacity, {
          toValue: 1,
          duration: 2000, // Fade-in 17-19s (plus long)
          useNativeDriver: true,
        }),
        Animated.spring(challengeTiesScale, {
          toValue: 1,
          speed: 12,
          bounciness: 8, // Effet bounce
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(finalTextOpacity, {
        toValue: 1,
        duration: 2000, // Fade-in 18-20s (plus long)
        useNativeDriver: true,
      }),
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 2000, // Fade-in 19-21s (plus long)
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    challengeTiesOpacity,
    challengeTiesScale,
    finalTextOpacity,
    buttonOpacity,
  ]);

  // Fonction pour gérer le clic sur "Je suis prêt"
  const handleFinishOnboarding = async () => {
    await startTutorial(); // Déclenche le tutoriel
    router.replace("/"); // Navigue vers Index, le tutoriel prendra le relais
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaView
      style={styles.safeContainer}
      edges={["bottom", "left", "right"]}
    >
      <StatusBar translucent backgroundColor="transparent" style="light" />
      <View style={styles.container}>
        {/* Background Video */}
        <Video
          ref={videoRef}
          source={require("../../../assets/videos/bestintrovideo.mp4")}
          style={styles.backgroundVideo}
          resizeMode={ResizeMode.COVER}
          shouldPlay // Lance directement
          isLooping
          isMuted={false} // Son activé
          onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
            if (status.isLoaded && status.didJustFinish) {
              videoRef.current.setStatusAsync({ shouldPlay: true });
            }
          }}
        />

        {/* Gradient Overlay de base */}
        <LinearGradient
          colors={["rgba(0,0,0,0.3)", "transparent"]}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Overlay animé pour texte 1 (0-6s) */}
        <Animated.View
          style={[styles.overlay, { opacity: introOverlayOpacity }]}
        />

        {/* Logo (toujours visible) */}
        <View style={styles.logoContainer}>
          <Image
            source={require("../../../assets/images/Challenge.png")}
            style={styles.logo}
            contentFit="contain"
            accessibilityLabel={t("screen1.logoLabel")}
          />
        </View>

        {/* Texte 1 (0-6s) */}
        <Animated.View
          style={[styles.introTextContainer, { opacity: introTextOpacity }]}
        >
          <Text style={styles.introText}>{t("screen1.presentationText")}</Text>
        </Animated.View>

        {/* Texte final (17-21s) */}
        {/* ChallengeTies (sous le logo) */}
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
          >
            ChallengeTies
          </Animated.Text>
        </Animated.View>

        {/* "Prêt à relever le défi ?" et bouton (en bas) */}
        <Animated.View style={styles.finalTextContainer}>
          <Animated.Text
            style={[styles.finalText, { opacity: finalTextOpacity }]}
          >
            Prêt à relever le défi ?
          </Animated.Text>
          <TouchableOpacity
            style={styles.readyButton}
            onPress={handleFinishOnboarding} // Appelle la fonction pour déclencher le tutoriel
          >
            <Animated.Text
              style={[styles.readyButtonText, { opacity: buttonOpacity }]}
            >
              Je suis prêt
            </Animated.Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: "transparent",
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
    backgroundColor: "rgba(0, 0, 0, 0.5)", // Overlay sombre pour texte 1
  },
  logoContainer: {
    position: "absolute",
    top: height * 0.02,
    alignSelf: "center",
  },
  logo: {
    width: 150,
    height: 150,
  },
  introTextContainer: {
    position: "absolute",
    top: height * 0.25, // Juste en dessous du logo
    width: "90%",
    alignItems: "center",
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
    top: height * 0.18, // En dessous du logo
    width: "90%",
    alignItems: "center",
  },
  challengeTiesText: {
    fontSize: 48,
    fontFamily: "Comfortaa_700Bold",
    color: "#FFB800",
    textAlign: "center",
    textShadowColor: "rgba(255, 184, 0, 0.7)", // Glow plus fort
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  finalTextContainer: {
    position: "absolute",
    bottom: 50, // En bas
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
    backgroundColor: "#FFB800",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  readyButtonText: {
    fontSize: 18,
    fontFamily: "Comfortaa_700Bold",
    color: "#000",
    textAlign: "center",
  },
});
