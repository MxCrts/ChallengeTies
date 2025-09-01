import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  FlatList,
  Alert,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../constants/firebase-config";
import { useTheme } from "../context/ThemeContext";
import designSystem from "../theme/designSystem";
import { useCurrentChallenges } from "../context/CurrentChallengesContext";
import SendInvitationModal from "@/components/SendInvitationModal";
import InfoDuoModal from "@/components/InfoDuoModal";
import { useTranslation } from "react-i18next";

const { width, height } = Dimensions.get("window");
const SPACING = 16;
const CARD_W = (width - SPACING * 3) / 2;
const CARD_H = Math.min(220, height * 0.28);

type Challenge = {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl?: string;
  chatId?: string;
  daysOptions?: number[];
};

const DEFAULT_DAYS = [7, 14, 21, 30, 60, 90];
const ORANGE = "#FF8C00";

export default function FirstPick() {
   const { t } = useTranslation(); 
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const currentTheme = isDark ? designSystem.darkTheme : designSystem.lightTheme;
  const [inviteModalVisible, setInviteModalVisible] = useState(false);

  const router = useRouter();
  const { takeChallenge } = useCurrentChallenges();
const [infoDuoVisible, setInfoDuoVisible] = useState(false);


  // Fade-in d'écran
  const introOpacity = useRef(new Animated.Value(0)).current;
  const introScale = useRef(new Animated.Value(0.985)).current;

  const [mode, setMode] = useState<"none" | "duo" | "solo">("none");
  const [loading, setLoading] = useState(true);
  const [pool, setPool] = useState<Challenge[]>([]);
  const [items, setItems] = useState<Challenge[]>([]);
  const [selected, setSelected] = useState<Challenge | null>(null);
  const [days, setDays] = useState<number>(DEFAULT_DAYS[0]);
  const [submitting, setSubmitting] = useState(false);

  // Lancement du fade-in
  useEffect(() => {
    Animated.parallel([
      Animated.timing(introOpacity, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.timing(introScale, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleInviteDismiss = () => {
  // L'utilisateur ferme sans envoyer => on reste sur first-pick
  setInviteModalVisible(false);
  // (aucune redirection, aucun flag 'done')
};

const handleInvitationSent = async () => {
  // L'utilisateur a envoyé => on ferme + on va à l'index (tuto)
  setInviteModalVisible(false);
  await AsyncStorage.setItem("firstPickDone", "1");
  await goToHomeWithTutorial();
};


  // Récup challenges approuvés
  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const qRef = query(
          collection(db, "challenges"),
          where("approved", "==", true),
        );
        const snap = await getDocs(qRef);

        const list: Challenge[] = snap.docs.map((d) => {
          const data: any = d.data();
          return {
            id: d.id,
            title: data?.chatId ? (data?.title || data?.chatId) : (data?.title || t("common.challenge")),
            description: data?.description || "",
            category: data?.category || t("common.misc"),
            imageUrl: data?.imageUrl || "https://via.placeholder.com/600x400",
            chatId: data?.chatId || d.id,
            daysOptions:
              Array.isArray(data?.daysOptions) && data.daysOptions.length
                ? data.daysOptions
                : DEFAULT_DAYS,
          };
        });

        setPool(list);
      } catch (e) {
        console.error("first-pick fetch error", e);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  // Échantillon : 1 aléatoire par catégorie (max 6)
  useEffect(() => {
    if (!pool.length) {
      setItems([]);
      return;
    }

    const byCat: Record<string, Challenge[]> = {};
    for (const c of pool) {
      const cat = c.category || "Divers";
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(c);
    }

    const cats = Object.keys(byCat).sort(() => Math.random() - 0.5);
    const sampled: Challenge[] = [];

    for (const cat of cats) {
      const arr = byCat[cat];
      const pick = arr[Math.floor(Math.random() * arr.length)];
      if (pick) sampled.push(pick);
      if (sampled.length >= 6) break;
    }

    setItems(sampled);

    if (selected && !sampled.find((s) => s.id === selected.id)) {
      setSelected(null);
    }
  }, [pool]);

  const goToHomeWithTutorial = async () => {
    await AsyncStorage.setItem("pendingTutorial", "1");
    router.replace({ pathname: "/", params: { startTutorial: "1" } });
  };

  const onSkip = async () => {
    await AsyncStorage.setItem("firstPickSkipped", "1");
    await goToHomeWithTutorial();
  };

  const handleCloseInviteModal = async () => {
    setInviteModalVisible(false);
    await AsyncStorage.setItem("firstPickDone", "1");
    await goToHomeWithTutorial(); // redirige vers index avec tuto
  };

   const onConfirm = async () => {
    if (!selected) {
  Alert.alert(t("firstPick.alert.missingChoiceTitle"), t("firstPick.alert.missingChoiceBody"));
  return;
}
    if (mode === "none") {
  Alert.alert(t("firstPick.alert.modeTitle"), t("firstPick.alert.modeBody"));
  return;
}

    try {
      setSubmitting(true);

      const ref = doc(db, "challenges", selected.id);
      const snap = await getDoc(ref);
      const data: any = snap.exists() ? snap.data() : {};

      const challengeObj = {
        id: selected.id,
        title: selected.title || data?.title || t("common.challenge"),
        category: selected.category || data?.category || t("common.misc"),
description: selected.description || data?.description || "",
        daysOptions: selected.daysOptions || data?.daysOptions || DEFAULT_DAYS,
        chatId: selected.chatId || selected.id,
        imageUrl: selected.imageUrl || data?.imageUrl || "",
      };

      if (mode === "solo") {
        await takeChallenge(challengeObj, days);
        await AsyncStorage.setItem("firstPickDone", "1");
        await goToHomeWithTutorial();
        return;
      }

      if (mode === "duo") {
        setInfoDuoVisible(true);
        return;
      }
    } catch (e: any) {
  console.error("first-pick confirm error", e);
  Alert.alert(t("common.error"), e?.message || t("common.oops"));
} finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
      <Animated.View
        style={{
          flex: 1,
          opacity: introOpacity,
          transform: [{ scale: introScale }],
        }}
      >
        <LinearGradient
          colors={[
            currentTheme.colors.background,
            currentTheme.colors.cardBackground,
          ]}
          style={styles.container}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text
  style={[styles.title, { color: isDark ? currentTheme.colors.textPrimary : ORANGE }]}
>
  {t("firstPick.title")}
</Text>

            <Text
  style={[styles.subtitle, { color: isDark ? currentTheme.colors.textSecondary : ORANGE }]}
>
  {t("firstPick.subtitle")}
</Text>

            {/* Mode Pills */}
            <View style={styles.modeRow}>
              <TouchableOpacity
                onPress={() => setMode("duo")}
                activeOpacity={0.9}
                style={[
                  styles.modeCta,
                  {
                    borderColor:
                      mode === "duo"
                        ? currentTheme.colors.secondary
                        : currentTheme.colors.border,
                    backgroundColor:
                      mode === "duo"
                        ? "rgba(255,255,255,0.08)"
                        : "transparent",
                  },
                ]}
              >
                <Ionicons
                  name="people-outline"
                  size={18}
                  color={currentTheme.colors.secondary}
                />
                <Text style={[styles.modeCtaText, { color: isDark ? currentTheme.colors.textPrimary : ORANGE }]}>
  {t("firstPick.modeDuo")}
</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setMode("solo")}
                activeOpacity={0.9}
                style={[
                  styles.modeCta,
                  {
                    borderColor:
                      mode === "solo"
                        ? currentTheme.colors.secondary
                        : currentTheme.colors.border,
                    backgroundColor:
                      mode === "solo"
                        ? "rgba(255,255,255,0.08)"
                        : "transparent",
                  },
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={currentTheme.colors.secondary}
                />
                <Text style={[styles.modeCtaText, { color: isDark ? currentTheme.colors.textPrimary : ORANGE }]}>
  {t("firstPick.modeSolo")}
</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Corps: grille + sélecteur de jours */}
          <View style={{ flex: 1, width: "100%", paddingHorizontal: SPACING }}>
            {loading ? (
              <View
                style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
              >
                <ActivityIndicator
                  size="large"
                  color={currentTheme.colors.secondary}
                />
              </View>
            ) : (
              <>
                {/* Grille */}
                <FlatList
                  data={items}
                  keyExtractor={(it) => it.id}
                  numColumns={2}
                  columnWrapperStyle={{
                    justifyContent: "space-between",
                    marginBottom: SPACING,
                  }}
                  contentContainerStyle={{ paddingBottom: SPACING }}
                  renderItem={({ item }) => {
                    const isSel = selected?.id === item.id;
                    return (
                      <TouchableOpacity
                        onPress={() => {
                          setSelected(item);
                          const opts =
                            item.daysOptions && item.daysOptions.length
                              ? item.daysOptions
                              : DEFAULT_DAYS;
                          setDays(opts[0]);
                        }}
                        activeOpacity={0.9}
                        style={[
                          styles.card,
                          {
                            borderColor: isSel
                              ? currentTheme.colors.secondary
                              : currentTheme.colors.border,
                            backgroundColor: currentTheme.colors.cardBackground,
                          },
                        ]}
                      >
                        <Image
                          source={{ uri: item.imageUrl }}
                          style={styles.cardImg}
                          contentFit="cover"
                        />
                        <LinearGradient
                          colors={["rgba(0,0,0,0.0)", "rgba(0,0,0,0.55)"]}
                          style={StyleSheet.absoluteFillObject}
                        />
                        <View style={styles.cardLabelWrap}>
                          <Text
                            numberOfLines={2}
                            style={[styles.cardTitle, { color: "#fff" }]}
                          >
                            {item.title}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={[styles.cardCat, { color: "#ddd" }]}
                          >
                            {item.category}
                          </Text>
                        </View>

                        {isSel && (
                          <View style={styles.checkBadge}>
                            <Ionicons name="checkmark" size={18} color="#000" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />

                {/* Sélecteur de jours */}
                <View style={styles.daysRow}>
                  <Text style={[styles.daysLabel, { color: currentTheme.colors.textSecondary }]}>
  {t("firstPick.durationLabel")}
</Text>

                  <View style={styles.daysPills}>
                    {(
                      selected?.daysOptions && selected.daysOptions.length
                        ? selected.daysOptions
                        : DEFAULT_DAYS
                    ).map((d) => {
                      const active = days === d;
                      return (
                        <TouchableOpacity
                          key={d}
                          onPress={() => setDays(d)}
                          style={[
                            styles.dayPill,
                            {
                              borderColor: active
                                ? currentTheme.colors.secondary
                                : currentTheme.colors.border,
                              backgroundColor: active
                                ? isDark
                                  ? "rgba(255,255,255,0.08)"
                                  : "rgba(0,0,0,0.2)"
                                : isDark
                                  ? "transparent"
                                  : "rgba(0,0,0,0.15)",
                            },
                          ]}
                        >
                          <Ionicons
                            name="calendar-outline"
                            size={14}
                            color={currentTheme.colors.secondary}
                          />
                          <Text
  style={[
    styles.dayPillText,
    { color: isDark ? currentTheme.colors.textPrimary : "#fff" },
  ]}
>
  {t("firstPick.day", { count: d })}
</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </>
            )}
          </View>

          {/* Footer: Valider + Ignorer */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={onConfirm}
              disabled={mode === "none" || !selected || submitting}
              style={{
                flex: 1,
                opacity: mode !== "none" && selected && !submitting ? 1 : 0.5,
              }}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={[currentTheme.colors.secondary, currentTheme.colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryCta}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons
                      name={mode === "duo" ? "people-outline" : "person-outline"}
                      size={18}
                      color="#fff"
                    />
                    <Text style={styles.primaryCtaText}>
  {mode === "duo" ? t("firstPick.chooseDuo") : t("firstPick.chooseSolo")}
</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={onSkip} style={styles.skipBtn} hitSlop={10}>
              <Text style={[styles.skipText, { color: currentTheme.colors.textSecondary }]}>
  {t("firstPick.skip")}
</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>

      <InfoDuoModal
  visible={infoDuoVisible}
  onClose={() => {
    setInfoDuoVisible(false);
    setInviteModalVisible(true); 
  }}
/>

<SendInvitationModal
  visible={inviteModalVisible}
  onClose={handleInviteDismiss}      // 👈 ferme sans bouger (user a cliqué la croix)
  onSent={handleInvitationSent}      // 👈 succès d’envoi => go index + tuto
  challengeId={selected?.id || ""}
  selectedDays={days}
  challengeTitle={selected?.title || t("common.challenge")}
/>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: SPACING,
    paddingBottom: SPACING,
    alignItems: "center",
  },
  header: {
    width: "100%",
    paddingHorizontal: SPACING,
    marginBottom: 8,
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontFamily: "Comfortaa_700Bold",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginTop: 6,
  },
  modeRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
    marginBottom: 6,
  },
  modeCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  modeCtaText: {
    fontSize: 14,
    fontFamily: "Comfortaa_700Bold",
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
    position: "relative",
  },
  cardImg: {
    width: "100%",
    height: "100%",
  },
  cardLabelWrap: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: "Comfortaa_700Bold",
  },
  cardCat: {
    fontSize: 12,
    fontFamily: "Comfortaa_400Regular",
    marginTop: 4,
  },
  checkBadge: {
    position: "absolute",
    right: 8,
    top: 8,
    backgroundColor: "#FFD700",
    borderRadius: 14,
    padding: 6,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  daysRow: {
    width: "100%",
    marginTop: 4,
    marginBottom: 4,
  },
  daysLabel: {
    fontSize: 13,
    fontFamily: "Comfortaa_700Bold",
    marginBottom: 6,
  },
  daysPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dayPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 6,
    marginBottom: 6,
  },
  dayPillText: {
    fontSize: 13,
    fontFamily: "Comfortaa_700Bold",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: SPACING,
    marginTop: 10,
  },
  primaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
  },
  primaryCtaText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Comfortaa_700Bold",
  },
  skipBtn: {
    marginLeft: 12,
    padding: 10,
  },
  skipText: {
    fontSize: 14,
    fontFamily: "Comfortaa_400Regular",
  },
});
