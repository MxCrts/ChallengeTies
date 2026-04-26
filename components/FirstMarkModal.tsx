/**
 * FirstMarkModal — modal premier marquage J1
 * CTA invite → challenge-details?openChoixDuo=1 (flow ChoixDuoModal existant)
 */
import React, { useEffect, useRef, useCallback } from "react";
import {
  Modal, View, Text, TouchableOpacity,
  StyleSheet, Animated, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import designSystem from "../theme/designSystem";
import * as Haptics from "expo-haptics";

const ORANGE = "#FF8C00";
const GOLD = "#FFD700";
const INK = "#0B0F17";
const DOT_COLORS = ["#FF8C00","#FFD700","#FF4D4D","#4DFF91","#4D9FFF","#FF4DD4","#FFFFFF"];

interface FirstMarkModalProps {
  visible: boolean;
  onDismiss: () => void;
  onInvite: () => void;
  challengeTitle?: string;
}

const ConfettiDot = React.memo(({
  delay, color, startX, startY,
}: { delay: number; color: string; startX: number; startY: number }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const translateY = anim.interpolate({ inputRange: [0,1], outputRange: [0,-130] });
  const translateX = anim.interpolate({ inputRange: [0,1], outputRange: [0,startX] });
  const opacity = anim.interpolate({ inputRange: [0,0.55,1], outputRange: [1,0.75,0] });
  const scale = anim.interpolate({ inputRange: [0,0.4,1], outputRange: [1,1.3,0.3] });
  return (
    <Animated.View pointerEvents="none" style={{
      position:"absolute", top:startY, left:"50%",
      width:8, height:8, borderRadius:4,
      backgroundColor:color, opacity,
      transform:[{translateY},{translateX},{scale}],
    }} />
  );
});

export default function FirstMarkModal({ visible, onDismiss, onInvite, challengeTitle }: FirstMarkModalProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.86)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const badgePulse = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);
  const glowRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!visible) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.timing(backdropOpacity, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    Animated.spring(cardScale, { toValue: 1, tension: 85, friction: 8, useNativeDriver: true }).start();
    Animated.timing(cardOpacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    pulseRef.current = Animated.loop(Animated.sequence([
      Animated.timing(badgePulse, { toValue: 1.10, duration: 680, useNativeDriver: true }),
      Animated.timing(badgePulse, { toValue: 1.0, duration: 680, useNativeDriver: true }),
    ]));
    pulseRef.current.start();
    glowRef.current = Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 1100, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0, duration: 1100, useNativeDriver: true }),
    ]));
    glowRef.current.start();
    return () => { pulseRef.current?.stop(); glowRef.current?.stop(); };
  }, [visible]);

  const closeAnim = useCallback((cb: () => void) => {
    pulseRef.current?.stop(); glowRef.current?.stop();
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.spring(cardScale, { toValue: 0.92, useNativeDriver: true }),
    ]).start(() => cb());
  }, [backdropOpacity, cardOpacity, cardScale]);

  const handleDismiss = useCallback(() => closeAnim(onDismiss), [closeAnim, onDismiss]);
  const handleInvite = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    closeAnim(onInvite);
  }, [closeAnim, onInvite]);

  const confettiDots = useRef(Array.from({ length: 14 }, (_, i) => ({
    id: i, color: DOT_COLORS[i % DOT_COLORS.length],
    delay: i * 95,
    startX: (i % 2 === 0 ? 1 : -1) * (18 + (i % 5) * 16),
    startY: 8 + (i % 4) * 6,
  }))).current;

  const glowOpacity = glowAnim.interpolate({ inputRange: [0,1], outputRange: [0.14,0.44] });

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleDismiss}>
      <Animated.View style={[s.backdrop, { opacity: backdropOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleDismiss} />
      </Animated.View>
      <View style={s.centerer} pointerEvents="box-none">
        <Animated.View style={[s.card, {
          backgroundColor: isDark ? "rgba(13,17,27,0.97)" : "rgba(255,255,255,0.98)",
          borderColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)",
          transform: [{ scale: cardScale }], opacity: cardOpacity,
        }]}>
          {/* Glow top */}
          <Animated.View pointerEvents="none" style={[s.glowTop, { opacity: glowOpacity }]}>
            <LinearGradient colors={["rgba(255,140,0,0.90)","transparent"]}
              start={{ x:0.5,y:0 }} end={{ x:0.5,y:1 }} style={StyleSheet.absoluteFillObject} />
          </Animated.View>
          {/* Confetti */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {confettiDots.map(d => <ConfettiDot key={d.id} {...d} />)}
          </View>
          {/* Badge */}
          <View style={s.badgeRow}>
            <Animated.View style={[s.badgeWrap, { transform: [{ scale: badgePulse }] }]}>
              <LinearGradient colors={["#FFD700","#FF8C00"]} start={{x:0,y:0}} end={{x:1,y:1}} style={s.badgeGrad}>
                <Text style={s.badgeEmoji}>🔥</Text>
              </LinearGradient>
            </Animated.View>
            <View style={[s.streakPill, {
              backgroundColor: isDark ? "rgba(255,140,0,0.16)" : "rgba(255,140,0,0.10)",
              borderColor: "rgba(255,140,0,0.38)",
            }]}>
              <Text style={s.streakPillText}>{t("firstMark.badge", { defaultValue: "Jour 1 ✓" }) as string}</Text>
            </View>
          </View>
          {/* Title */}
          <Text style={[s.title, { color: isDark ? "#fff" : INK }]} numberOfLines={2} adjustsFontSizeToFit>
            {t("firstMark.title", { defaultValue: "Tu l'as fait. Jour 1 coché." }) as string}
          </Text>
          {/* Subtitle */}
          <Text style={[s.subtitle, { color: isDark ? "rgba(255,255,255,0.70)" : "rgba(0,0,0,0.62)" }]}>
            {t("firstMark.subtitle", { defaultValue: "C'est là que la plupart abandonnent. Pas toi." }) as string}
          </Text>
          {/* Divider */}
          <View style={[s.divider, { backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)" }]} />
          {/* Body */}
          <View style={s.bodyWrap}>
            {[
              { emoji: "📅", key: "firstMark.bodyLine1", def: "Reviens demain pour maintenir ta série. L'habitude se construit jour après jour." },
              { emoji: "👥", key: "firstMark.bodyLine2", def: "Avec quelqu'un à tes côtés, tu as 65% plus de chances de tenir." },
            ].map(({ emoji, key, def }) => (
              <View key={key} style={s.bodyLine}>
                <View style={[s.bodyIcon, { backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)" }]}>
                  <Text style={{ fontSize: 16 }}>{emoji}</Text>
                </View>
                <Text style={[s.bodyText, { color: isDark ? "rgba(255,255,255,0.80)" : "rgba(0,0,0,0.72)" }]} numberOfLines={3}>
                  {t(key, { defaultValue: def }) as string}
                </Text>
              </View>
            ))}
          </View>
          {/* CTAs */}
          <View style={s.ctasWrap}>
            <TouchableOpacity onPress={handleInvite} activeOpacity={0.88} style={s.ctaInvite} accessibilityRole="button">
              <LinearGradient colors={["#FFB000","#FF8C00"]} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFillObject} />
              <LinearGradient pointerEvents="none" colors={["rgba(255,255,255,0.26)","rgba(255,255,255,0.00)"]}
                start={{x:0.5,y:0}} end={{x:0.5,y:1}} style={StyleSheet.absoluteFillObject} />
              <Ionicons name="people" size={18} color="#000" />
              <Text style={s.ctaInviteText}>{t("firstMark.cta.invite", { defaultValue: "Inviter quelqu'un" }) as string}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDismiss} activeOpacity={0.88}
              style={[s.ctaTomorrow, {
                backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)",
                borderColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.07)",
              }]} accessibilityRole="button">
              <Ionicons name="moon-outline" size={16} color={isDark ? "rgba(255,255,255,0.62)" : "rgba(0,0,0,0.52)"} />
              <Text style={[s.ctaTomorrowText, { color: isDark ? "rgba(255,255,255,0.62)" : "rgba(0,0,0,0.52)" }]}>
                {t("firstMark.cta.tomorrow", { defaultValue: "À demain !" }) as string}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={handleDismiss} hitSlop={12} style={s.skipBtn} accessibilityRole="button">
            <Text style={[s.skipText, { color: isDark ? "rgba(255,255,255,0.26)" : "rgba(0,0,0,0.26)" }]}>
              {t("firstMark.cta.skip", { defaultValue: "Fermer" }) as string}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.65)" },
  centerer: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  card: { width:"100%", maxWidth:420, borderRadius:28, borderWidth:1, overflow:"hidden", padding:24,
    ...Platform.select({ ios:{ shadowColor:"#000", shadowOffset:{width:0,height:22}, shadowOpacity:0.38, shadowRadius:32 }, android:{ elevation:22 } }) },
  glowTop: { position:"absolute", top:0, left:0, right:0, height:110 },
  badgeRow: { flexDirection:"row", alignItems:"center", gap:12, marginBottom:18 },
  badgeWrap: { shadowColor:ORANGE, shadowOffset:{width:0,height:6}, shadowOpacity:0.55, shadowRadius:14, elevation:10 },
  badgeGrad: { width:58, height:58, borderRadius:18, alignItems:"center", justifyContent:"center" },
  badgeEmoji: { fontSize:28 },
  streakPill: { paddingHorizontal:12, paddingVertical:6, borderRadius:999, borderWidth:1 },
  streakPillText: { fontFamily:"Comfortaa_700Bold", fontSize:13, color:ORANGE },
  title: { fontFamily:"Comfortaa_700Bold", fontSize:22, lineHeight:28, marginBottom:8 },
  subtitle: { fontFamily:"Comfortaa_400Regular", fontSize:14, lineHeight:20, marginBottom:18 },
  divider: { width:"100%", height:1, marginBottom:18 },
  bodyWrap: { gap:14, marginBottom:24 },
  bodyLine: { flexDirection:"row", alignItems:"flex-start", gap:12 },
  bodyIcon: { width:36, height:36, borderRadius:11, alignItems:"center", justifyContent:"center", flexShrink:0 },
  bodyText: { flex:1, fontFamily:"Comfortaa_400Regular", fontSize:13, lineHeight:19 },
  ctasWrap: { gap:10, marginBottom:14 },
  ctaInvite: { height:54, borderRadius:18, overflow:"hidden", flexDirection:"row", alignItems:"center", justifyContent:"center", gap:10, borderWidth:1, borderColor:"rgba(0,0,0,0.07)" },
  ctaInviteText: { fontFamily:"Comfortaa_700Bold", fontSize:16, color:"#000" },
  ctaTomorrow: { height:50, borderRadius:16, borderWidth:1, flexDirection:"row", alignItems:"center", justifyContent:"center", gap:8 },
  ctaTomorrowText: { fontFamily:"Comfortaa_700Bold", fontSize:15 },
  skipBtn: { alignItems:"center", paddingTop:2 },
  skipText: { fontFamily:"Comfortaa_400Regular", fontSize:12 },
});