// app/(tabs)/settingspremium.tsx

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar,
  ScrollView,
  InteractionManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import designSystem from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import { auth, db } from "@/constants/firebase-config";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useAdsVisibility } from "../../src/context/AdsVisibilityContext";
import { useRouter } from "expo-router";
import { useIAP } from "expo-iap";
import { useToast } from "@/src/ui/Toast";
import { tap, success, warning } from "@/src/utils/haptics";

const PRODUCT_ID = "challengeties_premium_monthly";
const SPACING = 20;

export default function SettingsPremium() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const current = isDark ? designSystem.darkTheme : designSystem.lightTheme;
  const { showBanners, showInterstitials, isAdmin } = useAdsVisibility();
  const router = useRouter();
  const { show: showToast } = useToast();

  const uid = auth.currentUser?.uid;
  const isLoggedIn = !!uid;

  const [initializing, setInitializing] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [userPremium, setUserPremium] = useState<boolean>(false);

  // ---- IAP hook ----
  const {
    connected,
    products,
    fetchProducts,
    requestPurchase,
    finishTransaction,
  } = useIAP({
    onPurchaseSuccess: async (purchase) => {
      try {
        const currentUid = auth.currentUser?.uid;
        if (!currentUid) {
          warning();
          setPurchasing(false);
          showToast(
            t("premiumNoUserOnPurchase", {
              defaultValue:
                "Aucun utilisateur connecté au moment de l’achat. Réessaie après t’être reconnecté.",
            }),
            "error"
          );
          return;
        }

        await updateDoc(doc(db, "users", currentUid), {
          premium: true,
          isPremium: true,
          premiumSince: serverTimestamp(),
          premiumPlatform: Platform.OS,
          premiumProductId:
            (purchase as any)?.productId ??
            (purchase as any)?.id ??
            PRODUCT_ID,
        });

        setUserPremium(true);

        await finishTransaction({
          purchase,
          isConsumable: false,
        });

        setPurchasing(false);
        success();
        showToast(
          t("purchaseSuccess", {
            defaultValue:
              "Merci pour ton soutien ❤️ Toutes les pubs sont désactivées.",
          }),
          "success"
        );
      } catch (error: any) {
        console.error("IAP / Firestore premium error:", error?.message || error);
        setPurchasing(false);
        warning();
        showToast(
          t("premiumActivationFailed", {
            defaultValue:
              "Activation impossible pour le moment. Contacte le support si le problème persiste.",
          }),
          "error"
        );
      }
    },
    onPurchaseError: (error) => {
      console.error("IAP purchase error:", error);
      setPurchasing(false);
      if ((error as any)?.code !== "E_USER_CANCELLED") {
        warning();
        showToast(
          t("purchaseFailed", {
            defaultValue: "Achat interrompu.",
          }),
          "error"
        );
      }
    },
  });

  // 🔐 Sécurise products pour éviter tout crash silencieux
  const safeProducts = products ?? [];
  const debugInfo = __DEV__
    ? `IAP connected=${connected ? "yes" : "no"} | products=${safeProducts.length}`
    : "";

  const connecting = !connected;

  // ---- Firestore: lire flag utilisateur (déféré après animations) ----
  useEffect(() => {
    let isMounted = true;
    const task = InteractionManager.runAfterInteractions(async () => {
      const currentUid = auth.currentUser?.uid;
      if (!currentUid) {
        if (!isMounted) return;
        setUserPremium(false);
        setInitializing(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", currentUid));
        const data = (snap.exists() ? snap.data() : {}) as any;
        if (!isMounted) return;
        setUserPremium(!!(data.premium ?? data.isPremium));
      } catch (e) {
        console.warn("Error loading user premium flag:", e);
        if (!isMounted) return;
        setUserPremium(false);
      } finally {
        if (isMounted) {
          setInitializing(false);
        }
      }
    });

    return () => {
      isMounted = false;
      // @ts-ignore compat
      task?.cancel?.();
    };
  }, []);

  // ---- IAP: fetch produits quand connecté (après interactions) ----
  useEffect(() => {
    if (!connected) return;

    const task = InteractionManager.runAfterInteractions(async () => {
      try {
        await fetchProducts({
          skus: [PRODUCT_ID],
          type: "subs",
        });
      } catch (e) {
        console.warn("IAP fetchProducts error:", e);
      }
    });

    return () => {
      // @ts-ignore compat
      task?.cancel?.();
    };
  }, [connected, fetchProducts]);

  // ---- Statut combiné : admin OU flag Firestore OU pubs déjà désactivées ----
  const isEffectivelyPremium = useMemo(() => {
    if (isAdmin) return true;
    if (userPremium) return true;
    if (!showBanners && !showInterstitials) return true;
    return false;
  }, [isAdmin, userPremium, showBanners, showInterstitials]);

  const buy = useCallback(
    async (productId: string) => {
      tap();

      if (isAdmin) {
        showToast(
          t("adminNoNeedPremium", {
            defaultValue: "Les admins n’ont pas besoin de Premium.",
          }),
          "info"
        );
        return;
      }
      if (!isLoggedIn) {
        showToast(
          t("premiumLoginRequired", {
            defaultValue:
              "Connecte-toi à ton compte pour passer en Premium et supprimer toutes les pubs.",
          }),
          "info"
        );
        router.push("/login");
        return;
      }
      if (!connected) {
        showToast(
          t("storeNotConnected", {
            defaultValue:
              "La boutique n’est pas encore prête. Réessaie dans quelques secondes.",
          }),
          "info"
        );
        return;
      }

      try {
        setPurchasing(true);
        await requestPurchase({
          request: {
            ios: { sku: productId },
            android: { skus: [productId] },
          },
          type: "subs",
        });
      } catch (e: any) {
        console.error("IAP requestPurchase error:", e);
        if (e?.code !== "E_USER_CANCELLED") {
          warning();
          showToast(
            t("purchaseFailed", {
              defaultValue: "Achat interrompu.",
            }),
            "error"
          );
        }
        setPurchasing(false);
      }
    },
    [isAdmin, isLoggedIn, connected, requestPurchase, router, t, showToast]
  );

  // ---- Restore = resynchroniser Firestore pour ce compte ----
  const restore = useCallback(async () => {
    tap();
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) {
      showToast(
        t("premiumLoginToRestore", {
          defaultValue:
            "Connecte-toi à ton compte pour restaurer tes achats Premium.",
        }),
        "info"
      );
      return;
    }

    try {
      setRestoring(true);
      const snap = await getDoc(doc(db, "users", currentUid));
      const data = (snap.exists() ? snap.data() : {}) as any;
      const isPremium = !!(data.premium ?? data.isPremium);
      setUserPremium(isPremium);

      if (isPremium) {
        success();
        showToast(
          t("premiumActive", {
            defaultValue:
              "Premium actif — merci pour ton soutien ❤️ Toutes les pubs sont désactivées.",
          }),
          "success"
        );
      } else {
        showToast(
          t("nothingToRestore", {
            defaultValue:
              "Aucun achat Premium trouvé pour ce compte. Vérifie que tu es connecté avec le bon compte.",
          }),
          "info"
        );
      }
    } catch (e) {
      console.error("restore Firestore error:", e);
      warning();
      showToast(
        t("restoreFailed", {
          defaultValue: "Restauration impossible pour le moment.",
        }),
        "error"
      );
    } finally {
      setRestoring(false);
    }
  }, [t, showToast]);

  // ---- Perks mémoïsés ----
  const perks = useMemo(
    () => [
      {
        icon: "close-circle-outline",
        label: t("perks.noInterstitals", {
          defaultValue: "Plus aucune pub interstitielle (écrans plein)",
        }),
      },
      {
        icon: "images-outline",
        label: t("perks.noBanners", {
          defaultValue: "Plus aucune bannière dans l’app",
        }),
      },
      {
        icon: "chatbubbles-outline",
        label: t("perks.prioritySupport", {
          defaultValue: "Support email prioritaire en cas de problème",
        }),
      },
      {
        icon: "heart-outline",
        label: t("perks.supportProject", {
          defaultValue:
            "Tu soutiens directement le développement de ChallengeTies (pas de pay-to-win)",
        }),
      },
    ],
    [t]
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: current.colors.background }]}
      edges={["top", "right", "left"]}
    >
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDark ? "light-content" : "dark-content"}
      />

      <LinearGradient
        colors={[current.colors.background, current.colors.cardBackground]}
        style={{ flex: 1 }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <CustomHeader
          title={t("premiumTitle", { defaultValue: "Premium" })}
        />

        {/* Debug IAP en DEV uniquement */}
        {__DEV__ && (
          <View style={{ paddingHorizontal: SPACING, paddingBottom: 4 }}>
            <Text
              style={{
                color: current.colors.textSecondary,
                fontSize: 12,
                fontFamily: "Comfortaa_400Regular",
              }}
            >
              {debugInfo}
            </Text>
          </View>
        )}

        {initializing ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={current.colors.secondary} />
            <Text
              style={[
                styles.loadingText,
                { color: current.colors.textSecondary },
              ]}
            >
              {t("loading", { defaultValue: "Chargement..." })}
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{
              padding: SPACING,
              paddingBottom: SPACING * 2.2,
            }}
            showsVerticalScrollIndicator={false}
          >
            {/* Status Card */}
            <LinearGradient
              colors={[
                current.colors.cardBackground,
                current.colors.cardBackground + "F0",
              ]}
              style={[styles.card, { borderColor: current.colors.secondary }]}
            >
              <View style={styles.row}>
                <Ionicons
                  name={isEffectivelyPremium ? "medal-outline" : "medal"}
                  size={22}
                  color={current.colors.secondary}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[styles.title, { color: current.colors.textPrimary }]}
                >
                  {isEffectivelyPremium
                    ? t("youArePremium", {
                        defaultValue: "Premium actif ✨",
                      })
                    : t("notPremiumYet", {
                        defaultValue: "Passe en Premium",
                      })}
                </Text>
              </View>
              <Text
                style={[
                  styles.subtitle,
                  { color: current.colors.textSecondary },
                ]}
              >
                {t("premiumExplainer", {
                  defaultValue:
                    "Premium supprime toutes les pubs de ChallengeTies. Pas d’avantage pay-to-win : juste une expérience plus fluide et un gros coup de pouce au projet.",
                })}
              </Text>
            </LinearGradient>

            {/* Perks */}
            <View style={styles.perksWrap}>
              {perks.map((p, idx) => (
                <LinearGradient
                  key={idx}
                  colors={[
                    current.colors.cardBackground,
                    current.colors.cardBackground + "F0",
                  ]}
                  style={[styles.perk, { borderColor: current.colors.primary }]}
                >
                  <Ionicons
                    name={p.icon as any}
                    size={18}
                    color={current.colors.secondary}
                  />
                  <Text
                    style={[
                      styles.perkText,
                      {
                        // 🔥 Texte bien lisible : blanc en dark, noir en light
                        color: isDark
                          ? current.colors.textPrimary
                          : "#000000",
                      },
                    ]}
                  >
                    {p.label}
                  </Text>
                </LinearGradient>
              ))}
            </View>

            {/* Pricing / CTA */}
            {!isEffectivelyPremium && (
              <LinearGradient
                colors={[
                  current.colors.cardBackground,
                  current.colors.cardBackground + "F0",
                ]}
                style={[styles.card, { borderColor: current.colors.primary }]}
              >
                {connecting ? (
                  <View style={styles.center}>
                    <ActivityIndicator
                      size="small"
                      color={current.colors.secondary}
                    />
                    <Text
                      style={[
                        styles.loadingText,
                        { color: current.colors.textSecondary },
                      ]}
                    >
                      {t("storeConnecting", {
                        defaultValue: "Connexion à la boutique...",
                      })}
                    </Text>
                  </View>
                ) : !isLoggedIn ? (
                  <View>
                    <Text
                      style={[
                        styles.subtitle,
                        { color: current.colors.textSecondary },
                      ]}
                    >
                      {t("premiumLoginRequired", {
                        defaultValue:
                          "Connecte-toi à ton compte pour passer en Premium et supprimer toutes les pubs.",
                      })}
                    </Text>

                    <TouchableOpacity
                      onPress={() => {
                        tap();
                        router.push("/login");
                      }}
                      activeOpacity={0.9}
                      style={{ marginTop: 12 }}
                      testID="premium-go-login"
                    >
                      <LinearGradient
                        colors={[
                          current.colors.primary,
                          current.colors.secondary,
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.buyBtn}
                      >
                        <Ionicons
                          name="log-in-outline"
                          size={18}
                          color={current.colors.textPrimary}
                        />
                        <Text
                          style={[
                            styles.buyText,
                            { color: current.colors.textPrimary },
                          ]}
                        >
                          {t("goToLogin", {
                            defaultValue: "Me connecter",
                          })}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                ) : safeProducts.length === 0 ? (
                  <Text
                    style={[
                      styles.subtitle,
                      { color: current.colors.textSecondary },
                    ]}
                  >
                    {t("noProducts", {
                      defaultValue:
                        "Produits indisponibles pour l’instant. Réessaie plus tard.",
                    })}
                  </Text>
                ) : (
                  safeProducts.map((p) => (
                    <View key={p.id} style={styles.productRow}>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.productTitle,
                            { color: current.colors.textPrimary },
                          ]}
                          numberOfLines={1}
                        >
                          {p.title?.replace(/\(.*\)$/, "").trim() ||
                            "ChallengeTies Premium"}
                        </Text>
                        <Text
                          style={[
                            styles.productDesc,
                            { color: current.colors.textSecondary },
                          ]}
                        >
                          {p.description ||
                            t("premiumProductDesc", {
                              defaultValue:
                                "Supprime toutes les pubs de l’app et soutiens les futures mises à jour.",
                            })}
                        </Text>
                      </View>

                      <TouchableOpacity
                        disabled={purchasing}
                        onPress={() => buy(p.id)}
                        activeOpacity={0.9}
                        style={{ opacity: purchasing ? 0.6 : 1 }}
                        testID="premium-buy-button"
                      >
                        <LinearGradient
                          colors={[
                            current.colors.primary,
                            current.colors.secondary,
                          ]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.buyBtn}
                        >
                          {purchasing ? (
                            <ActivityIndicator
                              color={current.colors.textPrimary}
                            />
                          ) : (
                            <>
                              <Ionicons
                                name="sparkles-outline"
                                size={18}
                                color={current.colors.textPrimary}
                              />
                              <Text
                                style={[
                                  styles.buyText,
                                  { color: current.colors.textPrimary },
                                ]}
                              >
                                {p.displayPrice ??
                                  t("buy", { defaultValue: "Acheter" })}
                              </Text>
                            </>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  ))
                )}

                {/* Restore */}
                <TouchableOpacity
                  disabled={restoring}
                  onPress={restore}
                  style={[
                    styles.restoreBtn,
                    { opacity: restoring ? 0.6 : 1 },
                  ]}
                  testID="premium-restore-button"
                >
                  {restoring ? (
                    <ActivityIndicator color={current.colors.secondary} />
                  ) : (
                    <>
                      <Ionicons
                        name="refresh-outline"
                        size={18}
                        color={current.colors.secondary}
                      />
                      <Text
                        style={[
                          styles.restoreText,
                          { color: current.colors.secondary },
                        ]}
                      >
                        {t("restorePurchases", {
                          defaultValue: "Restaurer mes achats",
                        })}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </LinearGradient>
            )}

            {/* Déjà premium */}
            {isEffectivelyPremium && (
              <LinearGradient
                colors={[
                  current.colors.cardBackground,
                  current.colors.cardBackground + "F0",
                ]}
                style={[styles.card, { borderColor: current.colors.secondary }]}
              >
                <Text
                  style={[
                    styles.subtitle,
                    { color: current.colors.textSecondary },
                  ]}
                >
                  {t("premiumActive", {
                    defaultValue:
                      "Premium actif — merci pour ton soutien ❤️ Toutes les pubs sont désactivées.",
                  })}
                </Text>
              </LinearGradient>
            )}
          </ScrollView>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  center: {
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING,
  },
  loadingText: {
    marginTop: 8,
    fontFamily: "Comfortaa_400Regular",
    fontSize: 16,
    textAlign: "center",
  },
  card: {
    borderWidth: 2,
    borderRadius: 18,
    padding: SPACING,
    marginBottom: SPACING,
  },
  row: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  title: { fontFamily: "Comfortaa_700Bold", fontSize: 20 },
  subtitle: {
    fontFamily: "Comfortaa_400Regular",
    fontSize: 15,
    lineHeight: 20,
  },
  perksWrap: { marginBottom: SPACING - 6, marginTop: 4 },
  perk: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  perkText: {
    fontFamily: "Comfortaa_400Regular",
    fontSize: 15,
    flexShrink: 1,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  productTitle: { fontFamily: "Comfortaa_700Bold", fontSize: 16 },
  productDesc: {
    fontFamily: "Comfortaa_400Regular",
    fontSize: 13,
    marginTop: 2,
  },
  buyBtn: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 110,
    justifyContent: "center",
  },
  buyText: { fontFamily: "Comfortaa_700Bold", fontSize: 15 },
  restoreBtn: {
    marginTop: 14,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  restoreText: { fontFamily: "Comfortaa_700Bold", fontSize: 14 },
});
