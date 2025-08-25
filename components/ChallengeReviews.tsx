// components/ChallengeReviews.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import { auth, db, storage } from "../constants/firebase-config";
import {
  Timestamp,
  doc,
  getDoc,
  onSnapshot,
  query,
  collection,
  orderBy,
} from "firebase/firestore";
import { updateDoc, serverTimestamp } from "firebase/firestore";

import { getDownloadURL, ref } from "firebase/storage";
import { useTheme } from "@/context/ThemeContext";
import designSystem from "../theme/designSystem";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "react-native";import {
  hasReviewed,
  submitReview,
  deleteReview,
  Review as ReviewModel,
} from "../helpers/reviewsHelpers";

interface Review extends ReviewModel {}
interface Props {
  challengeId: string;
  selectedDays?: number;
}

const ADMIN_UID = "GiN2yTfA7NWISeb4QjXmDPq5TgK2";
const FALLBACK_AVATAR = require("../assets/images/default-profile.webp"); // mets une image sûre ici (png ou webp)

const formatDate = (ts: Timestamp) => {
  try {
    const d = ts.toDate();
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
};

const Chip = ({ children, bg, fg }: { children: React.ReactNode; bg: string; fg: string }) => (
  <View style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: bg }}>
    <Text style={{ color: fg, fontWeight: "600", fontSize: 12 }}>{children}</Text>
  </View>
);

// ⭐️ Sélecteur d’étoiles
const Stars = ({
  value,
  onChange,
  size = 22,
  color = "#FFD700",
}: {
  value: number;
  onChange?: (n: number) => void;
  size?: number;
  color?: string;
}) => {
  const stars = [1, 2, 3, 4, 5];
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {stars.map((s) => (
        <TouchableOpacity
          key={s}
          activeOpacity={0.8}
          onPress={() => onChange && onChange(s)}
          disabled={!onChange}
          style={{ marginRight: 4 }}
          accessibilityLabel={`${s} ${s === 1 ? "star" : "stars"}`}
        >
          <Ionicons name={s <= value ? "star" : "star-outline"} size={size} color={color} />
        </TouchableOpacity>
      ))}
    </View>
  );
};

