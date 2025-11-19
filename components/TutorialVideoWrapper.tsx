// components/TutorialVideoWrapper.tsx
import React, { ReactNode, ReactElement } from "react";
import { View, StyleSheet, Text, StyleProp, ViewStyle, Platform } from "react-native";
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

  return (
    <View style={styles.fullscreenContainer} pointerEvents="box-none">
      {/* Fond neutre sombre (pas de vidéo) */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.75)" }]} />

      {/* Pane bas (titre/desc/boutons) */}
      <View
        style={[
          styles.bottomOverlay,
          {
            paddingBottom: normalize(12) + Math.max(insets.bottom, Platform.OS === "ios" ? normalize(8) : 0),
            backgroundColor: "rgba(0,0,0,0.9)",
            borderTopLeftRadius: normalize(20),
            borderTopRightRadius: normalize(20),
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
      </View>
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
