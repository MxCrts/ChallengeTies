import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import designSystem from "../../theme/designSystem";
import CustomHeader from "@/components/CustomHeader";
import { auth, db } from "../../constants/firebase-config";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useAdsVisibility } from "../../src/context/AdsVisibilityContext";
import { useRouter } from "expo-router";
import { useIAP } from "expo-iap";

const PRODUCT_ID = "challengeties_premium_monthly";
const SPACING = 20;

export default function SettingsPremium() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const current = isDark ? designSystem.darkTheme : designSystem.lightTheme;
  const { showBanners, showInterstitials, isAdmin } = useAdsVisibility();
  const router = useRouter();

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
          Alert.alert(
            t("error", "Erreur"),
            t(
              "premiumNoUserOnPurchase",
              "Aucun utilisateur connecté au moment de l’achat. Réessaie après t’être reconnecté."
            )
          );
          return;
        }

        // Mise à jour Firestore : ton app lit déjà ces flags partout
        await updateDoc(doc(db, "users", currentUid), {
          premium: true, // clé principale
          isPremium: true, // compat avec l’existant
          premiumSince: serverTimestamp(),
          premiumPlatform: Platform.OS,
          premiumProductId:
            (purchase as any)?.productId ??
            (purchase as any)?.id ??
            PRODUCT_ID,
        });

        setUserPremium(true);

        // On marque la transaction comme terminée côté Store
        await finishTransaction({
          purchase,
          // Premium = non consommable (on ne “mange” pas l’achat)
          isConsumable: false,
        });

        setPurchasing(false);
        Alert.alert(
          t("success", "Succès"),
          t("purchaseSuccess", "Merci, Premium activé 🎉")
        );
      } catch (error: any) {
        console.error("IAP / Firestore premium error:", error?.message || error);
        setPurchasing(false);
        Alert.alert(
          t("error", "Erreur"),
          t(
            "premiumActivationFailed",
            "Activation impossible pour le moment. Contacte le support si le problème persiste."
          )
        );
      }
    },
    onPurchaseError: (error) => {
      console.error("IAP purchase error:", error);
      setPurchasing(false);
      Alert.alert(
        t("error", "Erreur"),
        t("purchaseFailed", "Achat interrompu.")
      );
    },
  });

  const connecting = !connected;

  // ---- Firestore: lire flag utilisateur ----
  useEffect(() => {
    const loadUserFlag = async () => {
      const currentUid = auth.currentUser?.uid;
      if (!currentUid) {
        setUserPremium(false);
        setInitializing(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", currentUid));
        const data = (snap.exists() ? snap.data() : {}) as any;
        setUserPremium(!!(data.premium ?? data.isPremium));
      } catch (e) {
        console.warn("Error loading user premium flag:", e);
        setUserPremium(false);
      } finally {
        setInitializing(false);
      }
    };

    loadUserFlag();
  }, []);

  // ---- IAP: fetch produits quand connecté ----
  useEffect(() => {
    if (!connected) return;
    const loadProducts = async () => {
      try {
        await fetchProducts({
          skus: [PRODUCT_ID],
          // le type exact (in-app / subs) dépendra de ta config Store,
          // mais l’API se charge de mapper correctement côté plateforme
          type: "in-app",
        });
      } catch (e) {
        console.warn("IAP fetchProducts error:", e);
      }
    };
    loadProducts();
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
    if (isAdmin) {
      Alert.alert(
        t("info", "Info"),
        t("adminNoNeedPremium", "Les admins n’ont pas besoin de Premium.")
      );
      return;
    }
    if (!isLoggedIn) {
      Alert.alert(
        t("info", "Info"),
        t(
          "premiumLoginRequired",
          "Connecte-toi à ton compte pour passer en Premium et supprimer toutes les pubs."
        )
      );
      router.push("/login");
      return;
    }
    if (!connected) {
      Alert.alert(
        t("info", "Info"),
        t(
          "storeNotConnected",
          "La boutique n’est pas encore prête. Réessaie dans quelques secondes."
        )
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
        type: "in-app", // 👈 ICI LE FIX
      });
    } catch (e: any) {
      console.error("IAP requestPurchase error:", e);
      if (e?.code !== "E_USER_CANCELLED") {
        Alert.alert(
          t("error", "Erreur"),
          t("purchaseFailed", "Achat interrompu.")
        );
      }
      setPurchasing(false);
    }
  },
  [isAdmin, isLoggedIn, connected, requestPurchase, router, t]
);


  // ---- Restore = resynchroniser Firestore pour ce compte ----
  const restore = useCallback(async () => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) {
      Alert.alert(
        t("info", "Info"),
        t(
          "premiumLoginToRestore",
          "Connecte-toi à ton compte pour restaurer tes achats Premium."
        )
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
        Alert.alert(
          t("success", "Succès"),
          t(
            "premiumActive",
            "Premium actif — merci pour ton soutien ❤️ L’app reste 100 % jouable pour tous."
          )
        );
      } else {
        Alert.alert(
          t("info", "Info"),
          t(
            "nothingToRestore",
            "Aucun achat Premium trouvé pour ce compte. Vérifie que tu es connecté avec le bon compte."
          )
        );
      }
    } catch (e) {
      console.error("restore Firestore error:", e);
      Alert.alert(
        t("error", "Erreur"),
        t("restoreFailed", "Restauration impossible pour le moment.")
      );
    } finally {
      setRestoring(false);
    }
  }, [t]);

  const perks = [
    {
      icon: "logo-no-smoking",
      label: t(
        "perks.noInterstitals",
        "Aucune pub interstitielle (pas de coupure brutale)"
      ),
    },
    {
      icon: "image-outline",
      label: t("perks.noBanners", "Aucune bannière affichée dans l’app"),
    },
    {
      icon: "sparkles-outline",
      label: t(
        "perks.premiumTheme",
        "Ambiance visuelle plus clean et immersive"
      ),
    },
    {
      icon: "heart-outline",
      label: t(
        "perks.supportProject",
        "Tu soutiens directement le développement de ChallengeTies (pas de pay-to-win)"
      ),
    },
  ];

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: current.colors.background }]}
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
        <CustomHeader title={t("premiumTitle", "Premium")} />

        {initializing ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={current.colors.secondary} />
            <Text
              style={[
                styles.loadingText,
                { color: current.colors.textSecondary },
              ]}
            >
              {t("loading", "Chargement...")}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: SPACING }}>
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
                    ? t("youArePremium", "Tu es Premium ✨")
                    : t("notPremiumYet", "Passe en Premium")}
                </Text>
              </View>
              <Text
                style={[
                  styles.subtitle,
                  { color: current.colors.textSecondary },
                ]}
              >
                {t(
                  "premiumExplainer",
                  "Premium supprime les publicités et améliore ton confort, sans aucun avantage pay-to-win."
                )}
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
                      { color: current.colors.textPrimary },
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
                      {t("storeConnecting", "Connexion à la boutique...")}
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
                      {t(
                        "premiumLoginRequired",
                        "Connecte-toi à ton compte pour passer en Premium et supprimer toutes les pubs."
                      )}
                    </Text>

                    <TouchableOpacity
                      onPress={() => router.push("/login")}
                      activeOpacity={0.9}
                      style={{ marginTop: 12 }}
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
                          {t("goToLogin", "Me connecter")}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                ) : products.length === 0 ? (
                  <Text
                    style={[
                      styles.subtitle,
                      { color: current.colors.textSecondary },
                    ]}
                  >
                    {t(
                      "noProducts",
                      "Produits indisponibles pour l’instant. Réessaie plus tard."
                    )}
                  </Text>
                ) : (
                  products.map((p) => (
                    <View key={p.id} style={styles.productRow}>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.productTitle,
                            { color: current.colors.textPrimary },
                          ]}
                        >
                          {p.title?.replace(/\(.*\)$/, "").trim() || "Premium"}
                        </Text>
                        <Text
                          style={[
                            styles.productDesc,
                            { color: current.colors.textSecondary },
                          ]}
                        >
                          {p.description ||
                            t(
                              "premiumProductDesc",
                              "Suppression totale des pubs + expérience plus fluide."
                            )}
                        </Text>
                      </View>

                      <TouchableOpacity
                        disabled={purchasing}
                        onPress={() => buy(p.id)}
                        activeOpacity={0.9}
                        style={{ opacity: purchasing ? 0.6 : 1 }}
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
                                  t("buy", "Acheter")}
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
                        {t("restorePurchases", "Restaurer mes achats")}
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
                  {t(
                    "premiumActive",
                    "Premium actif — merci pour ton soutien ❤️ L’app reste 100 % jouable pour tous."
                  )}
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
  center: { alignItems: "center", justifyContent: "center", padding: SPACING },
  loadingText: {
    marginTop: 8,
    fontFamily: "Comfortaa_400Regular",
    fontSize: 16,
  },
  card: {
    borderWidth: 2,
    borderRadius: 18,
    padding: SPACING,
    marginBottom: SPACING,
  },
  row: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  title: { fontFamily: "Comfortaa_700Bold", fontSize: 20 },
  subtitle: { fontFamily: "Comfortaa_400Regular", fontSize: 15, lineHeight: 20 },
  perksWrap: { marginBottom: SPACING - 6 },
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
  perkText: { fontFamily: "Comfortaa_500Medium", fontSize: 15, flexShrink: 1 },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  productTitle: { fontFamily: "Comfortaa_700Bold", fontSize: 16 },
  productDesc: { fontFamily: "Comfortaa_400Regular", fontSize: 13, marginTop: 2 },
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