// 🔗 Résolution avatar HYBRIDE :
// - http(s) non Firebase → on garde tel quel
// - http(s) Firebase (firebasestorage.googleapis.com) → on extrait le path et on regénère via getDownloadURL
// - gs:// ou chemin Storage → getDownloadURL
const resolveAvatarUrl = async (raw?: string): Promise<string> => {
  if (!raw) return "";
  const url = raw.trim();

  // Cas A: déjà http(s)
  if (url.startsWith("http")) {
    try {
      const u = new URL(url);
      const isFirebase =
        u.hostname.includes("firebasestorage.googleapis.com") &&
        u.pathname.includes("/o/");
      if (!isFirebase) {
        // Pas une URL Firebase Storage : on garde tel quel
        return url;
      }
      // URL Firebase Storage -> extraire l’object path après "/o/"
      const idx = u.pathname.indexOf("/o/");
      if (idx === -1) return url; // fallback
      const encodedPath = u.pathname.substring(idx + 3); // après "/o/"
      const objectPath = decodeURIComponent(encodedPath.replace(/^\//, "")); // "profileImages/xxx.jpg"
      const r = ref(storage, objectPath);
      return await getDownloadURL(r); // URL fraîche avec token valide
    } catch {
      return url;
    }
  }

  // Cas B: gs://... ou chemin Storage → getDownloadURL
  try {
    const r = ref(storage, url);
    return await getDownloadURL(r);
  } catch {
    return "";
  }
};

const ReviewAvatar = ({ uri }: { uri?: string }) => {
  const [failed, setFailed] = useState(false);
  return (
    <Image
      source={failed || !uri ? FALLBACK_AVATAR : { uri }}
      defaultSource={FALLBACK_AVATAR}
      onError={() => setFailed(true)}
      style={{ width: 42, height: 42, borderRadius: 21, marginRight: 12 }}
      resizeMode="cover"
    />
  );
};



const ChallengeReviews: React.FC<Props> = ({ challengeId, selectedDays }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const currentTheme = isDarkMode ? designSystem.darkTheme : designSystem.lightTheme;

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [text, setText] = useState("");
  const [rating, setRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [effectiveDays, setEffectiveDays] = useState<number>(selectedDays ?? 0);

  const currentUser = auth.currentUser;
  const currentUserId = currentUser?.uid || "";
  // mode édition
const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
const isEditing = !!editingReviewId;


  // UI tokens
  const cardBG = currentTheme.colors.cardBackground;
  const borderGradient = isDarkMode
    ? (["rgba(255,255,255,0.14)", "rgba(255,215,0,0.24)"] as const)
    : (["rgba(0,0,0,0.05)", "rgba(0,0,0,0.10)"] as const);
  const chipBG = isDarkMode ? "rgba(255,215,0,0.18)" : "rgba(0,0,0,0.06)";
  const chipFG = isDarkMode ? "#FFD700" : "#333";

  const normId = useMemo(() => (challengeId || "").trim(), [challengeId]);

  // cache avatars (userId -> https url) + ce qu'on résout
  const [avatarCache, setAvatarCache] = useState<Record<string, string>>({});
  const resolvingRef = useRef<Set<string>>(new Set());

  // 🔴 Temps réel: avis
  useEffect(() => {
    if (!normId) {
      setReviews([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(db, "challenges", normId, "reviews"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Review[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            userId: data.userId,
            username: data.username ?? "Anonyme",
            avatar: data.avatar ?? "",
            daysSelected: Number(data.daysSelected ?? 0),
            text: data.text ?? "",
            createdAt: (data.createdAt as Timestamp) ?? Timestamp.now(),
            rating: Math.max(1, Math.min(5, Number(data.rating ?? 5))),
          };
        });
        setReviews(list);
        setLoading(false);
      },
      (err) => {
        console.error("onSnapshot reviews error:", err?.message || err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [normId]);

  // ✅ Éligibilité + jours + "déjà noté"
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (!currentUserId || !normId) {
          if (!cancelled) {
            setAlreadyReviewed(false);
            setCanReview(false);
          }
          return;
        }

        const [alreadyDone, userSnap] = await Promise.all([
          hasReviewed(normId, currentUserId),
          getDoc(doc(db, "users", currentUserId)),
        ]);

        let eligible = false;
        let resolvedDays = selectedDays ?? 0;

        if (userSnap.exists()) {
          const u = userSnap.data() || {};
          const completedIds: string[] = Array.isArray(u.CompletedChallengeIds) ? u.CompletedChallengeIds : [];
          const byIds = completedIds.map((x) => (x || "").trim()).includes(normId);

          const legacy: any[] = Array.isArray(u.CompletedChallenges) ? u.CompletedChallenges : [];
          const byLegacy = legacy.some(
            (c) => (c?.id === normId || c?.challengeId === normId) && (c?.completed === true || c?.status === "completed")
          );

          const current: any[] = Array.isArray(u.CurrentChallenges || u.currentChallenges)
            ? (u.CurrentChallenges || u.currentChallenges)
            : [];
          const currentMatch = current.find((c) => c?.id === normId || c?.challengeId === normId);
          const byCurrent =
            !!currentMatch &&
            (currentMatch.status === "completed" ||
              currentMatch.completed === true ||
              (typeof currentMatch.completedDays === "number" &&
                typeof currentMatch.selectedDays === "number" &&
                currentMatch.completedDays >= currentMatch.selectedDays));

          eligible = byIds || byLegacy || byCurrent;

          if (!resolvedDays || resolvedDays <= 0) {
            resolvedDays =
              (currentMatch?.selectedDays && Number(currentMatch.selectedDays)) ||
              (legacy.find((c) => c?.id === normId || c?.challengeId === normId)?.selectedDays) ||
              0;
          }
        }

        if (!cancelled) {
          setAlreadyReviewed(alreadyDone);
          setCanReview(eligible);
          setEffectiveDays(resolvedDays || 0);
        }
      } catch (e: any) {
        console.error("eligibility error:", e?.message || e);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [currentUserId, normId, selectedDays]);

useEffect(() => {
  (async () => {
    // 1) Avis qui ont un avatar → on tente de (re)résoudre (https Firebase, gs, path)
    const needResolveFromReview = reviews
      .filter((r) => {
        if (!r.userId) return false;
        if (avatarCache[r.userId]) return false;
        if (!r.avatar) return false; // vide -> géré en 2)
        if (resolvingRef.current.has(r.userId)) return false;
        return true; // on résout tous les avatars présents (inclut https Firebase expiré)
      })
      .map((r) => ({ userId: r.userId, raw: r.avatar! }));

    // 2) Avis sans avatar → backfill depuis users/{uid}.profileImage
    const needFromUserDoc = reviews
      .filter((r) => {
        if (!r.userId) return false;
        if (avatarCache[r.userId]) return false;
        return !r.avatar; // vide / undefined
      })
      .map((r) => r.userId);

    if (needResolveFromReview.length === 0 && needFromUserDoc.length === 0) return;

    needResolveFromReview.forEach(({ userId }) => resolvingRef.current.add(userId));
    try {
      // a) (Re)résoudre depuis l’avatar stocké dans l’avis
      const fromReview = await Promise.all(
        needResolveFromReview.map(async ({ userId, raw }) => {
          const https = await resolveAvatarUrl(raw);
          return { userId, https };
        })
      );

      // b) Backfill depuis users/{uid}.profileImage
      const uniqueUserIds = Array.from(new Set(needFromUserDoc));
      const fromUsers = await Promise.all(
        uniqueUserIds.map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, "users", uid));
            if (!snap.exists()) return { userId: uid, https: "" };
            const u = snap.data() as any;
            const raw = u?.profileImage || "";
            const https = raw ? await resolveAvatarUrl(raw) : "";
            return { userId: uid, https };
          } catch {
            return { userId: uid, https: "" };
          }
        })
      );

      const updates: Record<string, string> = {};
      [...fromReview, ...fromUsers].forEach(({ userId, https }) => {
        if (https) updates[userId] = https;
      });

      if (Object.keys(updates).length) {
        setAvatarCache((prev) => ({ ...prev, ...updates }));
      }
    } finally {
      needResolveFromReview.forEach(({ userId }) => resolvingRef.current.delete(userId));
    }
  })();
}, [reviews, avatarCache]);



  const handleOpenModal = () => {
  if (!canReview) return; // on peut laisser l’utilisateur ré-éditer même s’il a déjà laissé un avis
  setEditingReviewId(null);
  setRating(5);
  setText("");
  setShowModal(true);
};

const handleOpenEdit = (review: Review) => {
  if (review.userId !== currentUserId && currentUserId !== ADMIN_UID) return;
  setEditingReviewId(review.id); // = userId
  setRating(review.rating || 5);
  setText(review.text || "");
  setShowModal(true);
};

const handleSubmit = async () => {
  const trimmed = text.trim();
  if (!trimmed) return Alert.alert("Oups", "Écris un petit retour avant d’envoyer 😉");
  if (trimmed.length > 500) return Alert.alert("Oups", "Max 500 caractères");

  try {
    setSubmitting(true);

    // username + avatar rafraîchis depuis users/{uid} (et fallback auth)
    let username = currentUser?.displayName || "Anonyme";
    let avatarRaw = currentUser?.photoURL || "";
    try {
      const userSnap = await getDoc(doc(db, "users", currentUserId));
      if (userSnap.exists()) {
        const u = userSnap.data() as any;
        if (u?.username) username = u.username;
        if (u?.profileImage) avatarRaw = u.profileImage;
      }
    } catch {}

    const avatar = (await resolveAvatarUrl(avatarRaw)) || avatarRaw || "";

    if (isEditing && editingReviewId) {
      // ✅ UPDATE
      const reviewRef = doc(db, "challenges", normId, "reviews", editingReviewId);
      await updateDoc(reviewRef, {
        text: trimmed,
        rating: Math.max(1, Math.min(5, rating || 5)),
        username, // on garde synchro si pseudo changé
        avatar,   // idem pour la photo
        updatedAt: serverTimestamp(),
      });

      // Optimistic UI
      setReviews((prev) =>
        prev.map((r) =>
          r.id === editingReviewId
            ? { ...r, text: trimmed, rating: Math.max(1, Math.min(5, rating || 5)), username, avatar }
            : r
        )
      );
      if (avatar) setAvatarCache((p) => ({ ...p, [currentUserId]: avatar }));
      setShowModal(false);
      setEditingReviewId(null);
      setText("");
      return;
    }

    // ✅ CREATE (inchangé à part le reset editing)
    await submitReview(normId, {
      userId: currentUserId,
      username,
      avatar,
      daysSelected: Math.max(0, effectiveDays || 0),
      text: trimmed,
      createdAt: Timestamp.now(),
      rating: Math.max(1, Math.min(5, rating || 5)),
    });

    setReviews((prev) => [
      {
        id: currentUserId,
        userId: currentUserId,
        username,
        avatar,
        daysSelected: Math.max(0, effectiveDays || 0),
        text: trimmed,
        createdAt: Timestamp.now(),
        rating: Math.max(1, Math.min(5, rating || 5)),
      },
      ...prev,
    ]);
    if (avatar) setAvatarCache((p) => ({ ...p, [currentUserId]: avatar }));
    setAlreadyReviewed(true);
    setEditingReviewId(null);
    setShowModal(false);
    setText("");
  } catch (e: any) {
    console.error("review submit/update error:", e?.message || e);
    Alert.alert("Erreur", "Impossible d’enregistrer l’avis pour le moment.");
  } finally {
    setSubmitting(false);
  }
};


  const handleDelete = async (reviewId: string) => {
    Alert.alert(t("challengeDetails.confirmDeleteReview"), "", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await deleteReview(normId, reviewId);
          setReviews((prev) => prev.filter((r) => r.id !== reviewId));
        },
      },
    ]);
  };

  // ➗ moyenne sur 1 décimale
  const average = useMemo(() => {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
    return Math.round((sum / reviews.length) * 10) / 10;
  }, [reviews]);

  return (
    <View style={{ marginTop: 32, paddingHorizontal: 16 }}>
      {/* CTA Leave Review */}
      {canReview && !alreadyReviewed ? (
        <TouchableOpacity activeOpacity={0.9} onPress={handleOpenModal} style={{ alignSelf: "center", marginBottom: 18 }}>
          <LinearGradient
            colors={[currentTheme.colors.secondary, currentTheme.colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingVertical: 14,
              paddingHorizontal: 24,
              borderRadius: 999,
              shadowColor: "#000",
              shadowOpacity: 0.25,
              shadowOffset: { width: 0, height: 8 },
              shadowRadius: 16,
              elevation: 7,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>
              {t("challengeDetails.leaveReview")}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      ) : null}

      {!canReview && (
        <Text style={{ textAlign: "center", marginBottom: 16, color: currentTheme.colors.textSecondary }}>
          {t("challengeDetails.reviewAfterComplete")}
        </Text>
      )}
     {alreadyReviewed && (
  <Text style={{ textAlign: "center", marginBottom: 16, color: currentTheme.colors.textSecondary }}>
    {t("challengeDetails.alreadyReviewed")}
  </Text>
)}



      {/* Header premium responsive (titre sur ligne 1, stats sur ligne 2) */}
      <LinearGradient
        colors={
          isDarkMode
            ? ["rgba(255,255,255,0.06)", "rgba(255,215,0,0.12)"]
            : ["rgba(0,0,0,0.04)", "rgba(0,0,0,0.06)"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 12 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chatbubbles-outline" size={18} color={currentTheme.colors.secondary} style={{ marginRight: 6 }} />
          <Text
            style={{
              fontSize: 18,
              fontWeight: "800",
              letterSpacing: 0.2,
              color: isDarkMode ? currentTheme.colors.textPrimary : currentTheme.colors.secondary,
            }}
            numberOfLines={1}
          >
            {t("challengeDetails.reviewSectionTitle")}
          </Text>
        </View>

        <View
          style={{
            marginTop: 8,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            flexWrap: "wrap",
          }}
        >
          {reviews.length > 0 ? (
            <>
              <Stars value={Math.round(average)} size={16} />
              <Text
                style={{
                  marginLeft: 8,
                  fontWeight: "700",
                  color: isDarkMode ? currentTheme.colors.textPrimary : "#000",
                }}
                numberOfLines={1}
              >
                {average} · {reviews.length}
              </Text>
            </>
          ) : (
            <Text style={{ fontWeight: "700", color: currentTheme.colors.textSecondary }}>0 · 0</Text>
          )}
        </View>
      </LinearGradient>

      {/* Liste des avis */}
      {loading ? (
        <ActivityIndicator size="large" color={currentTheme.colors.primary} />
      ) : reviews.length === 0 ? (
        <Text style={{ color: currentTheme.colors.textSecondary }}>{t("challengeDetails.noReviewsYet")}</Text>
      ) : (
        <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
          {reviews.map((r) => {
            const candidate =
   avatarCache[r.userId] || (r.avatar && r.avatar.startsWith("http") ? r.avatar : "");

            return (
              <View key={r.id} style={{ marginBottom: 14 }}>
                <LinearGradient
                  colors={borderGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ borderRadius: 16, padding: 1.2 }}
                >
                  <View
                    style={{
                      backgroundColor: cardBG,
                      borderRadius: 16,
                      padding: 14,
                      shadowColor: "#000",
                      shadowOpacity: 0.15,
                      shadowOffset: { width: 0, height: 4 },
                      shadowRadius: 8,
                      elevation: 3,
                    }}
                  >
                    {/* Header */}
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                      <ReviewAvatar uri={candidate} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={{
                            fontWeight: "800",
                            color: isDarkMode ? currentTheme.colors.textPrimary : "#000",
                          }}
                          numberOfLines={1}
                        >
                          {r.username || "Anonyme"}
                        </Text>
                        <Text style={{ color: currentTheme.colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                          {formatDate(r.createdAt)}
                        </Text>
                      </View>

                      <Chip bg={chipBG} fg={chipFG}>{r.daysSelected} j</Chip>
                    </View>

                    {/* Stars + Content */}
                    <View style={{ marginBottom: 6, flexDirection: "row", alignItems: "center" }}>
                      <Stars value={r.rating || 0} />
                    </View>

                    <Text style={{ color: isDarkMode ? currentTheme.colors.textPrimary : "#000", lineHeight: 20 }}>
                      {r.text}
                    </Text>

                    {/* Admin delete */}
                    {/* Actions (éditer/supprimer) */}
<View style={{ flexDirection: "row", gap: 12, marginTop: 10, alignSelf: "flex-end" }}>
  {r.userId === currentUserId && (
    <>
      <TouchableOpacity
        onPress={() => handleOpenEdit(r)}
        accessibilityLabel={t("editYourReview")}
      >
        <Ionicons name="create-outline" size={18} color={currentTheme.colors.secondary} />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => handleDelete(r.id)}
        accessibilityLabel={t("deleteReview")}
      >
        <Ionicons name="trash-outline" size={18} color="#FF5757" />
      </TouchableOpacity>
    </>
  )}

  {currentUserId === ADMIN_UID && r.userId !== currentUserId && (
    <TouchableOpacity
      onPress={() => handleDelete(r.id)}
      accessibilityLabel={t("deleteReview")}
    >
      <Ionicons name="trash-outline" size={18} color="#FF5757" />
    </TouchableOpacity>
  )}
</View>


                  </View>
                </LinearGradient>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* MODAL */}
      <Modal visible={showModal} animationType="fade" transparent>
        <View
          style={{
            flex: 1,
            backgroundColor: isDarkMode ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.45)",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: currentTheme.colors.background,
              borderRadius: 20,
              padding: 20,
              shadowColor: "#000",
              shadowOpacity: 0.25,
              shadowOffset: { width: 0, height: 8 },
              shadowRadius: 16,
              elevation: 8,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <Ionicons name="create-outline" size={18} color={currentTheme.colors.secondary} style={{ marginRight: 6 }} />
              <Text style={{ fontWeight: "800", fontSize: 16, color: currentTheme.colors.textPrimary }}>
                {isEditing ? t("editYourReview") : t("challengeDetails.yourReview")}

              </Text>
            </View>

            {/* Stars picker */}
            <View style={{ marginBottom: 12 }}>
              <Stars value={rating} onChange={setRating} size={28} />
            </View>

            <TextInput
              multiline
              value={text}
              onChangeText={setText}
              placeholder={t("challengeDetails.reviewPlaceholder")}
              maxLength={500}
              placeholderTextColor={isDarkMode ? "rgba(255,255,255,0.6)" : "#666"}
              style={{
                height: 130,
                borderRadius: 12,
                padding: 12,
                backgroundColor: currentTheme.colors.cardBackground,
                color: isDarkMode ? currentTheme.colors.textPrimary : "#000",
                textAlignVertical: "top",
                borderWidth: 1,
                borderColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
              }}
            />
            <Text style={{ textAlign: "right", marginTop: 6, color: currentTheme.colors.textSecondary, fontSize: 12 }}>
              {text.length}/500
            </Text>

            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 14, alignItems: "center" }}>
              <TouchableOpacity onPress={() => setShowModal(false)} style={{ paddingVertical: 10, paddingHorizontal: 12 }}>
                <Text style={{ color: currentTheme.colors.textSecondary }}>{t("common.cancel") || "Annuler"}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={submitting ? undefined : handleSubmit} activeOpacity={0.85}>
                <LinearGradient
                  colors={[currentTheme.colors.primary, currentTheme.colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, marginLeft: 8, minWidth: 120, alignItems: "center" }}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{ color: "#fff", fontWeight: "800" }}>
                      {isEditing ? t("saveReview") : t("challengeDetails.submitReview")}

                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ChallengeReviews;
