// src/ui/Toast.tsx
import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from "react";
import { Animated, StyleSheet, Text, View, Easing, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ToastType = "info" | "success" | "error" | "warning";
type ToastOptions = { durationMs?: number };
type ToastCtx = { show: (msg: string, type?: ToastType, opts?: ToastOptions) => void };

const Ctx = createContext<ToastCtx>({ show: () => {} });
export const useToast = () => useContext(Ctx);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<string>("");
  const [type, setType] = useState<ToastType>("info");
  const [durationMs, setDurationMs] = useState<number>(2200);
  const [nonce, setNonce] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const scale = useRef(new Animated.Value(0.98)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((m: string, t: ToastType = "info", opts?: ToastOptions) => {
    setMsg(m);
    setType(t);
    setDurationMs(opts?.durationMs ?? 2200);
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!msg) return;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, speed: 18, bounciness: 6, useNativeDriver: true }),
    ]).start();

    timer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 20, duration: 200, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.98, duration: 200, useNativeDriver: true }),
      ]).start(() => setMsg(""));
    }, durationMs);

    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [msg, nonce, durationMs, opacity, translateY, scale]);

  const palette = (() => {
    switch (type) {
      case "success":
        return { bg: "#16a34a", border: "#22c55e", icon: "checkmark-circle-outline" as const };
      case "error":
        return { bg: "#dc2626", border: "#ef4444", icon: "close-circle-outline" as const };
      case "warning":
        return { bg: "#f59e0b", border: "#fbbf24", icon: "warning-outline" as const };
      default:
        return { bg: "#2563eb", border: "#60a5fa", icon: "information-circle-outline" as const };
    }
  })();

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {msg ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.wrap,
            {
              bottom: Math.max(insets.bottom, Platform.select({ ios: 36, android: 24 }) as number),
              opacity,
              transform: [{ translateY }, { scale }],
            },
          ]}
        >
          <View style={[styles.toast, { backgroundColor: palette.bg, borderColor: palette.border }]}>
            <View style={styles.row}>
              <Ionicons name={palette.icon} size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.text} numberOfLines={3}>{msg}</Text>
            </View>
          </View>
        </Animated.View>
      ) : null}
    </Ctx.Provider>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16, right: 16,
    alignItems: "center",
  },
  toast: {
    maxWidth: 640,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  text: {
    color: "#fff",
    fontSize: 15,
    textAlign: "center",
    fontFamily: "Comfortaa_700Bold",
    flexShrink: 1,
  },
});
