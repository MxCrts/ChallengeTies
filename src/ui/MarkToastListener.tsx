import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  DeviceEventEmitter,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  AccessibilityInfo,
  StyleProp,
  ViewStyle,
  TextStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { MARK_TOAST_EVENT } from "@/context/CurrentChallengesContext";
import { useTranslation } from "react-i18next";

type MarkToastPayload = {
  kind: "success" | "info" | "warning" | "error";
  title?: string;         // ✅ optionnel (on peut auto-générer)
  message?: string;
  vibe?: "mark" | "streak" | "trophies" | "complete";
  // ✅ contexte optionnel si tu veux un message adapté aux jours
  progress?: { dayIndex?: number; totalDays?: number }; // ex: 3/7
};

const SHOW_MS = 1350;
const OUT_MS = 190;
const DEDUPE_MS = 700;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const SPARKS = 12;

export default function MarkToastListener() {
  const { t } = useTranslation();

  const [payload, setPayload] = useState<MarkToastPayload | null>(null);
  const [visible, setVisible] = useState(false);

  // ✅ Sparks geometry (stable) — HOOK toujours appelé (sinon "hooks order change")
  const sparks = useMemo(() => {
    return Array.from({ length: SPARKS }).map((_, i) => {
      const a = (i / SPARKS) * Math.PI * 2;
      const jitter = ((i % 2) * 2 - 1) * 0.12;
      return { a: a + jitter, i };
    });
  }, []);

  const reduceMotionRef = useRef(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (mounted) reduceMotionRef.current = !!v;
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", (v) => {
      reduceMotionRef.current = !!v;
    });
    return () => {
      mounted = false;
      // @ts-ignore compat
      sub?.remove?.();
    };
  }, []);

  const lastRef = useRef<{ key: string; ts: number } | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Anim values (center cinematic)
  const scrim = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;
  const lift = useRef(new Animated.Value(14)).current;
  // FX
  const halo = useRef(new Animated.Value(0)).current; // 0..1
  const ring = useRef(new Animated.Value(0)).current; // 0..1
  const spark = useRef(new Animated.Value(0)).current; // 0..1 burst
  const sheen = useRef(new Animated.Value(0)).current;
  const stopTimers = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const hardResetAnim = () => {
    scrim.stopAnimation();
    opacity.stopAnimation();
    scale.stopAnimation();
    lift.stopAnimation();
    halo.stopAnimation();
    ring.stopAnimation();
    spark.stopAnimation();
    sheen.stopAnimation();
    scrim.setValue(0);
    opacity.setValue(0);
    scale.setValue(0.94);
    lift.setValue(14);
    halo.setValue(0);
    ring.setValue(0);
    spark.setValue(0);
    sheen.setValue(0);
  };

  const animateIn = () => {
    const reduce = reduceMotionRef.current;
    if (reduce) {
      scrim.setValue(0.55);
      opacity.setValue(1);
      scale.setValue(1);
      lift.setValue(0);
      halo.setValue(1);
      ring.setValue(1);
      spark.setValue(1);
      sheen.setValue(1);
      return;
    }

    Animated.parallel([
      Animated.timing(scrim, {
        toValue: 0.52,
        duration: 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        damping: 18,
        stiffness: 260,
        mass: 0.7,
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // FX: halo + ring
      Animated.timing(halo, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(ring, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // FX: spark burst + sheen sweep (ultra premium)
      Animated.sequence([
        Animated.timing(spark, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(spark, {
          toValue: 0,
          duration: 420,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(60),
        Animated.timing(sheen, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const animateOut = (cb?: () => void) => {
    stopTimers();
    const reduce = reduceMotionRef.current;
    if (reduce) {
      scrim.setValue(0);
      opacity.setValue(0);
      cb?.();
      return;
    }

    Animated.parallel([
      Animated.timing(scrim, {
        toValue: 0,
        duration: OUT_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: OUT_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.985,
        duration: OUT_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 6,
        duration: OUT_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) cb?.();
    });
  };

  const pickRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  const resolveCopy = (p: MarkToastPayload) => {
    const vibe = p.vibe ?? "mark";
    const kind = p.kind;

    // ✅ Kicker localisé + neutral
    const kickerKey =
      kind === "error"
        ? "markToast.kicker.error"
        : vibe === "complete"
        ? "markToast.kicker.complete"
        : vibe === "streak"
        ? "markToast.kicker.streak"
        : "markToast.kicker.mark";

    const kicker = t(kickerKey, { defaultValue: "DONE" });

    // ✅ Title/message: si l'écran envoie title ok, sinon on génère une punchline
    if (p.title) {
      return { kicker, title: p.title, message: p.message };
    }

    // 🔥 messages “top monde” (pas de trophées, pas de gamification cheap)
    // Option: adaptation légère selon progression (jourIndex/totalDays)
    const dayIndex = p.progress?.dayIndex;
    const totalDays = p.progress?.totalDays;
    const hasProgress =
      typeof dayIndex === "number" &&
      Number.isFinite(dayIndex) &&
      typeof totalDays === "number" &&
      Number.isFinite(totalDays) &&
      totalDays > 0;

    const pct = hasProgress ? clamp01(dayIndex / totalDays) : null;

    const packEarly = [
      t("markToast.lines.early.0", { defaultValue: "Parfait. Tu avances." }),
      t("markToast.lines.early.1", { defaultValue: "Un jour de plus. Zéro débat." }),
      t("markToast.lines.early.2", { defaultValue: "C’est comme ça qu’on gagne." }),
      t("markToast.lines.early.3", { defaultValue: "Focus. C’est validé." }),
    ];
    const packMid = [
      t("markToast.lines.mid.0", { defaultValue: "Tu prends de l’avance." }),
      t("markToast.lines.mid.1", { defaultValue: "Rythme maintenu. Continue." }),
      t("markToast.lines.mid.2", { defaultValue: "Tu es en train de changer." }),
    ];
    const packLate = [
      t("markToast.lines.late.0", { defaultValue: "Dernière ligne droite." }),
      t("markToast.lines.late.1", { defaultValue: "Ne lâche rien. C’est maintenant." }),
      t("markToast.lines.late.2", { defaultValue: "Tu vas au bout. Point." }),
    ];

    let title = t("markToast.defaultTitle", { defaultValue: "Validé ✅" });

    if (kind === "error") {
      title = t("markToast.errorTitle", { defaultValue: "Oups. Pas validé." });
      const msg = t("markToast.errorMsg", { defaultValue: "Réessaie dans un instant." });
      return { kicker, title, message: msg };
    }

    if (!hasProgress) {
      // 10 lignes random (sans contexte jours)
      const pool = [
        ...packEarly,
        ...packMid,
        ...packLate,
        t("markToast.lines.generic.0", { defaultValue: "Discipline > motivation." }),
        t("markToast.lines.generic.1", { defaultValue: "Une action. Une preuve." }),
        t("markToast.lines.generic.2", { defaultValue: "Tu fais partie des rares." }),
      ];
      return { kicker, title, message: pickRandom(pool) };
    }

    // ✅ avec contexte jours: early/mid/late + une info soft
    const pool =
      pct != null && pct < 0.34 ? packEarly : pct != null && pct < 0.75 ? packMid : packLate;

    const prog = t("markToast.progressTpl", {
      defaultValue: "Jour {{d}} / {{t}}",
      d: String(dayIndex),
      t: String(totalDays),
    });

    return { kicker, title, message: `${pickRandom(pool)}  •  ${prog}` };
  };

  const showOverlay = (p: MarkToastPayload) => {
    // ✅ si un toast arrive pendant un autre → on remplace proprement (pas d'attente)
    stopTimers();

    // reset anim pour impression “instant”
    hardResetAnim();

    setPayload(p);
    setVisible(true);

    // ⚡️ lance l’anim sur le prochain frame → plus smooth sur Android debug
    requestAnimationFrame(() => {
      animateIn();
    });

    // ✅ burst plus épique si completion
    if (p.vibe === "complete" && !reduceMotionRef.current) {
      // ring pulse
      ring.setValue(0);
      Animated.sequence([
        Animated.timing(ring, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(ring, {
          toValue: 0.86,
          duration: 180,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
      // ✅ completion = burst + sheen renforcé
      spark.setValue(0);
      sheen.setValue(0);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(spark, {
            toValue: 1,
            duration: 240,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(spark, {
            toValue: 0,
            duration: 520,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(sheen, {
            toValue: 1,
            duration: 620,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }

    hideTimerRef.current = setTimeout(() => {
      animateOut(() => {
        setVisible(false);
        setPayload(null);
      });
    }, SHOW_MS);
  };

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(MARK_TOAST_EVENT, (p: MarkToastPayload) => {
      if (!p) return;

      const resolved = resolveCopy(p);
      const p2: MarkToastPayload = { ...p, title: resolved.title, message: resolved.message };

      // 🔒 anti double
      const key = `${p2.kind}|${p2.vibe ?? ""}|${p2.title ?? ""}|${p2.message ?? ""}`;
      const now = Date.now();
      if (lastRef.current && lastRef.current.key === key && now - lastRef.current.ts < DEDUPE_MS) {
        return;
      }
      lastRef.current = { key, ts: now };

      showOverlay(p2);
    });

    return () => {
      sub.remove();
      stopTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ui = useMemo(() => {
    const vibe = payload?.vibe ?? "mark";
    const kind = payload?.kind ?? "success";

    if (kind === "error") return { icon: "close-circle-outline" as const };
    if (vibe === "complete") return { icon: "sparkles-outline" as const };
    if (vibe === "streak") return { icon: "flame-outline" as const };
    return { icon: "checkmark-circle-outline" as const };
  }, [payload?.vibe, payload?.kind]);

  if (!visible || !payload) return null;

  const copy = resolveCopy(payload);

  return (
    <View pointerEvents="box-none" style={styles.root}>
      <Animated.View pointerEvents="none" style={[styles.scrim, { opacity: scrim }]} />
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => {
          animateOut(() => {
            setVisible(false);
            setPayload(null);
          });
        }}
      />

      <View pointerEvents="box-none" style={styles.centerWrap}>
        <Animated.View
          style={[
            styles.toastOuter,
            {
              opacity,
              transform: [{ translateY: lift }, { scale }],
            },
          ]}
        >
          {/* Halo FX behind */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.halo,
              {
                opacity: halo.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
                transform: [
                  {
                    scale: halo.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.92, 1.06],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ring,
              {
                opacity: ring.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
                transform: [
                  {
                    scale: ring.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.86, payload.vibe === "complete" ? 1.18 : 1.1],
                    }),
                  },
                ],
              },
            ]}
          />

          {/* Spark burst (premium, pas de confettis) */}
          {!reduceMotionRef.current && (
            <View pointerEvents="none" style={styles.sparkLayer}>
              {sparks.map(({ a, i }) => {
                const dist = payload.vibe === "complete" ? 56 : 44;
                const x = Math.cos(a) * dist;
                const y2 = Math.sin(a) * dist;
                const w = i % 3 === 0 ? 2.2 : 1.6;
                const h = i % 2 === 0 ? 16 : 12;
                const rot = `${(a * 180) / Math.PI}deg`;

                const op = spark.interpolate({
                  inputRange: [0, 0.18, 1],
                  outputRange: [0, 1, 0],
                });
                const sc = spark.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.7, 1.12],
                });
                const tx = spark.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, x],
                });
                const ty = spark.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, y2],
                });

                return (
                  <Animated.View
                    key={`s-${i}`}
                    style={[
                      styles.spark,
                      {
                        width: w,
                        height: h,
                        opacity: op,
                        transform: [{ translateX: tx }, { translateY: ty }, { rotate: rot }, { scale: sc }],
                      },
                    ]}
                  />
                );
              })}
            </View>
          )}
          {/* Glass premium + plus opaque (lisible) */}
          <LinearGradient
            colors={[
              "rgba(20,20,28,0.92)",
              "rgba(12,12,18,0.88)",
              "rgba(0,0,0,0.84)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.toast}
          >
            {/* Hairline highlight */}
            <View style={styles.highlightLine} />

            {/* Sheen sweep (reflet) */}
            {!reduceMotionRef.current && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.sheen,
                  {
                    opacity: sheen.interpolate({
                      inputRange: [0, 0.25, 1],
                      outputRange: [0, 0.55, 0],
                    }),
                    transform: [
                      {
                        translateX: sheen.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-220, 220],
                        }),
                      },
                      { rotate: "-18deg" },
                    ],
                  },
                ]}
              />
            )}

            <View style={styles.row}>
              <View style={styles.iconShell}>
                <Ionicons name={ui.icon} size={18} color={"rgba(255,255,255,0.96)"} />
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.kicker} numberOfLines={1}>
                  {copy.kicker}
                </Text>
                <Text style={styles.title} numberOfLines={2}>
                  {copy.title}
                </Text>

                {!!copy.message && (
                  <Text style={styles.message} numberOfLines={2}>
                    {copy.message}
                  </Text>
                )}
              </View>

              <Pressable
                hitSlop={10}
                onPress={() => {
                  animateOut(() => {
                    setVisible(false);
                    setPayload(null);
                  });
                }}
                accessibilityRole="button"
                accessibilityLabel={t("markToast.dismiss", { defaultValue: "Fermer" })}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={18} color={"rgba(255,255,255,0.75)"} />
              </Pressable>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </View>
  );
}

type Styles = {
  root: ViewStyle;
  scrim: ViewStyle;
  centerWrap: ViewStyle;
  toastOuter: ViewStyle;
  halo: ViewStyle;
  ring: ViewStyle;
  sparkLayer: ViewStyle;
  spark: ViewStyle;
  toast: ViewStyle;
  highlightLine: ViewStyle;
  row: ViewStyle;
  iconShell: ViewStyle;
  closeBtn: ViewStyle;
  sheen: ViewStyle;
  kicker: TextStyle;
  title: TextStyle;
  message: TextStyle;
};

const styles = StyleSheet.create<Styles>({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999999,
    elevation: 999999,
  },
scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.52)",
  },
  centerWrap: {
    flex: 1,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  toastOuter: {
    width: "100%",
    maxWidth: 460,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 18,
  },
  halo: {
    position: "absolute",
    left: -28,
    right: -28,
    top: -28,
    bottom: -28,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  sparkLayer: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 1,
    height: 1,
    transform: [{ translateX: -0.5 }, { translateY: -14 }],
  },
  spark: {
    position: "absolute",
    left: 0,
    top: 0,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.92)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },sheen: {
    position: "absolute",
    top: -60,
    bottom: -60,
    width: 90,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  ring: {
    position: "absolute",
    left: -18,
    right: -18,
    top: -18,
    bottom: -18,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
  },
  toast: {
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.14)",
  },
  highlightLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.24)",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  iconShell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.16)",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.10)",
  },
  kicker: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: 11.5,
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.70)",
    marginBottom: 2,
  },

  title: {
    fontFamily: "Comfortaa_700Bold",
    fontSize: 15.5,
    lineHeight: 19,
    color: "rgba(255,255,255,0.96)",
  },

  message: {
    marginTop: 4,
    fontFamily: "Comfortaa_400Regular",
    fontSize: 12.5,
    lineHeight: 16.5,
    color: "rgba(255,255,255,0.82)",
  },
});
