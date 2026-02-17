import React from "react";
import { View, Text, StyleSheet, Image, type ViewStyle, type TextStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const getInitials = (name?: string) => {
  const s = String(name || "").trim();
  if (!s) return "CT";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] || "").toUpperCase();
  const b = (parts[1]?.[0] || parts[0]?.[1] || "").toUpperCase();
  return (a + b).slice(0, 2) || "CT";
};

type Props = {
  uri?: string | null;
  name?: string;
  size?: number;
  isDark: boolean;
};

export default React.memo(function SmartAvatar({
  uri,
  name,
  size = 74,
  isDark,
}: Props) {
  const [failed, setFailed] = React.useState(false);

  const safeUri = typeof uri === "string" ? uri.trim() : "";
  const showImage = safeUri.length > 0 && !failed;

  const ring = isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.10)";
  const shell = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)";
  const text = isDark ? "rgba(255,255,255,0.94)" : "rgba(0,0,0,0.86)";
  const initials = getInitials(name);

  return (
    <View
      style={[
        styles.avatarShell,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: shell,
          borderColor: ring,
        },
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: safeUri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setFailed(true)}
          fadeDuration={120}
        />
      ) : (
        <LinearGradient
          colors={
            isDark
              ? ["rgba(255,159,28,0.95)", "rgba(0,194,255,0.88)"]
              : ["rgba(255,159,28,0.90)", "rgba(0,194,255,0.75)"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            StyleSheet.absoluteFillObject,
            { borderRadius: size / 2, alignItems: "center", justifyContent: "center" } as ViewStyle,
          ]}
        >
          <View
            pointerEvents="none"
            style={[
              styles.avatarSheen,
              { borderRadius: size / 2, opacity: isDark ? 0.22 : 0.28 },
            ]}
          />
          <Text
            style={[
              styles.avatarInitial,
              {
                color: text,
                fontSize: Math.round(size * 0.30),
                letterSpacing: 1.2,
                lineHeight: Math.round(size * 0.34),
                textAlignVertical: "center",
              },
            ]}
            numberOfLines={1}
          >
            {initials}
          </Text>
        </LinearGradient>
      )}

      <View
        style={[
          styles.avatarRing,
          { borderRadius: size / 2, borderColor: ring },
        ]}
        pointerEvents="none"
      />
      <View
        style={[
          styles.avatarSpecular,
          { borderRadius: size / 2, opacity: isDark ? 0.55 : 0.40 },
        ]}
        pointerEvents="none"
      />
    </View>
  );
});

type Styles = {
  avatarShell: ViewStyle;
  avatarRing: ViewStyle;
  avatarSpecular: ViewStyle;
  avatarSheen: ViewStyle;
  avatarInitial: TextStyle;
};

const styles = StyleSheet.create<Styles>({
  avatarShell: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    overflow: "hidden",
  },
  avatarRing: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
  },
  avatarSpecular: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    transform: [{ scaleX: 0.92 }, { scaleY: 0.92 }],
  },
  avatarSheen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.10)",
    transform: [{ rotate: "-18deg" }, { translateY: -14 }],
  },
  avatarInitial: {
    fontFamily: "Comfortaa_700Bold",
    includeFontPadding: false,
  },
});
