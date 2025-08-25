// import React, { useEffect, useMemo, useState, useCallback } from "react";
// import {
//   View,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   Alert,
//   ActivityIndicator,
//   Platform,
//   StatusBar,
//   SafeAreaView,
//   ScrollView,
// } from "react-native";
// import { LinearGradient } from "expo-linear-gradient";
// import { Ionicons } from "@expo/vector-icons";
// import * as IAP from "expo-in-app-purchases";
// import { useTranslation } from "react-i18next";
// import { useTheme } from "../../context/ThemeContext";
// import designSystem from "../../theme/designSystem";
// import CustomHeader from "@/components/CustomHeader";
// import { auth, db } from "../../constants/firebase-config";
// import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
// import { useAdsVisibility } from "../../src/context/AdsVisibilityContext";

// /**
//  * IMPORTANT — RENSEIGNE TES PRODUCT IDS dans App Store / Google Play
//  * - iOS: un "auto‑renewable subscription" (ex: monthly + yearly) ou un "non‑consumable" si tu veux un achat à vie
//  * - Android: un "subscription" (Play Billing v5)
//  */
// const IOS_PRODUCT_IDS = ["premium_monthly", "premium_yearly"];   // ← remplace par tes IDs
// const ANDROID_PRODUCT_IDS = ["premium_monthly", "premium_yearly"]; // ← remplace par tes IDs

// const SPACING = 20;

// export default function SettingsPremium() {
//   const { t } = useTranslation();
//   const { theme } = useTheme();
//   const isDark = theme === "dark";
//   const current = isDark ? designSystem.darkTheme : designSystem.lightTheme;
//   const { showBanners, showInterstitials, isAdmin } = useAdsVisibility();

//   const [initializing, setInitializing] = useState(true);
//   const [connecting, setConnecting] = useState(false);
//   const [purchasing, setPurchasing] = useState(false);
//   const [restoring, setRestoring] = useState(false);
//   const [products, setProducts] = useState<IAP.IAPItemDetails[]>([]);
//   const [userPremium, setUserPremium] = useState<boolean>(false);

//   // Statut actuel (si admin => considéré premium pour l'affichage, mais on ne propose pas d'achat)
//   const isEffectivelyPremium = useMemo(() => {
//     if (isAdmin) return true;
//     if (userPremium) return true;
//     // fallback: si ton AdsVisibilityContext se base déjà sur user.isPremium
//     if (!showBanners && !showInterstitials) return true;
//     return false;
//   }, [isAdmin, userPremium, showBanners, showInterstitials]);

//   // -------- Firestore: lire flag utilisateur
//   useEffect(() => {
//     const loadUserFlag = async () => {
//       const uid = auth.currentUser?.uid;
//       if (!uid) {
//         setUserPremium(false);
//         return;
//       }
//       try {
//         const snap = await getDoc(doc(db, "users", uid));
//         const data = snap.exists() ? snap.data() : {};
//         setUserPremium(!!data.isPremium);
//       } catch {
//         setUserPremium(false);
//       }
//     };
//     loadUserFlag();
//   }, []);

//   // -------- IAP: connexion + fetch produits + listener
//   useEffect(() => {
//     let _sub: IAP.PurchaseListener | null = null;

//     const init = async () => {
//       try {
//         setConnecting(true);
//         await IAP.connectAsync();

//         const ids = Platform.select({
//           ios: IOS_PRODUCT_IDS,
//           android: ANDROID_PRODUCT_IDS,
//           default: [],
//         })!;
//         const { responseCode, results } = await IAP.getProductsAsync(ids);

//         if (responseCode === IAP.IAPResponseCode.OK && results?.length) {
//           setProducts(results);
//         } else {
//           setProducts([]);
//         }

