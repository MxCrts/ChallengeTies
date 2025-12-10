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
 */
const VIDEO_BY_STEP = [
  require("@/assets/videos/videoTuto1.mp4"), // 0 welcome
  require("@/assets/videos/videoTuto2.mp4"), // 1 explore
  require("@/assets/videos/videoTuto3.mp4"), // 2 create
  require("@/assets/videos/videoTuto4.mp4"), // 3 focus
  require("@/assets/videos/videoTuto5.mp4"), // 4 duo
  require("@/assets/videos/videoTuto6.mp4"), // 5 profile (placeholder)
  require("@/assets/videos/videoTuto7.mp4"), // 6 vote (placeholder)
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

  // ✅ padding bas MINIMAL mais safe-area friendly
  const bottomPadding = useMemo(
    () =>
      Math.max(
        insets.bottom,
        Platform.OS === "ios" ? normalize(4) : normalize(2)
      ),
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
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />

        {/* ✅ Overlay ciné (vignettage + lisibilité premium) */}
        <LinearGradient
          colors={["rgba(0,0,0,0.18)", "rgba(0,0,0,0.32)", "rgba(0,0,0,0.78)"]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Pane bas (titre/desc + boutons) — bande ciné ultra compacte */}
      <Animated.View
        entering={SlideInUp.springify().damping(18).stiffness(210)}
        exiting={SlideOutDown.duration(200)}
        style={[
          styles.bottomOverlay,
          {
            paddingBottom: Math.max(insets.bottom + normalize(6), normalize(12)),
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
        {/* 🧱 PARTIE HAUTE : icône + texte + progression */}
        <View style={styles.textContainer}>
          {icon ? <View style={styles.iconWrap}>{icon}</View> : null}

          <View style={styles.textGroup}>
            {renderWithWhiteText(title)}
            {renderWithWhiteText(description)}
          </View>
        </View>

        {/* 🧱 PARTIE BASSE : boutons COLLÉS EN BAS */}
        <View style={styles.actionsContainer}>
          {/* ESPACEUR FLEXIBLE → pousse toujours les boutons en bas */}
          <View style={{ flex: 1 }} />
          {children}
        </View>
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
    paddingVertical: normalize(8),
    paddingHorizontal: normalize(12),
    alignSelf: "center",
    maxWidth: 640,
    flexDirection: "column",
  },
  textContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: normalize(8),
    width: "100%",
  },
  iconWrap: {
    marginBottom: normalize(6),
    alignItems: "center",
    justifyContent: "center",
  },
  textGroup: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: normalize(6),
    width: "100%",
  },
  actionsContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingTop: normalize(8),
  },
  whiteText: {
    color: "#fff",
    textAlign: "center",
  },
});

export default TutorialVideoWrapper;
