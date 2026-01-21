import React, { useMemo } from "react";
import { Modal, Pressable, StyleSheet, View, useWindowDimensions, Platform } from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import Svg, { Rect } from "react-native-svg";
import { BlurView } from "expo-blur";
import Animated from "react-native-reanimated";

type RectBox = { x: number; y: number; w: number; h: number };

type Props = {
  visible: boolean;
  rect: RectBox | null;
  onDismiss: () => void;
  onPressTarget: () => void;
  isDarkMode: boolean;
  ringStyle?: any; // Animated style
  padX: number;
  padY: number;
  radius: number;
};

export default function OnboardingSpotlight({
  visible,
  rect,
  onDismiss,
  onPressTarget,
  isDarkMode,
  ringStyle,
  padX,
  padY,
  radius,
}: Props) {
  const { width: W, height: H } = useWindowDimensions();

  const hole = useMemo(() => {
    if (!rect) return null;
    const left = Math.max(0, rect.x - padX);
    const top = Math.max(0, rect.y - padY);
    const width = rect.w + padX * 2;
    const height = rect.h + padY * 2;

    // Clamp pour éviter overflow weird sur Android
    const safeLeft = Math.min(left, Math.max(0, W - width));
    const safeTop = Math.min(top, Math.max(0, H - height));

    return { left: safeLeft, top: safeTop, width, height };
  }, [rect, padX, padY, W, H]);

  if (!visible || !hole) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent={Platform.OS === "android"}
      onRequestClose={onDismiss}
    >
      <View style={s.root} pointerEvents="box-none">
        {/* dimiss layer */}
        <Pressable
  style={[StyleSheet.absoluteFill, s.dismiss]}
  onPress={onDismiss}
/>

        {/* overlay with hole - no touch */}
        <MaskedView
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          maskElement={
            <Svg width="100%" height="100%">
              <Rect x="0" y="0" width="100%" height="100%" fill="white" />
              <Rect
                x={hole.left}
                y={hole.top}
                width={hole.width}
                height={hole.height}
                rx={radius}
                ry={radius}
                fill="black"
              />
            </Svg>
          }
        >
          <View style={StyleSheet.absoluteFill}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.55)" }]} />
            <BlurView
              intensity={isDarkMode ? 30 : 26}
              tint={isDarkMode ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          </View>
        </MaskedView>

        {/* ring - no touch */}
        <Animated.View
  pointerEvents="none"
  style={[
    s.ring,
    ringStyle,
    {
      left: hole.left,
      top: hole.top,
      width: hole.width,
      height: hole.height,
      borderRadius: radius,
      borderColor: isDarkMode ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.22)",
    },
  ]}
/>

<Pressable
  onPress={onPressTarget}
  style={[
    s.hotspot,
    {
      left: hole.left,
      top: hole.top,
      width: hole.width,
      height: hole.height,
      borderRadius: radius,
    },
  ]}
  hitSlop={8}
  accessibilityRole="button"
  accessibilityLabel="Mark"
/>

      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  dismiss: {
    zIndex: 1,
    elevation: 1,
  },

  ring: {
    position: "absolute",
    borderWidth: 2,
    backgroundColor: "transparent",
    zIndex: 20,
    elevation: 20,
  },

  hotspot: {
    position: "absolute",
    backgroundColor: "transparent",
    zIndex: 30,
    elevation: 30,
  },
});

