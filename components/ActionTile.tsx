// components/ActionTile.tsx
import React, { memo, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, Platform, StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

type ActionTileProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  badge?: string;
  onPress: () => void;
  tone?: "default" | "accent";
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  colors?: {
    bg?: string;
    border?: string;
    title?: string;
    subtitle?: string;
    icon?: string;
    chevron?: string;
    iconBg?: string;
    accentIcon?: string;
    accentIconBg?: string;
    badgeBg?: string;
  };
};

function ActionTileBase({
  icon,
  title,
  subtitle,
  badge,
  onPress,
  tone = "default",
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
  colors,
}: ActionTileProps) {
  const isAccent = tone === "accent";

  const c = useMemo(() => {
    const base = {
      bg: "rgba(255,255,255,0.08)",
      border: "rgba(255,255,255,0.14)",
      title: "#FFFFFF",
      subtitle: "rgba(255,255,255,0.72)",
      icon: "#FFFFFF",
      chevron: "rgba(255,255,255,0.65)",
      iconBg: "rgba(255,255,255,0.10)",
      accentIcon: "#0B0B0C",
      accentIconBg: "rgba(244,211,94,0.92)",
      badgeBg: "rgba(255,255,255,0.14)",
    };
    return { ...base, ...(colors || {}) };
  }, [colors]);

  const accentGradientColors = useMemo(
    () =>
      ["rgba(244,211,94,0.95)", "rgba(255,255,255,0.35)"] as const,
    []
  );

  const titleColor = disabled
    ? "rgba(255,255,255,0.45)"
    : isAccent
    ? "#0B0B0C"
    : c.title;

  const subColor = disabled
    ? "rgba(255,255,255,0.35)"
    : isAccent
    ? "rgba(11,11,12,0.70)"
    : c.subtitle;

  const iconColor = disabled
    ? "rgba(255,255,255,0.45)"
    : isAccent
    ? c.accentIcon
    : c.icon;

  const iconBg = disabled
    ? "rgba(255,255,255,0.06)"
    : isAccent
    ? c.accentIconBg
    : c.iconBg;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.press,
        style,
        pressed && !disabled && { transform: [{ scale: 0.985 }], opacity: 0.92 },
        disabled && { opacity: 0.72 },
      ]}
    >
      {isAccent ? (
        <LinearGradient
          colors={accentGradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.tile,
            {
              borderColor: c.border,
            },
          ]}
        >
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
              <Ionicons name={icon} size={20} color={iconColor} />
            </View>

            <View style={styles.textCol}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>
                  {title}
                </Text>

                {!!badge && (
                  <View style={[styles.badge, { backgroundColor: "rgba(11,11,12,0.16)" }]}>
                    <Text style={[styles.badgeText, { color: "#0B0B0C" }]} numberOfLines={1}>
                      {badge}
                    </Text>
                  </View>
                )}
              </View>

              {!!subtitle && (
                <Text style={[styles.subtitle, { color: subColor }]} numberOfLines={1}>
                  {subtitle}
                </Text>
              )}
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={disabled ? "rgba(255,255,255,0.25)" : "rgba(11,11,12,0.55)"}
              style={{ marginLeft: 10 }}
            />
          </View>
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.tile,
            {
              backgroundColor: c.bg,
              borderColor: c.border,
            },
          ]}
        >
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
              <Ionicons name={icon} size={20} color={iconColor} />
            </View>

            <View style={styles.textCol}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>
                  {title}
                </Text>

                {!!badge && (
                  <View style={[styles.badge, { backgroundColor: c.badgeBg }]}>
                    <Text style={[styles.badgeText, { color: "#FFFFFF" }]} numberOfLines={1}>
                      {badge}
                    </Text>
                  </View>
                )}
              </View>

              {!!subtitle && (
                <Text style={[styles.subtitle, { color: subColor }]} numberOfLines={1}>
                  {subtitle}
                </Text>
              )}
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={disabled ? "rgba(255,255,255,0.25)" : c.chevron}
              style={{ marginLeft: 10 }}
            />
          </View>
        </View>
      )}
    </Pressable>
  );
}

export const ActionTile = memo(ActionTileBase);

const styles = StyleSheet.create({
  press: {
    borderRadius: 20,
    overflow: "hidden",
  },
  tile: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.16,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: "700",
    includeFontPadding: false,
  },
  subtitle: {
    marginTop: 3,
    fontSize: 12.5,
    fontWeight: "600",
    includeFontPadding: false,
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
});
