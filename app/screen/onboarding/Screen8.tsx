import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
} from "react-native";
import { Link } from "expo-router";
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

export default function Screen8() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [fontsLoaded] = useFonts({
    Comfortaa_400Regular,
    Comfortaa_700Bold,
  });
  const videoRef = useRef<any>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.safeContainer} edges={["top", "left", "right"]}>
      <StatusBar translucent backgroundColor="transparent" style="light" />
      <View style={styles.container}>
        {/* Background Video */}
        <Video
          ref={videoRef}
          source={require("../../../assets/videos/intro-video8.mp4")}
          style={styles.backgroundVideo}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isMuted
          onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
            if (status.isLoaded && status.didJustFinish) {
              setIsVideoPlaying(false);
              videoRef.current.setStatusAsync({ shouldPlay: false });
            }
          }}
        />

        {/* Gradient Overlay for enhanced text readability */}
        <LinearGradient
          colors={["transparent", "rgba(0, 0, 0, 0.8)"]}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Animated Text Container */}
        <Animated.View style={[styles.textContainer, { opacity: fadeAnim }]}>
          <Text style={styles.title}>
            {t("screen8.readyQuestion")}
          </Text>
          <Text style={styles.text}>
            {t("screen8.adventureStart")}
          </Text>
        </Animated.View>

        {/* "I'm Ready" Button */}
        <Link href="/" asChild>
          <TouchableOpacity
            style={styles.readyButton}
            accessibilityLabel={t("screen8.startAppLabel")}
          >
            <Text style={styles.readyButtonText}>
              {t("screen8.imReady")}
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: "#1E1E2F", // Même couleur que le container pour éviter la barre blanche
  },
  container: {
    width,
    height,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 50,
    paddingHorizontal: 20,
    backgroundColor: "#1E1E2F",
  },
  backgroundVideo: {
    width,
    height,
    position: "absolute",
  },
  textContainer: {
    marginBottom: 40,
    textAlign: "center",
  },
  title: {
    fontSize: 30,
    fontFamily: "Comfortaa_700Bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 10,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  text: {
    fontSize: 20,
    fontFamily: "Comfortaa_400Regular",
    color: "#fff",
    textAlign: "center",
    lineHeight: 26,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  readyButton: {
    width: width * 0.8,
    backgroundColor: "#FFB800",
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
    shadowColor: "#FFB800",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  readyButtonText: {
    fontSize: 20,
    fontFamily: "Comfortaa_700Bold",
    color: "#1E1E2F",
  },
});
