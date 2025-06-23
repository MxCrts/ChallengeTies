import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { useTutorial } from "../../../context/TutorialContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width, height } = Dimensions.get("window");

export default function Screen1() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [fontsLoaded] = useFonts({
    Comfortaa_400Regular,
    Comfortaa_700Bold,
  });
  const videoRef = useRef<Video>(null);
  const router = useRouter();
  const { setTutorialStep, setIsTutorialActive } = useTutorial();

  const introTextOpacity = useRef(new Animated.Value(0)).current;
  const introOverlayOpacity = useRef(new Animated.Value(0)).current;
  const challengeTiesOpacity = useRef(new Animated.Value(0)).current;
  const challengeTiesScale = useRef(new Animated.Value(0.8)).current;
  const finalTextOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!videoRef.current) return;

    videoRef.current.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
      if (!status.isLoaded) {
        console.error("Vidéo non chargée :", status);
        return;
      }

      if (status.didJustFinish) {
        videoRef.current?.replayAsync();
      }
    });

    (async () => {
      try {
        await videoRef.current?.loadAsync(
          require("../../../assets/videos/bestintrovideo.mp4"),
          { shouldPlay: true, isLooping: true, isMuted: false },
          true
        );
      } catch (e) {
        console.error("Erreur chargement vidéo:", e);
      }
    })();
  }, []);

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(introOverlayOpacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(introTextOpacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(13000),
      Animated.parallel([
        Animated.timing(introTextOpacity, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(introOverlayOpacity, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  useEffect(() => {
    Animated.sequence([
      Animated.delay(26000),
      Animated.parallel([
        Animated.timing(challengeTiesOpacity, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.spring(challengeTiesScale, {
          toValue: 1,
          speed: 12,
          bounciness: 8,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(finalTextOpacity, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      }),
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleFinishOnboarding = async () => {
    try {
      await AsyncStorage.removeItem("hasCompletedTutorialAfterSignup");
      setIsTutorialActive(true);
      setTutorialStep(0);
      router.replace("/");
    } catch (error) {
      console.error("Erreur lors de l'initialisation du tutoriel :", error);
    }
  };

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView
      style={styles.safeContainer}
      edges={["bottom", "left", "right"]}
    >
      <StatusBar translucent backgroundColor="transparent" style="light" />
      <View style={styles.container}>
        <Video
          ref={videoRef}
          style={styles.backgroundVideo}
          resizeMode={ResizeMode.COVER}
        />
        <LinearGradient
          colors={["rgba(0,0,0,0.3)", "transparent"]}
          style={StyleSheet.absoluteFillObject}
        />
        <Animated.View
          style={[styles.overlay, { opacity: introOverlayOpacity }]}
        />
        <View style={styles.logoContainer}>
          <Image
            source={require("../../../assets/images/Challenge.png")}
            style={styles.logo}
            contentFit="contain"
            accessibilityLabel={t("screen1.logoLabel")}
          />
        </View>
        <Animated.View
          style={[styles.introTextContainer, { opacity: introTextOpacity }]}
        >
          <Text style={styles.introText}>{t("screen1.presentationText")}</Text>
        </Animated.View>
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
        <Animated.View style={styles.finalTextContainer}>
          <Animated.Text
            style={[styles.finalText, { opacity: finalTextOpacity }]}
          >
            Prêt à relever le défi ?
          </Animated.Text>
          <TouchableOpacity
            style={styles.readyButton}
            onPress={handleFinishOnboarding}
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
    backgroundColor: "rgba(0, 0, 0, 0.5)",
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
    top: height * 0.25,
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