//         _sub = IAP.setPurchaseListener(async ({ responseCode, results, errorCode }) => {
//           if (responseCode === IAP.IAPResponseCode.OK) {
//             for (const purchase of results) {
//               try {
//                 await handlePurchaseSuccess(purchase);
//                 // Terminer la transaction
//                 await IAP.finishTransactionAsync(purchase, false);
//               } catch (err: any) {
//                 console.warn("finishTransactionAsync error:", err?.message || err);
//               }
//             }
//           } else if (responseCode === IAP.IAPResponseCode.USER_CANCELED) {
//             setPurchasing(false);
//           } else {
//             console.warn("IAP error:", responseCode, errorCode);
//             setPurchasing(false);
//           }
//         });
//       } catch (err: any) {
//         console.error("IAP connect error:", err?.message || err);
//       } finally {
//         setConnecting(false);
//         setInitializing(false);
//       }
//     };

//     init();

//     return () => {
//       try {
//         if (_sub) IAP.removePurchaseListener(_sub);
//       } catch {}
//       IAP.disconnectAsync().catch(() => {});
//     };
//   }, []);

//   const handlePurchaseSuccess = useCallback(
//     async (purchase: IAP.InAppPurchase) => {
//       const uid = auth.currentUser?.uid;
//       if (!uid) return;

//       // Marquer l’utilisateur premium
//       try {
//         await updateDoc(doc(db, "users", uid), {
//           isPremium: true,
//           premiumSince: serverTimestamp(),
//           premiumPlatform: Platform.OS,
//           premiumProductId: purchase.productId,
//           premiumOrderId: purchase.orderId ?? null,
//         });
//         setUserPremium(true);
//         setPurchasing(false);
//         Alert.alert(t("success"), t("purchaseSuccess", { defaultValue: "Merci, Premium activé 🎉" }));
//       } catch (e) {
//         console.error("Firestore premium flag error:", e);
//         Alert.alert(t("error"), t("premiumActivationFailed", { defaultValue: "Activation impossible. Contacte le support." }));
//       }
//     },
//     [t]
//   );

//   const buy = useCallback(
//     async (productId: string) => {
//       if (isAdmin) {
//         Alert.alert(t("info"), t("adminNoNeedPremium", { defaultValue: "Les admins n’ont pas besoin de Premium." }));
//         return;
//       }
//       try {
//         setPurchasing(true);
//         await IAP.purchaseItemAsync(productId);
//       } catch (e: any) {
//         setPurchasing(false);
//         if (e?.code !== "E_USER_CANCELLED") {
//           Alert.alert(t("error"), t("purchaseFailed", { defaultValue: "Achat interrompu." }));
//         }
//       }
//     },
//     [isAdmin, t]
//   );

//   const restore = useCallback(async () => {
//     try {
//       setRestoring(true);
//       const { results } = await IAP.getPurchaseHistoryAsync(false);
//       if (!results?.length) {
//         setRestoring(false);
//         Alert.alert(t("info"), t("nothingToRestore", { defaultValue: "Aucun achat à restaurer." }));
//         return;
//       }
//       // On prend la dernière transaction et on (re)pose le flag
//       const p = results[0];
//       await handlePurchaseSuccess(p);
//       setRestoring(false);
//     } catch (e) {
//       console.error("restore error:", e);
//       setRestoring(false);
//       Alert.alert(t("error"), t("restoreFailed", { defaultValue: "Restauration impossible." }));
//     }
//   }, [t, handlePurchaseSuccess]);

//   const perks = [
//     { icon: "logo-no-smoking", label: t("perks.noInterstitals", { defaultValue: "Aucune pub interstitielle" }) },
//     { icon: "image-outline", label: t("perks.noBanners", { defaultValue: "Aucune bannière" }) },
//     { icon: "star-outline", label: t("perks.priority", { defaultValue: "Priorité sur les nouveautés" }) },
//     { icon: "sparkles-outline", label: t("perks.premiumTheme", { defaultValue: "Ambiance visuelle premium" }) },
//   ];

