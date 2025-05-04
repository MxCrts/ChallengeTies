import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
} from "react-native";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import {
  useFonts,
  Comfortaa_400Regular,
  Comfortaa_700Bold,
} from "@expo-google-fonts/comfortaa";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";

const { width, height } = Dimensions.get("window");
const BUTTON_SIZE = 60;

export default function Screen4() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [fontsLoaded] = useFonts({
    Comfortaa_400Regular,
    Comfortaa_700Bold,
  });
  const videoRef = useRef<any>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

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
          source={require("../../../assets/videos/intro-video4.mp4")}
          style={styles.backgroundVideo}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isMuted
          onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
            if (status.isLoaded && status.didJustFinish) {
              videoRef.current.setStatusAsync({ shouldPlay: false });
            }
          }}
        />

        {/* Gradient Overlay */}
        <LinearGradient
          colors={["rgba(0,0,0,0.3)", "transparent"]}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Card Wrapper pour le texte et la flèche */}
        <View
          style={[styles.cardWrapper, { marginBottom: insets.bottom + 20 }]}
        >
          {/* Presentation Card */}
          <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
            <Text style={styles.title}>
              {t("screen4.titlePart1")}{" "}
              <Text style={styles.greenText}>
                {t("screen4.titleHighlight")}
              </Text>
            </Text>
            <Text style={styles.text}>
              {t("screen4.description")}
            </Text>
          </Animated.View>

          {/* Next Button chevauchant la card */}
          <Link href="/screen/onboarding/Screen5" asChild>
            <TouchableOpacity
              style={styles.nextButton}
              accessibilityLabel={t("screen4.nextButtonLabel")}
            >
              <Ionicons name="arrow-forward" size={24} color="#333" />
            </TouchableOpacity>
          </Link>
        </View>
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
    justifyContent: "flex-end",
  },
  backgroundVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  cardWrapper: {
    width: "90%",
    alignItems: "center",
    position: "relative",
  },
  card: {
    width: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.6)", // Fond opaque/translucide
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 15,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    paddingBottom: BUTTON_SIZE / 1.5,
  },
  title: {
    fontSize: 30,
    fontFamily: "Comfortaa_700Bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 10,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  greenText: {
    color: "#27AE60",
    fontWeight: "bold",
  },
  text: {
    fontSize: 20,
    fontFamily: "Comfortaa_400Regular",
    color: "#fff",
    textAlign: "center",
    lineHeight: 28,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  nextButton: {
    position: "absolute",
    bottom: -BUTTON_SIZE / 2, // La moitié du bouton chevauche la bordure de la card
    right: 20,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    backgroundColor: "#F7F7F7",
    borderRadius: BUTTON_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
});
