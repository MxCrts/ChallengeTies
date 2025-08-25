import React, { ReactNode, ReactElement } from "react";
import { View, StyleSheet, Text, StyleProp, ViewStyle } from "react-native";
import { Video, ResizeMode } from "expo-av";
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
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";

  const videoSource = (() => {
    switch (step) {
      case 1: return require("../assets/videos/videoTuto1.mp4");
      case 2: return require("../assets/videos/videoTuto2.mp4");
      case 3: return require("../assets/videos/videoTuto3.mp4");
      case 4: return require("../assets/videos/videoTuto4.mp4");
      case 5: return require("../assets/videos/videoTuto5.mp4");
      default: return undefined;
    }
  })();

  const renderWithWhiteText = (node: ReactNode) => {
    if (React.isValidElement(node)) {
      const element = node as ReactElement<any>;
      return React.cloneElement(element, {
        style: [element.props?.style, styles.whiteText],
      });
    }
    return <Text style={styles.whiteText}>{node}</Text>;
  };

  return (
  <View style={styles.fullscreenContainer} pointerEvents="auto">
    {/* 🔒 Catch all touches so nothing passes through */}
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="auto"
      // This makes the view become responder and swallow the press
      onStartShouldSetResponder={() => true}
    />

    {videoSource && (
      <Video
        source={videoSource}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
      />
    )}

    {/* Bottom overlay with your content/buttons */}
    <View style={[styles.bottomOverlay, containerStyle]} pointerEvents="auto">
      <View style={styles.textContainer}>
        {icon}
        <View style={styles.textGroup}>
          {renderWithWhiteText(title)}
          {renderWithWhiteText(description)}
        </View>
        {children}
      </View>
    </View>
  </View>
);

};

const styles = StyleSheet.create({
  fullscreenContainer: {
  ...StyleSheet.absoluteFillObject,
  zIndex: 9999,      // iOS
  elevation: 9999,   // Android
},
  bottomOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.88)",
    paddingVertical: normalize(6), // 🔥 encore plus fin
    paddingHorizontal: normalize(14),
    borderTopLeftRadius: normalize(20),
    borderTopRightRadius: normalize(20),
  },
  textContainer: {
    alignItems: "center",
  },
  textGroup: {
    alignItems: "center",
    marginBottom: normalize(4),
  },
  whiteText: {
    color: "#fff",
    textAlign: "center",
  },
});

export default TutorialVideoWrapper;