//   return (
//     <SafeAreaView style={[styles.safeArea, { backgroundColor: current.colors.background }]}>
//       <StatusBar translucent backgroundColor="transparent" barStyle={isDark ? "light-content" : "dark-content"} />
//       <LinearGradient
//         colors={[current.colors.background, current.colors.cardBackground]}
//         style={{ flex: 1 }}
//         start={{ x: 0, y: 0 }}
//         end={{ x: 1, y: 1 }}
//       >
//         <CustomHeader title={t("premiumTitle", { defaultValue: "Premium" })} />

//         {initializing ? (
//           <View style={styles.center}>
//             <ActivityIndicator size="large" color={current.colors.secondary} />
//             <Text style={[styles.loadingText, { color: current.colors.textSecondary }]}>
//               {t("loading", { defaultValue: "Chargement..." })}
//             </Text>
//           </View>
//         ) : (
//           <ScrollView contentContainerStyle={{ padding: SPACING }}>
//             {/* Status Card */}
//             <LinearGradient
//               colors={[current.colors.cardBackground, current.colors.cardBackground + "F0"]}
//               style={[styles.card, { borderColor: current.colors.secondary }]}
//             >
//               <View style={styles.row}>
//                 <Ionicons
//                   name={isEffectivelyPremium ? "medal-outline" : "medal"}
//                   size={22}
//                   color={current.colors.secondary}
//                   style={{ marginRight: 8 }}
//                 />
//                 <Text style={[styles.title, { color: current.colors.textPrimary }]}>
//                   {isEffectivelyPremium
//                     ? t("youArePremium", { defaultValue: "Vous êtes Premium ✨" })
//                     : t("notPremiumYet", { defaultValue: "Passez en Premium" })}
//                 </Text>
//               </View>
//               <Text style={[styles.subtitle, { color: current.colors.textSecondary }]}>
//                 {t("premiumExplainer", {
//                   defaultValue:
//                     "Premium supprime toutes les publicités et débloque des améliorations de confort.",
//                 })}
//               </Text>
//             </LinearGradient>

//             {/* Perks */}
//             <View style={styles.perksWrap}>
//               {perks.map((p, idx) => (
//                 <LinearGradient
//                   key={idx}
//                   colors={[current.colors.cardBackground, current.colors.cardBackground + "F0"]}
//                   style={[styles.perk, { borderColor: current.colors.primary }]}
//                 >
//                   <Ionicons name={p.icon as any} size={18} color={current.colors.secondary} />
//                   <Text style={[styles.perkText, { color: current.colors.textPrimary }]}>{p.label}</Text>
//                 </LinearGradient>
//               ))}
//             </View>

//             {/* Pricing / CTA */}
//             {!isEffectivelyPremium && (
//               <LinearGradient
//                 colors={[current.colors.cardBackground, current.colors.cardBackground + "F0"]}
//                 style={[styles.card, { borderColor: current.colors.primary }]}
//               >
//                 {connecting ? (
//                   <View style={styles.center}>
//                     <ActivityIndicator size="small" color={current.colors.secondary} />
//                     <Text style={[styles.loadingText, { color: current.colors.textSecondary }]}>
//                       {t("storeConnecting", { defaultValue: "Connexion à la boutique..." })}
//                     </Text>
//                   </View>
//                 ) : products.length === 0 ? (
//                   <Text style={[styles.subtitle, { color: current.colors.textSecondary }]}>
//                     {t("noProducts", { defaultValue: "Produits indisponibles pour l’instant." })}
//                   </Text>
//                 ) : (
//                   products.map((p) => (
//                     <View key={p.productId} style={styles.productRow}>
//                       <View style={{ flex: 1 }}>
//                         <Text style={[styles.productTitle, { color: current.colors.textPrimary }]}>
//                           {p.title?.replace(/\(.*\)$/,"").trim() || "Premium"}
//                         </Text>
//                         <Text style={[styles.productDesc, { color: current.colors.textSecondary }]}>
//                           {p.description || t("premiumProductDesc", { defaultValue: "Suppression totale des pubs" })}
//                         </Text>
//                       </View>

