// components/TutorialVideoWrapper.tsx
import React, {
  ReactNode,
  ReactElement,
  useMemo,
  useEffect,
  useState,
} from "react";
import {
  View,
  StyleSheet,
  Text,
  StyleProp,
  ViewStyle,
  Platform,
  AccessibilityInfo,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { normalize } from "@/utils/normalize";
import { LinearGradient } from "expo-linear-gradient";
import { Video, ResizeMode } from "expo-av";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideOutDown,
} from "react-native-reanimated";

interface Props {
  step: number;
  children: ReactNode;
  title: ReactNode;
  description: ReactNode;
  icon?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * ✅ Mapping vidéo = même index que TUTORIAL_STEPS
 * Tu mettras tes vraies vidéos ici ensuite.
 */
const VIDEO_BY_STEP = [
  require("@/assets/videos/videoTuto1.mp4"), // 0 welcome
  require("@/assets/videos/videoTuto2.mp4"), // 1 explore
  require("@/assets/videos/videoTuto3.mp4"), // 2 create
  require("@/assets/videos/videoTuto4.mp4"), // 3 focus
  require("@/assets/videos/videoTuto5.mp4"), // 4 duo
  require("@/assets/videos/videoTuto1.mp4"), // 5 profile (placeholder)
  require("@/assets/videos/videoTuto1.mp4"), // 6 vote (placeholder)
];

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

  const videoSource = VIDEO_BY_STEP[step] ?? VIDEO_BY_STEP[0];

  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(!!enabled);
      })
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        setReduceMotion(!!enabled);
      }
    );

    return () => {
      mounted = false;
      // @ts-ignore compat RN < 0.73
      sub?.remove?.();
    };
  }, []);

  // applique #fff à titre/desc sans écraser leurs styles
  const renderWithWhiteText = (node: ReactNode) => {
    if (React.isValidElement(node)) {
      const el = node as ReactElement<any>;
      const mergedStyle = Array.isArray(el.props?.style)
        ? [...el.props.style, styles.whiteText]
        : [el.props?.style, styles.whiteText];
      return React.cloneElement(el, { style: mergedStyle });
    }
    return <Text style={styles.whiteText}>{node}</Text>;
  };

  const bottomPadding = useMemo(
    () =>
      normalize(12) +
      Math.max(insets.bottom, Platform.OS === "ios" ? normalize(8) : 0),
    [insets.bottom]
  );

  return (
    <View style={styles.fullscreenContainer} pointerEvents="box-none">
      {/* ✅ VIDEO BACKGROUND full screen + fade-in */}
      <Animated.View
        style={StyleSheet.absoluteFill}
        entering={FadeIn.duration(280)}
        exiting={FadeOut.duration(180)}
        pointerEvents="none"
      >
        <Video
          source={videoSource}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          isLooping={!reduceMotion}
          isMuted
          shouldPlay={!reduceMotion}
          rate={1.0}
          volume={0}
          useNativeControls={false}
          // Accessibilité : purement décoratif
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />

        {/* ✅ Overlay ciné (vignettage + lisibilité premium) */}
        <LinearGradient
          colors={[
            "rgba(0,0,0,0.35)",
            "rgba(0,0,0,0.55)",
            "rgba(0,0,0,0.9)",
          ]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Pane bas (titre/desc/boutons) — bande ciné responsive */}
      <Animated.View
        entering={SlideInUp.springify().damping(18).stiffness(210)}
        exiting={SlideOutDown.duration(200)}
        style={[
          styles.bottomOverlay,
          {
            paddingBottom: bottomPadding,
            backgroundColor: "rgba(0,0,0,0.90)",
            borderTopLeftRadius: normalize(20),
            borderTopRightRadius: normalize(20),
            borderWidth: 1,
            borderColor: isDarkMode
              ? "rgba(255,255,255,0.08)"
              : "rgba(255,255,255,0.12)",
          },
          containerStyle,
        ]}
        pointerEvents="auto"
        accessibilityViewIsModal
        importantForAccessibility="yes"
      >
        <View style={styles.textContainer}>
          {icon ? <View style={styles.iconWrap}>{icon}</View> : null}

          <View style={styles.textGroup}>
            {renderWithWhiteText(title)}
            {renderWithWhiteText(description)}
          </View>

          {children}
        </View>

        {/* petit safe-area visuel (ultra clean) */}
        <View style={{ height: normalize(2) }} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  fullscreenContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  bottomOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: normalize(10),
    paddingHorizontal: normalize(16),
    alignSelf: "center",
    maxWidth: 640, // ✅ sur tablette / grands écrans : bande centrée
  },
  textContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
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
