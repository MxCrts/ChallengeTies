import { Dimensions, Platform, StyleSheet, type ModalProps } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const IS_SMALL = SCREEN_WIDTH < 360;
const SPACING = 15;

const normalizeSize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * scale);
};

const introModalProps: Partial<ModalProps> = Platform.select<Partial<ModalProps>>({
  ios: {
    presentationStyle: "overFullScreen",
    transparent: true,
    statusBarTranslucent: true,
    animationType: "fade",
  } as const,
  android: {
    transparent: true,
    statusBarTranslucent: true,
    animationType: "fade",
    hardwareAccelerated: true,
  } as const,
  default: {
    animationType: "fade",
  } as const,
})!;

const dayIcons: Record<
  number,
  | "sunny-outline"
  | "flash-outline"
  | "timer-outline"
  | "calendar-outline"
  | "speedometer-outline"
  | "trending-up-outline"
  | "barbell-outline"
  | "rocket-outline"
> = {
  7: "sunny-outline",
  14: "flash-outline",
  21: "timer-outline",
  30: "calendar-outline",
  60: "speedometer-outline",
  90: "trending-up-outline",
  180: "barbell-outline",
  365: "rocket-outline",
};

const shadowSoft = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
  },
  android: { elevation: 6 },
  default: {},
});

const R = {
  hero: normalizeSize(30),
  card: 26,
  pill: 999,
  btn: normalizeSize(22),
};

const GLASS = {
  border: "rgba(255,255,255,0.14)",
  borderSoft: "rgba(255,255,255,0.10)",
  bg: "rgba(255,255,255,0.08)",
  bgSoft: "rgba(255,255,255,0.06)",
  bgDark: "rgba(10, 10, 15, 0.88)",
};

const ACCENT = {
  solid: "#F4D35E",
  softBorder: "rgba(244, 211, 94, 0.35)",
  softFill: "rgba(244, 211, 94, 0.16)",
  glow: "rgba(244, 211, 94, 0.55)",
};

const S = {
  card: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOpacity: 0.16,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 12 },
    },
    android: { elevation: 8 },
    default: {},
  }),
  float: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOpacity: 0.22,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 14 },
    },
    android: { elevation: 10 },
    default: {},
  }),
};

export {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  IS_SMALL,
  SPACING,
  normalizeSize,
  introModalProps,
  dayIcons,
  shadowSoft,
  R,
  GLASS,
  ACCENT,
  S,
};