//                       <TouchableOpacity
//                         disabled={purchasing}
//                         onPress={() => buy(p.productId)}
//                         activeOpacity={0.9}
//                         style={{ opacity: purchasing ? 0.6 : 1 }}
//                       >
//                         <LinearGradient
//                           colors={[current.colors.primary, current.colors.secondary]}
//                           start={{ x: 0, y: 0 }}
//                           end={{ x: 1, y: 1 }}
//                           style={styles.buyBtn}
//                         >
//                           {purchasing ? (
//                             <ActivityIndicator color={current.colors.textPrimary} />
//                           ) : (
//                             <>
//                               <Ionicons name="sparkles-outline" size={18} color={current.colors.textPrimary} />
//                               <Text style={[styles.buyText, { color: current.colors.textPrimary }]}>
//                                 {p.price ?? t("buy", { defaultValue: "Acheter" })}
//                               </Text>
//                             </>
//                           )}
//                         </LinearGradient>
//                       </TouchableOpacity>
//                     </View>
//                   ))
//                 )}

//                 {/* Restore */}
//                 <TouchableOpacity
//                   disabled={restoring}
//                   onPress={restore}
//                   style={[styles.restoreBtn, { opacity: restoring ? 0.6 : 1 }]}
//                 >
//                   {restoring ? (
//                     <ActivityIndicator color={current.colors.secondary} />
//                   ) : (
//                     <>
//                       <Ionicons name="refresh-outline" size={18} color={current.colors.secondary} />
//                       <Text style={[styles.restoreText, { color: current.colors.secondary }]}>
//                         {t("restorePurchases", { defaultValue: "Restaurer mes achats" })}
//                       </Text>
//                     </>
//                   )}
//                 </TouchableOpacity>
//               </LinearGradient>
//             )}

//             {/* Déjà premium */}
//             {isEffectivelyPremium && (
//               <LinearGradient
//                 colors={[current.colors.cardBackground, current.colors.cardBackground + "F0"]}
//                 style={[styles.card, { borderColor: current.colors.secondary }]}
//               >
//                 <Text style={[styles.subtitle, { color: current.colors.textSecondary }]}>
//                   {t("premiumActive", { defaultValue: "Premium actif — merci pour votre soutien ❤️" })}
//                 </Text>
//               </LinearGradient>
//             )}
//           </ScrollView>
//         )}
//       </LinearGradient>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   safeArea: { flex: 1 },
//   center: { alignItems: "center", justifyContent: "center", padding: SPACING },
//   loadingText: { marginTop: 8, fontFamily: "Comfortaa_400Regular", fontSize: 16 },
//   card: {
//     borderWidth: 2,
//     borderRadius: 18,
//     padding: SPACING,
//     marginBottom: SPACING,
//   },
//   row: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
//   title: { fontFamily: "Comfortaa_700Bold", fontSize: 20 },
//   subtitle: { fontFamily: "Comfortaa_400Regular", fontSize: 15, lineHeight: 20 },
//   perksWrap: { marginBottom: SPACING - 6 },
//   perk: {
//     borderWidth: 1.5,
//     borderRadius: 14,
//     paddingVertical: 10,
//     paddingHorizontal: 12,
//     marginBottom: 10,
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 10,
//   },
//   perkText: { fontFamily: "Comfortaa_500Medium", fontSize: 15, flexShrink: 1 },
//   productRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
//   productTitle: { fontFamily: "Comfortaa_700Bold", fontSize: 16 },
//   productDesc: { fontFamily: "Comfortaa_400Regular", fontSize: 13, marginTop: 2 },
//   buyBtn: {
//     borderRadius: 12,
//     paddingVertical: 10,
//     paddingHorizontal: 14,
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 6,
//     minWidth: 110,
//     justifyContent: "center",
//   },
//   buyText: { fontFamily: "Comfortaa_700Bold", fontSize: 15 },
//   restoreBtn: {
//     marginTop: 14,
//     alignSelf: "flex-start",
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 8,
//     paddingVertical: 8,
//     paddingHorizontal: 10,
//   },
//   restoreText: { fontFamily: "Comfortaa_700Bold", fontSize: 14 },
// });
