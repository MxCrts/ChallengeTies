import React, { useRef } from "react";
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

const { width, height } = Dimensions.get("window");
const BUTTON_SIZE = 60;

export default function Screen1() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [fontsLoaded] = useFonts({
    Comfortaa_400Regular,
    Comfortaa_700Bold,
  });
  const videoRef = useRef<any>(null);

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
          source={require("../../../assets/videos/intro-videoX2.mp4")}
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

        {/* Logo Overlay & Container */}
        <View style={styles.logoOverlay} />
        <View style={styles.logoContainer}>
          <Image
            source={require("../../../assets/images/Challenge.png")}
            style={styles.logo}
            contentFit="contain"
            accessibilityLabel={t("screen1.logoLabel")}
          />
        </View>

        {/* Card Wrapper pour le texte et la flèche */}
        <View
          style={[styles.cardWrapper, { marginBottom: insets.bottom + 20 }]}
        >
          {/* Presentation Card */}
          <Animated.View style={styles.card}>
            <Text style={styles.text}>
              {t("screen1.presentationText")}
            </Text>
          </Animated.View>

          {/* Next Button positionné pour chevaucher la card */}
          <Link href="/screen/onboarding/Screen2" asChild>
            <TouchableOpacity
              style={styles.nextButton}
              accessibilityLabel={t("screen1.nextButtonLabel")}
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
  logoOverlay: {
    position: "absolute",
    top: height * 0.04,
    alignSelf: "center",
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
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
  cardWrapper: {
    width: "90%",
    alignItems: "center",
    position: "relative",
  },
  card: {
    width: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
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
  text: {
    fontSize: 18,
    fontFamily: "Comfortaa_400Regular",
    color: "#fff",
    textAlign: "center",
    marginVertical: 10,
    lineHeight: 26,
  },
  nextButton: {
    position: "absolute",
    bottom: -BUTTON_SIZE / 2,
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
