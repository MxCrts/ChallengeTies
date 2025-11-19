import React, { useState, useMemo, useEffect, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  Dimensions,
  StatusBar,
  Share,
  Platform,
  TextInput,
  I18nManager,
} from "react-native";
import Animated, { FadeInUp, Layout } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import { Theme } from "../theme/designSystem";
import designSystem from "../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import BannerSlot from "@/components/BannerSlot";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { useAdsVisibility } from "../src/context/AdsVisibilityContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useShareCard } from "@/hooks/useShareCard";
import { TipShareCard } from "@/components/ShareCards";

const SPACING = 15;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const normalizeFont = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

const normalizeSize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  return Math.round(size * scale);
};

type IconName =
  | "checkmark-circle-outline"
  | "time-outline"
  | "analytics-outline"
  | "people-outline"
  | "gift-outline"
  | "flask-outline"
  | "person-add-outline"
  | "eye-outline"
  | "sunny-outline"
  | "water-outline"
  | "trophy-outline";

interface Conseil {
  id: string;
  title: string;
  description: string;
  icon: IconName;
}

const conseils: Conseil[] = [
  { id: "1", title: "tips.smartGoals.title", description: "tips.smartGoals.description", icon: "checkmark-circle-outline" },
  { id: "2", title: "tips.beConsistent.title", description: "tips.beConsistent.description", icon: "time-outline" },
  { id: "3", title: "tips.trackEverything.title", description: "tips.trackEverything.description", icon: "analytics-outline" },
  { id: "4", title: "tips.findSupport.title", description: "tips.findSupport.description", icon: "people-outline" },
  { id: "5", title: "tips.rewardYourself.title", description: "tips.rewardYourself.description", icon: "gift-outline" },
  { id: "6", title: "tips.switchItUp.title", description: "tips.switchItUp.description", icon: "flask-outline" },
  { id: "7", title: "tips.inviteAFriend.title", description: "tips.inviteAFriend.description", icon: "person-add-outline" },
  { id: "8", title: "tips.visualizeSuccess.title", description: "tips.visualizeSuccess.description", icon: "eye-outline" },
  { id: "9", title: "tips.stayPositive.title", description: "tips.stayPositive.description", icon: "sunny-outline" },
  { id: "10", title: "tips.takeBreaks.title", description: "tips.takeBreaks.description", icon: "time-outline" },
  { id: "11", title: "tips.stayHydrated.title", description: "tips.stayHydrated.description", icon: "water-outline" },
  { id: "12", title: "tips.celebrateWins.title", description: "tips.celebrateWins.description", icon: "trophy-outline" },
];

/** ——— Fond orbes premium ——— */
const OrbBackground = ({ theme }: { theme: Theme }) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    {/* orbe top-left */}
    <LinearGradient
      colors={[theme.colors.secondary + "55", theme.colors.primary + "11"]}
      start={{ x: 0.1, y: 0.1 }}
      end={{ x: 0.9, y: 0.9 }}
      style={[
        styles.orb,
        {
          width: SCREEN_WIDTH * 0.9,
          height: SCREEN_WIDTH * 0.9,
          borderRadius: (SCREEN_WIDTH * 0.9) / 2,
          top: -SCREEN_WIDTH * 0.35,
          left: -SCREEN_WIDTH * 0.25,
        },
      ]}
    />
    {/* orbe bottom-right */}
    <LinearGradient
      colors={[theme.colors.primary + "55", theme.colors.secondary + "11"]}
      start={{ x: 0.2, y: 0.2 }}
      end={{ x: 0.8, y: 0.8 }}
      style={[
        styles.orb,
        {
          width: SCREEN_WIDTH * 1.0,
          height: SCREEN_WIDTH * 1.0,
          borderRadius: (SCREEN_WIDTH * 1.0) / 2,
          bottom: -SCREEN_WIDTH * 0.45,
          right: -SCREEN_WIDTH * 0.25,
        },
      ]}
    />
    {/* voile de fusion */}
    <LinearGradient
      colors={[theme.colors.background + "00", theme.colors.background + "66"]}
      style={StyleSheet.absoluteFill}
    />
  </View>
);

