// src/ui/Toast.tsx
import React, { createContext, useContext, useRef, useState, useEffect } from "react";
import { Animated, StyleSheet, Text, View, Easing, Platform } from "react-native";

type ToastType = "info" | "success" | "error";
type ToastCtx = { show: (msg: string, type?: ToastType) => void };

const Ctx = createContext<ToastCtx>({ show: () => {} });
export const useToast = () => useContext(Ctx);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [msg, setMsg] = useState<string>("");
  const [type, setType] = useState<ToastType>("info");
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (m: string, t: ToastType = "info") => {
    setMsg(m);
    setType(t);
  };

  useEffect(() => {
    if (!msg) return;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();

    timer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 20, duration: 200, useNativeDriver: true }),
      ]).start(() => setMsg(""));
    }, 2200);

    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [msg]);

  const bg =
    type === "success" ? "#16a34a" :
    type === "error"   ? "#dc2626" : "#2563eb";

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {msg ? (
        <Animated.View style={[styles.wrap, { opacity, transform: [{ translateY }] }]}>
          <View style={[styles.toast, { backgroundColor: bg }]}>
            <Text style={styles.text} numberOfLines={2}>{msg}</Text>
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
    bottom: Platform.select({ ios: 40, android: 24 }),
    alignItems: "center",
  },
  toast: {
    maxWidth: 600, paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 14, shadowColor: "#000",
    shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  text: { color: "#fff", fontSize: 15, textAlign: "center", fontFamily: "Comfortaa_700Bold" },
});
