// app/profile/Inventory.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  I18nManager,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { doc, onSnapshot } from "firebase/firestore";

import { auth, db } from "@/constants/firebase-config";
import GlobalLayout from "../../components/GlobalLayout";
import CustomHeader from "@/components/CustomHeader";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../context/ThemeContext";
import designSystem, { Theme as TTheme } from "../../theme/designSystem";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useAdsVisibility } from "../../src/context/AdsVisibilityContext";
import BannerSlot from "@/components/BannerSlot";

const withAlpha = (hexOrColor: string, alpha: number) => {
  const clamp = (n: number, min = 0, max = 1) => Math.min(Math.max(n, min), max);
  const a = clamp(alpha);

  if (/^rgba?\(/i.test(hexOrColor)) {
    const nums = hexOrColor.match(/[\d.]+/g) || [];
    const [r = "0", g = "0", b = "0"] = nums;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  let hex = hexOrColor.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (hex.length >= 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return `rgba(0,0,0,${a})`;
};


type UserInventory = {
  streakPass?: number;
  // futurs items: superBoost, rerollToken, etc.
  [key: string]: any;
};

interface UserData {
  inventory?: UserInventory;
  trophies?: number;
  username?: string;
}

const InventoryScreen: React.FC = () => {
  const { width: screenW } = useWindowDimensions();

  const normalize = useMemo(() => {
    const baseWidth = 375;
    // clamp: évite les UI trop petites / trop énormes sur tablette
    const scale = Math.min(Math.max(screenW / baseWidth, 0.85), 1.35);
    return (size: number) => Math.round(size * scale);
  }, [screenW]);
  const { theme } = useTheme();
  const { t } = useTranslation();
  const isDark = theme === "dark";
  const currentTheme: TTheme = isDark
    ? designSystem.darkTheme
    : designSystem.lightTheme;

 const titleColor = isDark ? currentTheme.colors.textPrimary : "#0B0B10";
  const subtitleColor = isDark
    ? currentTheme.colors.textSecondary
    : "rgba(11,11,16,0.72)";
  const labelColor = isDark
    ? currentTheme.colors.textSecondary
    : "rgba(11,11,16,0.70)";

  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

   const insets = useSafeAreaInsets();

  // 🔒 Safe tabBarHeight: évite l'erreur "Couldn't find the bottom tab bar height"
  let tabBarHeight = 0;
  try {
    tabBarHeight = useBottomTabBarHeight();
  } catch (_e) {
    tabBarHeight = 0; // fallback si l'écran n'est pas rendu dans un BottomTabNavigator
  }

  const { showBanners } = useAdsVisibility();
  const [adHeight, setAdHeight] = useState(0);

  // Layout guard pour tablettes / desktop web
  const contentMaxWidth = useMemo(() => {
    // 560–720 selon device : garde le “Apple Keynote look” au centre
    return Math.min(720, Math.max(560, Math.round(screenW * 0.92)));
  }, [screenW]);

  const bottomPadding =
    (showBanners ? adHeight : 0) +
    tabBarHeight +
    insets.bottom +
    normalize(40);

const badgeTextColor = isDark ? "rgba(255,255,255,0.92)" : "#0B0B10";
  const badgeShadow = isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)";
  const statNumberColor = isDark ? "rgba(255,255,255,0.95)" : "#0B0B10";
  const statNumberShadow = isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.65)";
  const chipNumColor = isDark ? "rgba(255,255,255,0.92)" : "#0B0B10";
  const chipNumShadow = isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)";
  // 🔥 Récupération live de l’inventaire utilisateur
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setError(t("noUserConnected"));
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserData;
          setUserData(data ?? {});
          setError(null);
        } else {
          setError(t("profileNotFound"));
        }
        setLoading(false);
      },
      (err) => {
        console.error("[Inventory] onSnapshot error:", err);
        setError(t("profileLoadError"));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [t]);

  // 🧮 Normalisation de l’inventaire
  const inventory: UserInventory = useMemo(() => {
    if (!userData?.inventory || typeof userData.inventory !== "object") {
      return {};
    }
    return userData.inventory;
  }, [userData]);

  // Nombre total d’objets (tous items numériques)
  const totalItems = useMemo(() => {
    return Object.values(inventory).reduce((sum, val) => {
      if (typeof val === "number" && isFinite(val)) {
        return sum + val;
      }
      return sum;
    }, 0);
  }, [inventory]);

  const streakPassCount =
    typeof inventory.streakPass === "number" ? inventory.streakPass : 0;

  const hasItems = totalItems > 0;

  if (loading) {
    return (
      <GlobalLayout>
        <LinearGradient
          colors={[
            currentTheme.colors.background,
            currentTheme.colors.cardBackground,
          ]}
          style={styles.loadingContainer}
        >
          <StatusBar
            translucent
            backgroundColor="transparent"
            barStyle={isDark ? "light-content" : "dark-content"}
          />
          <ActivityIndicator
            size="large"
            color={currentTheme.colors.primary}
          />
          <Text
            style={[
              styles.loadingText,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
           {t("common.loading", { defaultValue: "Loading..." })}
          </Text>
        </LinearGradient>
      </GlobalLayout>
    );
  }

  if (error) {
    return (
      <GlobalLayout>
        <LinearGradient
          colors={[
            currentTheme.colors.background,
            currentTheme.colors.cardBackground,
          ]}
          style={styles.loadingContainer}
        >
          <StatusBar
            translucent
            backgroundColor="transparent"
            barStyle={isDark ? "light-content" : "dark-content"}
          />
          <View style={styles.errorBox}>
            <Ionicons
              name="alert-circle-outline"
              size={normalize(32)}
              color={currentTheme.colors.textSecondary}
            />
            <Text
              style={[
                styles.errorText,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {error}
            </Text>
          </View>
        </LinearGradient>
      </GlobalLayout>
    );
  }

  return (
    <GlobalLayout>
      <LinearGradient
        colors={[
          currentTheme.colors.background,
          currentTheme.colors.cardBackground,
          currentTheme.colors.primary + "22",
        ]}
        style={styles.gradientContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Orbes décoratives pour le côté premium */}
        <LinearGradient
          pointerEvents="none"
          colors={[currentTheme.colors.primary + "33", "transparent"]}
          style={[
            styles.bgOrbBase,
            {
              top: -screenW * 0.25,
              left: -screenW * 0.2,
              width: screenW * 0.9,
              height: screenW * 0.9,
              borderRadius: (screenW * 0.9) / 2,
            },
          ]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <LinearGradient
          pointerEvents="none"
          colors={[currentTheme.colors.secondary + "33", "transparent"]}
          style={[
            styles.bgOrbBase,
            {
              bottom: -screenW * 0.3,
              right: -screenW * 0.25,
              width: screenW * 1.1,
              height: screenW * 1.1,
              borderRadius: (screenW * 1.1) / 2,
            },
          ]}

          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
        />

        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle={isDark ? "light-content" : "dark-content"}
        />

        <CustomHeader
          title={t("inventory.title", { defaultValue: "Inventory" })}
          backgroundColor="transparent"
          useBlur={false}
          showHairline={false}
        />

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomPadding },
          ]}
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: "100%", maxWidth: contentMaxWidth, alignSelf: "center" }}>
          {/* Hero / résumé */}
          <View
  style={[
    styles.heroCard,
    {
      backgroundColor: isDark
        ? withAlpha(currentTheme.colors.cardBackground, 0.72)
        : withAlpha("#FFFFFF", 0.96),
      borderColor: isDark ? withAlpha("#FFFFFF", 0.12) : withAlpha("#000000", 0.07),
    },
  ]}
>
  {/* sheen premium */}
  <LinearGradient
    pointerEvents="none"
    colors={[
      "transparent",
      isDark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.70)",
      "transparent",
    ]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={styles.heroSheen}
  />
  {/* glow orb */}
  <View
    pointerEvents="none"
    style={[
      styles.heroGlow,
      { backgroundColor: withAlpha(currentTheme.colors.secondary, isDark ? 0.14 : 0.10) },
    ]}
  />

  <View style={styles.heroHeaderRow}>
    <View style={styles.heroTitleRow}>
      <View
        style={[
          styles.heroIconPill,
          {
            backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
            borderColor: isDark ? withAlpha("#FFFFFF", 0.14) : withAlpha("#000000", 0.08),
          },
        ]}
      >
        <Ionicons name="briefcase-outline" size={normalize(18)} color={currentTheme.colors.secondary} />
      </View>

       <Text style={[styles.heroTitle, { color: titleColor }]}>
       {t("inventory.title", { defaultValue: "Inventory" })}
      </Text>
    </View>

    {hasItems && (
      <View
        style={[
          styles.heroBadge,
          {
            backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
            borderColor: isDark ? withAlpha("#FFFFFF", 0.12) : withAlpha("#000000", 0.08),
          },
        ]}
      >
        <Ionicons name="sparkles" size={normalize(14)} color={currentTheme.colors.secondary} />
        <Text
  style={[
    styles.heroBadgeText,
    {
      color: badgeTextColor,
      textShadowColor: badgeShadow,
      textShadowRadius: 6,
      textShadowOffset: { width: 0, height: 1 },
    },
  ]}
  numberOfLines={1}
  allowFontScaling
>
  {t("inventory.totalItems", { count: totalItems, defaultValue: "{{count}} items" })}
</Text>
      </View>
    )}
  </View>

  <Text style={[styles.heroSubtitle, { color: subtitleColor }]}>
    {t("inventory.subtitle", { defaultValue: "Your special bonuses & streak protections, in one place." })}
  </Text>

  <View style={styles.heroStatsRow}>
    {/* Streak Pass */}
    <View
      style={[
        styles.heroStatCard,
        {
          backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
          borderColor: isDark ? withAlpha("#FFFFFF", 0.12) : withAlpha("#000000", 0.07),
        },
      ]}
    >
      <Text style={[styles.statLabel, { color: labelColor }]}>
        {t("inventory.items.streakPass.title", { defaultValue: "Streak Pass" })}
      </Text>

      <View style={styles.statValueRow}>
        <View style={[styles.statIconBadge, { backgroundColor: withAlpha("#FFD54F", isDark ? 0.16 : 0.22) }]}>
          <Ionicons name="shield-checkmark" size={normalize(16)} color="#FFD54F" />
        </View>
       <Text
  style={[
    styles.statValueText,
    {
      color: statNumberColor,
      textShadowColor: statNumberShadow,
      textShadowRadius: 7,
      textShadowOffset: { width: 0, height: 1 },
    },
  ]}
  numberOfLines={1}
  allowFontScaling
>
  ×{streakPassCount}
</Text>
      </View>
    </View>

    {/* Trophies */}
    <View
      style={[
        styles.heroStatCard,
        {
          backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
          borderColor: isDark ? withAlpha("#FFFFFF", 0.12) : withAlpha("#000000", 0.07),
        },
      ]}
    >
      <Text style={[styles.statLabel, { color: labelColor }]}>
       {t("trophiesLabel", { defaultValue: "Trophées" })}
      </Text>

      <View style={styles.statValueRow}>
        <View style={[styles.statIconBadge, { backgroundColor: withAlpha(currentTheme.colors.trophy, isDark ? 0.16 : 0.18) }]}>
          <Ionicons name="trophy" size={normalize(16)} color={currentTheme.colors.trophy} />
        </View>
        <Text
  style={[
    styles.statValueText,
    {
      color: statNumberColor,
      textShadowColor: statNumberShadow,
      textShadowRadius: 7,
      textShadowOffset: { width: 0, height: 1 },
    },
  ]}
  numberOfLines={1}
  allowFontScaling
>
  {userData?.trophies ?? 0}
</Text>
      </View>
    </View>
  </View>
</View>


          {/* Liste détaillée des items */}
          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                { color: titleColor },
              ]}
            >
             {t("inventory.title", { defaultValue: "Inventory" })}
            </Text>
            <Text style={[styles.sectionSubtitle, { color: subtitleColor }]}>
              {t("inventory.sectionSubtitle", {
                defaultValue: "See what you own and how to use it when you need it.",
              })}
            </Text>

            {hasItems ? (
              <View style={styles.itemsList}>
                {/* Streak Pass */}
                {streakPassCount > 0 && (
                  <View
                    style={[
                      styles.itemCard,
                      {
                        backgroundColor: isDark
                          ? "rgba(255,255,255,0.02)"
                          : "rgba(0,0,0,0.02)",
                        borderColor: isDark
                          ? "rgba(255,255,255,0.12)"
                          : "rgba(0,0,0,0.06)",
                      },
                    ]}
                  >
                    <LinearGradient
  pointerEvents="none"
  colors={[
    "transparent",
    isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.65)",
    "transparent",
  ]}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
  style={styles.itemSheen}
/>

                    <View
                      style={[
                        styles.itemIconCircle,
                        { backgroundColor: "#FFD54F" },
                      ]}
                    >
                      <Ionicons
                        name="shield-checkmark"
                        size={normalize(20)}
                        color="#1A1A1A"
                      />
                    </View>

                   <View style={styles.itemTextZone}>
                      <View style={styles.itemTitleRow}>
                        <Text style={[styles.itemTitle, { color: titleColor }]}>
                          {t("inventory.items.streakPass.title", { defaultValue: "Streak Pass" })}
                        </Text>

                        <View
                          style={[
                            styles.itemCountBadge,
                            {
                              backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                              borderColor: isDark ? withAlpha("#FFFFFF", 0.12) : withAlpha("#000000", 0.08),
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.itemCountText,
                              {
                                color: chipNumColor,
                                textShadowColor: chipNumShadow,
                                textShadowRadius: 6,
                                textShadowOffset: { width: 0, height: 1 },
                              },
                            ]}
                            numberOfLines={1}
                            allowFontScaling
                          >
                            ×{streakPassCount}
                          </Text>
                        </View>
                      </View>

                      <Text
                        style={[styles.itemSubtitle, { color: subtitleColor }]}
                        // ✅ “mode nucléaire” anti-troncage Android
                        // (évite les cas où la mesure de ligne part en vrille avec certaines polices)
                        ellipsizeMode="clip"
                        textBreakStrategy="highQuality"
                      >
                        {t("inventory.items.streakPass.subtitle", {
                          defaultValue: "Protects your streak once if you miss a day.",
                        })}
                      </Text>

                      <View
                        style={[
                          styles.explainBox,
                          {
                            backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.025)",
                            borderColor: isDark ? withAlpha("#FFFFFF", 0.10) : withAlpha("#000000", 0.06),
                          },
                        ]}
                      >
                        <Ionicons
                          name="information-circle-outline"
                          size={normalize(16)}
                          color={currentTheme.colors.secondary}
                          style={{ marginTop: normalize(1) }}
                        />
                        <Text style={[styles.explainText, { color: subtitleColor }]}>
                          {t("inventory.items.streakPass.howToUse", {
                            defaultValue:
                              "If you miss a day, you can choose to use a Streak Pass on the “Missed challenge” screen to keep your streak.",
                          })}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* ⚠️ Futurs items
                    Quand tu rajouteras un nouveau bonus dans inventory
                    (ex: superBoost, rerollToken), tu pourras l'afficher ici.
                */}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons
                  name="cloud-outline"
                  size={normalize(32)}
                  color={currentTheme.colors.textSecondary}
                />
                <Text
                  style={[
                    styles.emptyTitle,
                   { color: titleColor },
                  ]}
                >
                  {t("inventory.emptyTitle", { defaultValue: "No bonuses yet" })}
                </Text>
                <Text
                  style={[
                    styles.emptyText,
                    { color: subtitleColor },
                  ]}
                >
                  {t("inventory.emptyText", {
                    defaultValue: "Complete challenges and spin the daily wheel to earn items.",
                  })}
                </Text>
              </View>
            )}
          </View>
          </View>
        </ScrollView>

        {/* Bannière pub dockée */}
        {showBanners && (
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: tabBarHeight + insets.bottom,
              alignItems: "center",
              zIndex: 9999,
              backgroundColor: "transparent",
              paddingBottom: 6,
            }}
            pointerEvents="box-none"
          >
            <BannerSlot onHeight={(h) => setAdHeight(h)} />
          </View>
        )}
      </LinearGradient>
    </GlobalLayout>
  );
};

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  bgOrbBase: {
     position: "absolute",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
   writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },
  errorBox: {
    alignItems: "center",
     paddingHorizontal: 24,
  },
  errorText: {
   marginTop: 8,
    fontSize: 14,
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },
  heroCard: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    borderWidth: 1,
  },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  heroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
  },
  heroTitle: {
    fontSize: 18,
    fontFamily: "Comfortaa_700Bold",
     writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
  heroSubtitle: {
    fontSize: 12,
    fontFamily: "Comfortaa_400Regular",
    marginBottom:10,
     writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
  heroBadge: {
  flexDirection: "row",
  alignItems: "center",
  borderRadius: 999,
 paddingHorizontal: 10,
  paddingVertical: 4,
  columnGap: 6,
  borderWidth: StyleSheet.hairlineWidth,
},
explainBox: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 8,
  },
  explainText: {
    flex: 1,
     fontSize: 11,
    fontFamily: "Comfortaa_400Regular",
    lineHeight: 15,
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
    textAlign: I18nManager.isRTL ? "right" : "left",
  },
  heroBadgeText: {
    fontSize: 11,
    fontFamily: "Comfortaa_400Regular",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: "center",
   includeFontPadding: false,
textAlignVertical: "center",
  },
  heroStatsRow: {
    flexDirection: "row",
   columnGap: 10,
  },
  heroStatCard: {
  flex: 1,
 borderRadius: 16,
  paddingHorizontal: 12,
  paddingVertical: 10,
  borderWidth: StyleSheet.hairlineWidth,
  overflow: "hidden",
},
  statLabel: {
    fontSize: 11,
    fontFamily: "Comfortaa_400Regular",
    opacity: 0.85,
   marginBottom: 2,
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
  },
  statValueText: {
  fontSize: 16,
  fontFamily: "Comfortaa_700Bold",
  writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  textAlign: "left",
  includeFontPadding: false,
textAlignVertical: "center",
},
heroSheen: {
  position: "absolute",
  top: -30,
  left: -70,
  width: "175%",
  height: 96,
  transform: [{ rotate: "-12deg" }],
  opacity: 0.85,
},
heroGlow: {
  position: "absolute",
  top: -18,
  right: -18,
  width: 120,
  height: 120,
  borderRadius: 999,
},
heroIconPill: {
 width: 34,
  height: 34,
  borderRadius: 999,
  alignItems: "center",
  justifyContent: "center",
  borderWidth: StyleSheet.hairlineWidth,
},
statIconBadge: {
  width: 28,
  height: 28,
  borderRadius: 999,
  alignItems: "center",
  justifyContent: "center",
},
itemSheen: {
  position: "absolute",
  top: -26,
  left: -70,
  width: "175%",
  height: 84,
  transform: [{ rotate: "-12deg" }],
  opacity: 0.75,
},
  section: {
    marginTop: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Comfortaa_700Bold",
    marginBottom: 4,
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
  sectionSubtitle: {
    fontSize: 12,
    fontFamily: "Comfortaa_400Regular",
    opacity: 0.9,
    marginBottom: 8,
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
  itemsList: {
    marginTop: 2,
  },
  itemCard: {
  flexDirection: "row",
  alignItems: "flex-start",
  paddingHorizontal: 12,
  paddingVertical: 10,
  borderRadius: 16,
  borderWidth: 1,
  marginBottom: 8,
  overflow: "hidden",
},
  itemIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  itemTextZone: {
    flex: 1,
    minWidth: 0,
  },
  itemTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
    columnGap: 8,
  },
  itemTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontFamily: "Comfortaa_700Bold",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
  itemCountBadge: {
  borderRadius: 999,
  paddingHorizontal: 8,
  flexShrink: 0,
  paddingVertical: 3,
  borderWidth: StyleSheet.hairlineWidth,
},
 itemCountText: {
  fontSize: 11,
  fontFamily: "Comfortaa_700Bold",
  writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  textAlign: "center",
  includeFontPadding: false,
textAlignVertical: "center",
},
  itemSubtitle: {
    fontSize: 11,
    minWidth: 0,
   width: "100%",
    fontFamily: "Comfortaa_400Regular",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
   lineHeight: 15,
   marginTop: 2,
   flexShrink: 1,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 18,
  },
  emptyTitle: {
    fontSize: 14,
    fontFamily: "Comfortaa_700Bold",
    marginTop: 6,
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: "center",
  },
  emptyText: {
    fontSize: 12,
    fontFamily: "Comfortaa_400Regular",
    marginTop: 4,
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: "center",
  },
});

export default InventoryScreen;