export default function Conseils() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme: Theme = isDarkMode ? designSystem.darkTheme : designSystem.lightTheme;
  const { showBanners } = useAdsVisibility();
  const insets = useSafeAreaInsets();
  const tabBarHeight = (useContext(BottomTabBarHeightContext) ?? 0) as number;
  const [adHeight, setAdHeight] = useState<number>(0);
  const showAds = !!showBanners;
  const safeInsetsBottom = Number(insets?.bottom ?? 0);
  const { ref: shareRef, share } = useShareCard();
  const [sharePayload, setSharePayload] = useState<{ title: string; tip: string } | null>(null);

  const [expandedTip, setExpandedTip] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  const bottomPadding: number =
    Number(normalizeSize(90)) +
    (showAds ? Number(adHeight) : 0) +
    Number(tabBarHeight) +
    safeInsetsBottom;

  const toggleTip = (id: string) =>
    setExpandedTip((prev) => (prev === id ? null : id));

  const toggleFav = (id: string) =>
    setFavorites((p) => ({ ...p, [id]: !p[id] }));

  // —— Persistance favoris (UX premium)
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("tips_favorites_v1");
        if (raw) setFavorites(JSON.parse(raw));
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(
          "tips_favorites_v1",
          JSON.stringify(favorites)
        );
      } catch {}
    })();
  }, [favorites]);

  const filteredTips = useMemo(() => {
    const q = query.toLocaleLowerCase(i18n.language);
    return conseils.filter((c) => {
      const title = t(c.title).toLocaleLowerCase(i18n.language);
      const desc = t(c.description).toLocaleLowerCase(i18n.language);
      return title.includes(q) || desc.includes(q);
    });
  }, [query, t, i18n.language]);

  const handleContact = async () => {
    try {
      await Linking.openURL("mailto:support@challengeties.app");
    } catch (error) {
      console.error(t("tips.mailOpenError"), error);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: t("tips.shareMessage", {
          defaultValue: "Découvre ces conseils ChallengeTies !",
        }),
        url: "https://challengeme.com/tips",
        title: t("tips.title", { defaultValue: "Conseils" }),
      });
    } catch (error) {
      console.error(t("tips.shareError"), error);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* fond dégradé + orbes en arrière-plan */}
      <LinearGradient
        colors={[
          currentTheme.colors.background,
          currentTheme.colors.cardBackground,
        ]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        pointerEvents="none"
      />
      <OrbBackground theme={currentTheme} />

      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle={isDarkMode ? "light-content" : "dark-content"}
        />
        <CustomHeader title={t("tips.title")} showHairline={false} />

        {/* Barre de recherche */}
        <View style={{ paddingHorizontal: SPACING, marginTop: SPACING }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              borderRadius: 14,
              borderWidth: 1,
              paddingHorizontal: SPACING,
              paddingVertical: SPACING * 0.8,
              borderColor: currentTheme.colors.border,
              backgroundColor: currentTheme.colors.cardBackground,
            }}
          >
            <Ionicons
              name="search-outline"
              size={18}
              color={currentTheme.colors.textSecondary}
              style={{ marginRight: 8 }}
            />
            <TextInput
              placeholder={t("tips.searchPlaceholder")}
              placeholderTextColor={currentTheme.colors.textSecondary}
              value={query}
              onChangeText={setQuery}
              accessibilityLabel={t("tips.searchPlaceholder")}
              importantForAccessibility="yes"
              selectionColor={currentTheme.colors.primary}
              cursorColor={currentTheme.colors.primary}
              style={{
                flex: 1,
                color: isDarkMode
                  ? currentTheme.colors.textPrimary
                  : "#111111",
                fontFamily: "Comfortaa_400Regular",
                // RTL-friendly
                textAlign: I18nManager.isRTL ? "right" : "left",
                writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
              }}
              returnKeyType="search"
            />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomPadding },
          ]}
          showsVerticalScrollIndicator={false}
          contentInset={{ top: SPACING, bottom: 0 }}
          accessibilityRole="list"
          accessibilityLabel={t("tips.listAccessibility")}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
        >
          {/* Header logo + sous-titre */}
          <Animated.View
            entering={FadeInUp.delay(100)}
            style={styles.headerContainer}
          >
            <Image
              source={require("../assets/images/icon.png")}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel={t("tips.logoAlt")}
            />
            <Text
              style={[
                styles.subHeaderText,
                {
                  color: isDarkMode
                    ? "#FFF"
                    : currentTheme.colors.textSecondary,
                },
                {
                  writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
                  textAlign: I18nManager.isRTL ? "right" : "left",
                },
              ]}
              accessibilityRole="header"
              numberOfLines={3}
              adjustsFontSizeToFit
            >
              {t("tips.subHeader")}
            </Text>
          </Animated.View>

          {/* Liste des tips */}
          <View style={styles.tipsContainer} role="list">
            {filteredTips.map((conseil, index) => (
              <React.Fragment key={conseil.id}>
                <Animated.View
                  entering={FadeInUp.delay(200 + index * 50)}
                  layout={Layout.springify()}
                  style={{ marginBottom: SPACING }}
                >
                  <TouchableOpacity
                    style={[
                      styles.tipCard,
                      {
                        backgroundColor: currentTheme.colors.cardBackground,
                        borderColor: currentTheme.colors.border,
                      },
                      expandedTip === conseil.id && styles.tipCardExpanded,
                    ]}
                    onPress={async () => {
                      try {
                        await Haptics.impactAsync(
                          Haptics.ImpactFeedbackStyle.Light
                        );
                      } catch {}
                      toggleTip(conseil.id);
                    }}
                    accessibilityLabel={t("tips.toggleTip", {
                      title: t(conseil.title),
                    })}
                    accessibilityHint={
                      expandedTip === conseil.id
                        ? t("tips.showLessHint")
                        : t("tips.readMoreHint")
                    }
                    accessibilityRole="button"
                    accessibilityState={{ expanded: expandedTip === conseil.id }}
                    testID={`tip-card-${conseil.id}`}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={conseil.icon}
                      size={normalizeSize(32)}
                      color={currentTheme.colors.secondary}
                      style={styles.tipIcon}
                    />
                    <View style={styles.tipContent}>
                      <Text
                        style={[
                          styles.tipTitle,
                          { color: currentTheme.colors.secondary },
                          {
                            writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
                            textAlign: I18nManager.isRTL ? "right" : "left",
                          },
                        ]}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                      >
                        {t(conseil.title)}
                      </Text>
                      <Text
                        style={[
                          styles.tipDescription,
                          { color: currentTheme.colors.textSecondary },
                          {
                            writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
                            textAlign: I18nManager.isRTL ? "right" : "left",
                          },
                        ]}
                        numberOfLines={expandedTip === conseil.id ? 0 : 2}
                        ellipsizeMode="tail"
                      >
                        {t(conseil.description)}
                      </Text>

                      <TouchableOpacity
                        style={styles.readMoreButton}
                        onPress={() => toggleTip(conseil.id)}
                        accessibilityLabel={
                          expandedTip === conseil.id
                            ? t("tips.showLess", {
                                title: t(conseil.title),
                              })
                            : t("tips.readMore", {
                                title: t(conseil.title),
                              })
                        }
                        testID={`read-more-${conseil.id}`}
                        activeOpacity={0.8}
                        accessibilityHint={
                          expandedTip === conseil.id
                            ? t("tips.showLessHint")
                            : t("tips.readMoreHint")
                        }
                      >
                        <Text
                          style={[
                            styles.readMoreText,
                            { color: currentTheme.colors.primary },
                            {
                              writingDirection: I18nManager.isRTL
                                ? "rtl"
                                : "ltr",
                            },
                          ]}
                        >
                          {expandedTip === conseil.id
                            ? t("tips.showLess")
                            : t("tips.readMore")}
                        </Text>
                      </TouchableOpacity>

                      {/* Actions: fav + share + copy */}
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginTop: SPACING * 0.8,
                        }}
                      >
                        {/* Favori */}
                        <TouchableOpacity
                          onPress={async () => {
                            try {
                              await Haptics.impactAsync(
                                Haptics.ImpactFeedbackStyle.Light
                              );
                            } catch {}
                            toggleFav(conseil.id);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={t("tips.favoriteA11y", {
                            title: t(conseil.title),
                          })}
                          style={{ marginRight: 14 }}
                        >
                          <Ionicons
                            name={
                              favorites[conseil.id] ? "heart" : "heart-outline"
                            }
                            size={20}
                            color={
                              favorites[conseil.id]
                                ? currentTheme.colors.secondary
                                : currentTheme.colors.textSecondary
                            }
                          />
                        </TouchableOpacity>

                        {/* Share card */}
                        <TouchableOpacity
                          onPress={async () => {
                            try {
                              await Haptics.selectionAsync();
                            } catch {}
                            setSharePayload({
                              title: t(conseil.title),
                              tip: t(conseil.description),
                            });

                            // ensure React commit
                            await new Promise<void>((resolve) =>
                              requestAnimationFrame(() => resolve())
                            );
                            await share(
                              `ct-tip-${conseil.id}-${Date.now()}.png`,
                              t("tips.shareDialogTitle")
                            );

                            setSharePayload(null);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={t("tips.shareOneTipA11y", {
                            title: t(conseil.title),
                          })}
                          style={{ marginRight: 14 }}
                        >
                          <Ionicons
                            name="paper-plane-outline"
                            size={20}
                            color={currentTheme.colors.textSecondary}
                          />
                        </TouchableOpacity>

                        {/* Copier */}
                        <TouchableOpacity
                          onPress={async () => {
                            try {
                              await Haptics.selectionAsync();
                            } catch {}
                            try {
                              await Clipboard.setStringAsync(
                                `${t(conseil.title)} — ${t(
                                  conseil.description
                                )}`
                              );
                            } catch {}
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={t("tips.copyTipA11y", {
                            title: t(conseil.title),
                          })}
                        >
                          <Ionicons
                            name="copy-outline"
                            size={20}
                            color={currentTheme.colors.textSecondary}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                </Animated.View>

                {/* —— Inline Ad après la 3e carte —— */}
                {showBanners && filteredTips.length >= 4 && index === 2 && (
                  <Animated.View
                    entering={FadeInUp.delay(220 + index * 50)}
                    layout={Layout.springify()}
                    style={{ marginBottom: SPACING }}
                  >
                    <View
                      style={{
                        borderRadius: 14,
                        overflow: "hidden",
                        borderWidth: 1,
                        borderColor: currentTheme.colors.border,
                        backgroundColor: currentTheme.colors.cardBackground,
                        paddingVertical: 6,
                      }}
                    >
                      <BannerSlot onHeight={() => {}} />
                    </View>
                  </Animated.View>
                )}
              </React.Fragment>
            ))}
          </View>

          {/* —— Empty state si aucune correspondance —— */}
          {filteredTips.length === 0 && (
            <Animated.View
              entering={FadeInUp.delay(250)}
              style={{
                alignItems: "center",
                paddingVertical: SPACING * 2,
              }}
            >
              <Ionicons
                name="search-outline"
                size={28}
                color={currentTheme.colors.textSecondary}
              />
              <Text
                style={{
                  marginTop: 8,
                  color: currentTheme.colors.textSecondary,
                  fontFamily: "Comfortaa_400Regular",
                  fontSize: normalizeFont(14),
                  textAlign: "center",
                }}
                numberOfLines={3}
                adjustsFontSizeToFit
                accessibilityLiveRegion="polite"
              >
                {t("tips.noResults", {
                  defaultValue:
                    "Aucun conseil ne correspond à ta recherche.",
                })}
              </Text>
            </Animated.View>
          )}

          {/* Footer contact + share global */}
          <Animated.View
            entering={FadeInUp.delay(600)}
            style={styles.footer}
          >
            <Text
              style={[
                styles.footerText,
                { color: currentTheme.colors.textSecondary },
              ]}
              numberOfLines={3}
              adjustsFontSizeToFit
            >
              {t("tips.footerQuery")}{" "}
              <Text
                style={[
                  styles.footerLink,
                  { color: currentTheme.colors.secondary },
                ]}
                onPress={handleContact}
                accessibilityRole="link"
                testID="contact-link"
              >
                {t("tips.contactUs")}
              </Text>
            </Text>

            <TouchableOpacity
              style={[
                styles.shareButton,
                { backgroundColor: currentTheme.colors.primary },
              ]}
              onPress={handleShare}
              accessibilityRole="button"
              testID="share-button"
              activeOpacity={0.9}
            >
              <Ionicons
                name="share-social-outline"
                size={normalizeSize(20)}
                color={currentTheme.colors.textPrimary}
              />
              <Text
                style={[
                  styles.shareButtonText,
                  { color: currentTheme.colors.textPrimary },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {" "}
                {t("tips.shareTips")}{" "}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>

        {/* —— Hairline premium au-dessus de la bannière dockée —— */}
        {showBanners && adHeight > 0 && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: tabBarHeight + insets.bottom + adHeight + 6,
              height: StyleSheet.hairlineWidth,
              backgroundColor: isDarkMode
                ? "rgba(255,255,255,0.12)"
                : "rgba(0,0,0,0.08)",
              zIndex: 9999,
            }}
          />
        )}

        {/* —— Bannière dockée bas (monétisation stable) —— */}
        {showBanners && (
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: tabBarHeight + insets.bottom,
              alignItems: "center",
              backgroundColor: "transparent",
              paddingBottom: 6,
              zIndex: 9999,
            }}
            pointerEvents="box-none"
          >
            <BannerSlot onHeight={(h) => setAdHeight(h)} />
          </View>
        )}
      </SafeAreaView>

      {/* ——— Carte de partage invisible, capturable ——— */}
      {sharePayload && (
        <View
          style={{
            position: "absolute",
            opacity: 0,
            pointerEvents: "none",
          }}
        >
          <TipShareCard
            ref={shareRef}
            title={sharePayload.title}
            tip={sharePayload.tip}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop:
      Platform.OS === "android"
        ? StatusBar.currentHeight ?? SPACING
        : SPACING,
  },

  scrollContent: {
    paddingHorizontal: SPACING,
    paddingBottom: normalizeSize(80),
  },

  headerContainer: {
    alignItems: "center",
    marginBottom: SPACING * 2,
    marginTop: SPACING,
  },
  logo: {
    width: Math.min(SCREEN_WIDTH * 0.5, normalizeSize(120)),
    height: Math.min(SCREEN_WIDTH * 0.5, normalizeSize(120)),
    marginBottom: SPACING * 1.5,
    minHeight: normalizeSize(80),
    resizeMode: "contain",
  },

  subHeaderText: {
    fontSize: normalizeFont(18),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginHorizontal: SPACING * 1.5,
    lineHeight: normalizeFont(24),
  },

  tipsContainer: { marginVertical: SPACING * 1.5 },

  // ——— Card with very subtle shadow (premium) ———
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: normalizeSize(18),
    padding: SPACING * 1.2,
    borderWidth: 1.5,
    marginBottom: SPACING,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
      default: {},
    }),
  },
  tipCardExpanded: { opacity: 0.98 },

  tipIcon: { marginRight: SPACING, marginTop: normalizeSize(4) },
  tipContent: { flex: 1 },

  tipTitle: {
    fontSize: normalizeFont(20),
    fontFamily: "Comfortaa_700Bold",
    marginBottom: normalizeSize(8),
  },
  tipDescription: {
    fontSize: normalizeFont(15),
    fontFamily: "Comfortaa_400Regular",
    lineHeight: normalizeFont(22),
  },
  readMoreButton: { marginTop: SPACING / 1.5, alignSelf: "flex-start" },
  readMoreText: {
    fontSize: normalizeFont(13),
    fontFamily: "Comfortaa_400Regular",
    textDecorationLine: "underline",
  },

  footer: {
    marginTop: SPACING * 6,
    alignItems: "center",
    paddingBottom: SPACING * 6,
  },
  footerText: {
    fontSize: normalizeFont(15),
    fontFamily: "Comfortaa_400Regular",
    textAlign: "center",
    marginBottom: SPACING * 1.5,
  },
  footerLink: {
    fontFamily: "Comfortaa_700Bold",
    textDecorationLine: "underline",
  },

  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING / 1.2,
    paddingHorizontal: SPACING * 2,
    borderRadius: normalizeSize(30),
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  shareButtonText: {
    fontSize: normalizeFont(15),
    fontFamily: "Comfortaa_700Bold",
    marginLeft: SPACING / 1.5,
  },

  // orbes
  orb: {
    position: "absolute",
    opacity: 0.9,
  },
});
