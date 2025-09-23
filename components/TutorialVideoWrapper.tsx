import React, { ReactNode, ReactElement, useMemo } from "react";
import {
  View,
  StyleSheet,
  Text,
  StyleProp,
  ViewStyle,
  Platform,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { normalize } from "@/utils/normalize";

interface Props {
  step: number;
  children: ReactNode;
  title: ReactNode;
  description: ReactNode;
  icon?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

const TutorialVideoWrapper = ({
  step,
  children,
  title,
  description,
  icon,
  containerStyle,
}: Props) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";

  // 🔒 Source vidéo mémoïsée
  const videoSource = useMemo(() => {
    switch (step) {
      case 1:
        return require("../assets/videos/videoTuto1.mp4");
      case 2:
        return require("../assets/videos/videoTuto2.mp4");
      case 3:
        return require("../assets/videos/videoTuto3.mp4");
      case 4:
        return require("../assets/videos/videoTuto4.mp4");
      case 5:
        return require("../assets/videos/videoTuto5.mp4");
      default:
        return undefined;
    }
  }, [step]);

  // ✅ Applique `styles.whiteText` sans perdre les styles/props existants
  const renderWithWhiteText = (node: ReactNode) => {
    if (React.isValidElement(node)) {
      const el = node as ReactElement<any>;
      const mergedStyle = Array.isArray(el.props?.style)
        ? [...el.props.style, styles.whiteText]
        : [el.props?.style, styles.whiteText];

      // On ne touche pas aux autres props (allowFontScaling, etc.)
      return React.cloneElement(el, { style: mergedStyle });
    }
    return <Text style={styles.whiteText}>{node}</Text>;
  };

  return (
    <View style={styles.fullscreenContainer} pointerEvents="auto">
      {/* 🔒 Capture toutes les interactions (empêche les touches de “passer à travers”) */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="auto"
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
      />

      {/* 🎞️ Vidéo de fond (optionnelle selon le step) */}
      {videoSource && (
        <Video
          source={videoSource}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping
          isMuted
          // pas d’autoplay sound, pas d’erreurs bruyantes
        />
      )}

      {/* 🧊 Bandeau bas contenant titre/description/boutons */}
      <View
        style={[
          styles.bottomOverlay,
          {
            paddingBottom:
              // + insets bas pour ne JAMAIS couper le texte/bouton
              normalize(12) + Math.max(insets.bottom, Platform.OS === "ios" ? normalize(8) : 0),
            backgroundColor: "rgba(0,0,0,0.9)", // lisible sans jouer sur l’opacité globale de tes Text
            borderTopLeftRadius: normalize(20),
            borderTopRightRadius: normalize(20),
          },
          containerStyle,
        ]}
        pointerEvents="auto"
        // Accessibilité: on évite que la vue prenne le focus par défaut
        accessible={false}
      >
        <View style={styles.textContainer}>
          {icon ? <View style={styles.iconWrap}>{icon}</View> : null}

          <View style={styles.textGroup}>
            {renderWithWhiteText(title)}
            {renderWithWhiteText(description)}
          </View>

          {/* CTA / actions */}
          {children}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fullscreenContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999, // iOS
    elevation: 9999, // Android
  },

  bottomOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: normalize(10),
    paddingHorizontal: normalize(16),
  },

  textContainer: {
    alignItems: "center",
    justifyContent: "center",
  },

  iconWrap: {
    marginBottom: normalize(8),
    alignItems: "center",
    justifyContent: "center",
  },

  textGroup: {
    alignItems: "center",
   justifyContent: "center",
   marginBottom: normalize(6),
   width: "100%",
  },

  whiteText: {
    color: "#fff",
    textAlign: "center",
  },
});

export default TutorialVideoWrapper;
