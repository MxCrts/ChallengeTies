// components/ChallengeReviews.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  Platform,
  Pressable,
  KeyboardAvoidingView,
} from "react-native";
import type { ViewStyle, TextStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { auth, db, storage } from "@/constants/firebase-config";
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
import { Image } from "react-native";
import {
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
const FALLBACK_AVATAR = require("../assets/images/default-profile.webp");

// ✅ Typography (aligned with tips.tsx)
const FONT = {
  regular: "Comfortaa_400Regular",
  bold: "Comfortaa_700Bold",
} as const;

/* ---------------------------------- Utils --------------------------------- */
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

const formatDate = (ts: Timestamp) => {
  try {
    const d = ts.toDate();
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
};

/** 🔗 Avatar resolver (http/https + Firebase Storage + gs:// + path) */
const resolveAvatarUrl = async (raw?: string): Promise<string> => {
  if (!raw) return "";
  const url = raw.trim();

  if (url.startsWith("http")) {
    try {
      const u = new URL(url);
      const isFirebase =
        u.hostname.includes("firebasestorage.googleapis.com") &&
        u.pathname.includes("/o/");
      if (!isFirebase) return url;

      const idx = u.pathname.indexOf("/o/");
      if (idx === -1) return url;
      const encodedPath = u.pathname.substring(idx + 3);
      const objectPath = decodeURIComponent(encodedPath.replace(/^\//, ""));
      const r = ref(storage, objectPath);
      return await getDownloadURL(r);
    } catch {
      return url;
    }
  }

  try {
    const r = ref(storage, url);
    return await getDownloadURL(r);
  } catch {
    return "";
  }
};

const ReviewAvatar = ({ uri, size }: { uri?: string; size: number }) => {
  const [failed, setFailed] = useState(false);
  const r = Math.round(size / 2);
  return (
    <Image
      source={failed || !uri ? FALLBACK_AVATAR : { uri }}
      defaultSource={FALLBACK_AVATAR}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: r }}
      resizeMode="cover"
    />
  );
};

const Chip = ({
  label,
  bg,
  fg,
}: {
  label: string;
  bg: string;
  fg: string;
}) => (
  <View style={[styles.chip, { backgroundColor: bg }]}>
    <Text style={[styles.chipText, { color: fg }]} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

/** ⭐️ Stars – accessible & multilingue */
const Stars = ({
  value,
  onChange,
  size,
  color,
  disabled,
}: {
  value: number;
  onChange?: (n: number) => void;
  size: number;
  color: string;
  disabled?: boolean;
}) => {
  const { t } = useTranslation();
  const stars = [1, 2, 3, 4, 5];

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {stars.map((s) => (
        <TouchableOpacity
          key={s}
          activeOpacity={0.85}
          onPress={() => onChange && onChange(s)}
          disabled={disabled || !onChange}
          style={{ marginRight: 4 }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
         accessibilityLabel={t("reviews.starsLabel", { count: s })}
        >
          <Ionicons
            name={s <= value ? "star" : "star-outline"}
            size={size}
            color={color}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
};

/* --------------------------------- Component -------------------------------- */
const ChallengeReviews: React.FC<Props> = ({ challengeId, selectedDays }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { width: W } = useWindowDimensions();

  const isDarkMode = theme === "dark";
  const currentTheme = isDarkMode ? designSystem.darkTheme : designSystem.lightTheme;
  

  const IS_TINY = W < 350;
  const IS_TABLET = W >= 700;

  // Tokens (Keynote-ish, strict)
  const R = useMemo(
    () => ({
      card: IS_TINY ? 16 : 18,
      soft: IS_TINY ? 14 : 16,
      pill: 999,
      pad: IS_TINY ? 14 : 16,
      gap: IS_TINY ? 10 : 12,
    }),
    [IS_TINY]
  );

  const GLASS = useMemo(
    () => ({
      bg: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.035)",
      bg2: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
      stroke: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
      strokeSoft: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
      shadow: "#000",
    }),
    [isDarkMode]
  );

  const ACCENT = useMemo(
    () => ({
      star: isDarkMode ? "#F4D35E" : "#D9A600",
      chipBG: isDarkMode ? "rgba(244,211,94,0.16)" : "rgba(0,0,0,0.06)",
      chipFG: isDarkMode ? "#F4D35E" : "#222",
      borderGradient: isDarkMode
        ? (["rgba(255,255,255,0.12)", "rgba(244,211,94,0.20)"] as const)
        : (["rgba(0,0,0,0.05)", "rgba(0,0,0,0.10)"] as const),
      headerGradient: isDarkMode
        ? (["rgba(255,255,255,0.06)", "rgba(244,211,94,0.12)"] as const)
        : (["rgba(0,0,0,0.035)", "rgba(0,0,0,0.06)"] as const),
    }),
    [isDarkMode]
  );

  const TEXT = useMemo(
  () => ({
    secondary: isDarkMode ? currentTheme.colors.textSecondary : "rgba(0,0,0,0.62)",
  }),
  [isDarkMode, currentTheme.colors.textSecondary]
);


  const INPUT = useMemo(
  () => ({
    text: isDarkMode ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.92)",
    placeholder: isDarkMode ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)",
    bg: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
    stroke: isDarkMode ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)",
  }),
  [isDarkMode]
);


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

  // Edition
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const isEditing = !!editingReviewId;

  const normId = useMemo(() => (challengeId || "").trim(), [challengeId]);

  // cache avatars (userId -> https url)
  const [avatarCache, setAvatarCache] = useState<Record<string, string>>({});
  const resolvingRef = useRef<Set<string>>(new Set());

  const anonymousLabel = t("common.anonymous", { defaultValue: "Anonyme" });
  const daysShort = t("daysShort", { defaultValue: "j" });

  /* ------------------------------ Live reviews ------------------------------ */
  useEffect(() => {
    if (!normId) {
      setReviews([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const qy = query(
      collection(db, "challenges", normId, "reviews"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const list: Review[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            userId: data.userId,
            username: data.username ?? anonymousLabel,
            avatar: data.avatar ?? "",
            daysSelected: Number(data.daysSelected ?? 0),
            text: data.text ?? "",
            createdAt: (data.createdAt as Timestamp) ?? Timestamp.now(),
            rating: clamp(Number(data.rating ?? 5), 1, 5),
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
  }, [normId, anonymousLabel]);

  /* -------------------------- Eligibility / already ------------------------- */
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
          const completedIds: string[] = Array.isArray(u.CompletedChallengeIds)
            ? u.CompletedChallengeIds
            : [];
          const byIds = completedIds.map((x) => (x || "").trim()).includes(normId);

          const legacy: any[] = Array.isArray(u.CompletedChallenges)
            ? u.CompletedChallenges
            : [];
          const byLegacy = legacy.some(
            (c) =>
              (c?.id === normId || c?.challengeId === normId) &&
              (c?.completed === true || c?.status === "completed")
          );

          const current: any[] = Array.isArray(u.CurrentChallenges || u.currentChallenges)
            ? (u.CurrentChallenges || u.currentChallenges)
            : [];
          const currentMatch = current.find(
            (c) => c?.id === normId || c?.challengeId === normId
          );
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
              (legacy.find((c) => c?.id === normId || c?.challengeId === normId)
                ?.selectedDays) ||
              0;
          }
        }

        if (!cancelled) {
          setAlreadyReviewed(!!alreadyDone);
          setCanReview(!!eligible);
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

  /* ------------------------- Avatar resolution/cache ------------------------ */
  useEffect(() => {
    (async () => {
      const needResolveFromReview = reviews
        .filter((r) => {
          if (!r.userId) return false;
          if (avatarCache[r.userId]) return false;
          if (!r.avatar) return false;
          if (resolvingRef.current.has(r.userId)) return false;
          return true;
        })
        .map((r) => ({ userId: r.userId, raw: r.avatar! }));

      const needFromUserDoc = reviews
        .filter((r) => {
          if (!r.userId) return false;
          if (avatarCache[r.userId]) return false;
          return !r.avatar;
        })
        .map((r) => r.userId);

      if (needResolveFromReview.length === 0 && needFromUserDoc.length === 0) return;

      needResolveFromReview.forEach(({ userId }) => resolvingRef.current.add(userId));

      try {
        const fromReview = await Promise.all(
          needResolveFromReview.map(async ({ userId, raw }) => {
            const https = await resolveAvatarUrl(raw);
            return { userId, https };
          })
        );

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

  /* --------------------------------- Actions -------------------------------- */
  const openCreate = useCallback(() => {
    if (!canReview) return;
    setEditingReviewId(null);
    setRating(5);
    setText("");
    setShowModal(true);
  }, [canReview]);

  const openEdit = useCallback(
    (review: Review) => {
      if (review.userId !== currentUserId && currentUserId !== ADMIN_UID) return;
      setEditingReviewId(review.id);
      setRating(review.rating || 5);
      setText(review.text || "");
      setShowModal(true);
    },
    [currentUserId]
  );

  const onDelete = useCallback(
    async (reviewId: string) => {
      Alert.alert(t("challengeDetails.confirmDeleteReview"), "", [
        { text: t("common.cancel", { defaultValue: "Annuler" }), style: "cancel" },
        {
          text: t("common.delete", { defaultValue: "Supprimer" }),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteReview(normId, reviewId);
            } catch (e: any) {
              console.error("delete review error:", e?.message || e);
            }
          },
        },
      ]);
    },
    [normId, t]
  );

  const onSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      return Alert.alert(
        t("oops", { defaultValue: "Oups" }),
        t("writeSomething", { defaultValue: "Écris un petit retour avant d’envoyer 😉" })
      );
    }
    if (trimmed.length > 500) {
      return Alert.alert(
        t("oops", { defaultValue: "Oups" }),
        t("maxChars", { defaultValue: "Max 500 caractères" })
      );
    }

    try {
      setSubmitting(true);

      let username = currentUser?.displayName || anonymousLabel;
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
        const reviewRef = doc(db, "challenges", normId, "reviews", editingReviewId);
        await updateDoc(reviewRef, {
          text: trimmed,
          rating: clamp(rating || 5, 1, 5),
          username,
          avatar,
          updatedAt: serverTimestamp(),
        });

        setReviews((prev) =>
          prev.map((r) =>
            r.id === editingReviewId
              ? { ...r, text: trimmed, rating: clamp(rating || 5, 1, 5), username, avatar }
              : r
          )
        );

        if (avatar) setAvatarCache((p) => ({ ...p, [currentUserId]: avatar }));
        setShowModal(false);
        setEditingReviewId(null);
        setText("");
        return;
      }

      await submitReview(normId, {
        userId: currentUserId,
        username,
        avatar,
        daysSelected: Math.max(0, effectiveDays || 0),
        text: trimmed,
        createdAt: Timestamp.now(),
        rating: clamp(rating || 5, 1, 5),
      });

      if (avatar) setAvatarCache((p) => ({ ...p, [currentUserId]: avatar }));
      setAlreadyReviewed(true);
      setEditingReviewId(null);
      setShowModal(false);
      setText("");
    } catch (e: any) {
      console.error("review submit/update error:", e?.message || e);
      Alert.alert(
        t("error", { defaultValue: "Erreur" }),
        t("cannotSaveReview", { defaultValue: "Impossible d’enregistrer l’avis pour le moment." })
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    text,
    t,
    isEditing,
    editingReviewId,
    currentUser,
    currentUserId,
    normId,
    rating,
    effectiveDays,
    anonymousLabel,
  ]);

  /* --------------------------------- Metrics -------------------------------- */
  const average = useMemo(() => {
    if (!reviews.length) return 0;
    const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
    return Math.round((sum / reviews.length) * 10) / 10;
  }, [reviews]);

  const dist = useMemo(() => {
    // index 1..5
    const out = [0, 0, 0, 0, 0, 0];
    reviews.forEach((r) => {
      const v = clamp(Number(r.rating) || 0, 1, 5);
      out[v] += 1;
    });
    return out;
  }, [reviews]);

  const distMax = useMemo(() => Math.max(1, ...dist.slice(1)), [dist]);

  /* ------------------------------- Render pieces ----------------------------- */
  const ReviewCard = useCallback(
    ({ item: r }: { item: Review }) => {
      const candidate =
        avatarCache[r.userId] ||
        (r.avatar && r.avatar.startsWith("http") ? r.avatar : "");

      const canEditOrDelete =
        (r.userId === currentUserId && !!currentUserId) ||
        (currentUserId === ADMIN_UID && r.userId !== currentUserId);

      const avatarSize = IS_TINY ? 38 : 42;

      return (
        <View style={{ marginBottom: 12 }}>
          <LinearGradient
            colors={ACCENT.borderGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: R.card, padding: 1.2 }}
          >
            <View style={[styles.card, { borderRadius: R.card, padding: R.pad }]}>
              <View style={[styles.row, { marginBottom: 10 }]}>
                <View style={{ marginRight: 12 }}>
                  <ReviewAvatar uri={candidate} size={avatarSize} />
                  <View
                    style={[
                      styles.avatarRing,
                      {
                        width: avatarSize + 8,
                        height: avatarSize + 8,
                        borderRadius: (avatarSize + 8) / 2,
                        borderColor: GLASS.strokeSoft,
                      },
                    ]}
                  />
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: FONT.bold,
                      letterSpacing: 0.2,
                      color: currentTheme.colors.textPrimary,
                      fontSize: IS_TINY ? 14 : 15,
                    }}
                  >
                    {r.username || anonymousLabel}
                  </Text>

                  <View style={[styles.row, { marginTop: 4, flexWrap: "wrap" }]}>
                    <Text
                      style={{
                        color: currentTheme.colors.textSecondary,
                        fontFamily: FONT.regular,
                        marginRight: 10,
                      }}
                    >
                      {formatDate(r.createdAt as Timestamp)}
                    </Text>

                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Stars
                        value={r.rating || 0}
                        size={IS_TINY ? 16 : 17}
                        color={ACCENT.star}
                        disabled
                      />
                    </View>
                  </View>
                </View>

                <Chip
                  label={`${r.daysSelected} ${daysShort}`}
                  bg={ACCENT.chipBG}
                  fg={ACCENT.chipFG}
                />
              </View>

              <Text
                style={{
                  color: currentTheme.colors.textPrimary,
                  lineHeight: 20,
                  opacity: isDarkMode ? 0.95 : 0.92,
                  fontFamily: FONT.regular,
                }}
              >
                {r.text}
              </Text>

              {canEditOrDelete ? (
                <View style={[styles.row, { justifyContent: "flex-end", marginTop: 10 }]}>
                  {r.userId === currentUserId ? (
                    <>
                      <TouchableOpacity
                        onPress={() => openEdit(r)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityRole="button"
                        accessibilityLabel={t("editYourReview")}
                        style={styles.iconBtn}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="create-outline" size={18} color={currentTheme.colors.secondary} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => onDelete(r.id)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityRole="button"
                        accessibilityLabel={t("deleteReview")}
                        style={styles.iconBtn}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="trash-outline" size={18} color="#FF5A6A" />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      onPress={() => onDelete(r.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      accessibilityRole="button"
                      accessibilityLabel={t("deleteReview")}
                      style={styles.iconBtn}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="trash-outline" size={18} color="#FF5A6A" />
                    </TouchableOpacity>
                  )}
                </View>
              ) : null}
            </View>
          </LinearGradient>
        </View>
      );
    },
    [
      ACCENT,
      GLASS.strokeSoft,
      IS_TINY,
      R.card,
      R.pad,
      avatarCache,
      anonymousLabel,
      currentTheme.colors.secondary,
      currentTheme.colors.textPrimary,
      currentTheme.colors.textSecondary,
      daysShort,
      isDarkMode,
      currentUserId,
      openEdit,
      onDelete,
      t,
    ]
  );

  const Header = useMemo(() => {
    const title = t("reviews.title", { defaultValue: "Ce qu’ils ont pensé" });

    const ctaEnabled = canReview && !alreadyReviewed;
    const showInfoLocked = !canReview && !alreadyReviewed;
    const showInfoDone = alreadyReviewed;

    const small = IS_TINY;

    const distRow = (star: number) => {
      const count = dist[star];
      const pct = Math.round((count / Math.max(1, reviews.length)) * 100);
      const fillW = `${Math.round((count / distMax) * 100)}%` as const;

      return (
        <View key={star} style={[styles.distRow, { marginTop: star === 5 ? 0 : 6 }]}>
          <Text style={[styles.distLabel, { color: currentTheme.colors.textSecondary }]}>
            {star}
          </Text>
          <Ionicons name="star" size={12} color={ACCENT.star} style={{ marginRight: 8, marginTop: 1 }} />
          <View style={[styles.distTrack, { backgroundColor: GLASS.bg2, borderColor: GLASS.strokeSoft }]}>
            <View style={[styles.distFill, { width: fillW, backgroundColor: ACCENT.star }]} />
          </View>
          <Text style={[styles.distCount, { color: currentTheme.colors.textSecondary }]}>
            {pct}%
          </Text>
        </View>
      );
    };

    return (
      <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
        {/* CTA */}
        {ctaEnabled ? (
          <TouchableOpacity activeOpacity={0.9} onPress={openCreate} style={{ alignSelf: "center", marginBottom: 14 }}>
            <LinearGradient
              colors={[currentTheme.colors.secondary, currentTheme.colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.cta,
                {
                  paddingVertical: small ? 12 : 14,
                  paddingHorizontal: small ? 18 : 22,
                },
              ]}
            >
              <Ionicons name="create-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={[styles.ctaText, { fontSize: small ? 14 : 15 }]}>
                {t("challengeDetails.leaveReview")}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : null}

        {showInfoLocked ? (
          <Text style={[styles.centerInfo, { color: currentTheme.colors.textSecondary }]}>
            {t("challengeDetails.reviewAfterComplete")}
          </Text>
        ) : null}

        {showInfoDone ? (
          <Text style={[styles.centerInfo, { color: currentTheme.colors.textSecondary }]}>
            {t("challengeDetails.alreadyReviewed")}
          </Text>
        ) : null}

        {/* Premium header card */}
        <LinearGradient
          colors={ACCENT.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.headerWrap,
            {
              borderRadius: R.soft,
              borderColor: GLASS.strokeSoft,
              paddingVertical: small ? 12 : 14,
              paddingHorizontal: small ? 12 : 14,
            },
          ]}
        >
          <View style={[styles.row, { justifyContent: "space-between" }]}>
            <View style={[styles.row, { flex: 1, minWidth: 0 }]}>
              <View style={[styles.badgeIcon, { backgroundColor: GLASS.bg, borderColor: GLASS.strokeSoft }]}>
                <Ionicons name="chatbubbles-outline" size={16} color={currentTheme.colors.secondary} />
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: small ? 16 : 18,
                    fontFamily: FONT.bold,
                    letterSpacing: 0.2,
                    color: currentTheme.colors.textPrimary,
                  }}
                >
                  {title}
                </Text>

                <Text
                  numberOfLines={2}
                  style={{
                    marginTop: 2,
                    fontSize: 12,
                    color: currentTheme.colors.textSecondary,
                    fontFamily: FONT.regular,
                  }}
                >
                  {t("challengeDetails.reviewsSubtitle", {
                    defaultValue: "Des retours réels, pour choisir et progresser plus vite.",
                  })}
                </Text>
              </View>
            </View>

            <View style={{ alignItems: "flex-end", marginLeft: 10 }}>
              {loading ? (
                <ActivityIndicator size="small" color={currentTheme.colors.primary} />
              ) : reviews.length ? (
                <>
                  <View style={[styles.row, { alignItems: "center" }]}>
                    <Text
                      style={{
                        fontSize: small ? 18 : 20,
                        fontFamily: FONT.bold,
                        color: currentTheme.colors.textPrimary,
                        marginRight: 8,
                      }}
                    >
                      {average.toFixed(1)}
                    </Text>
                    <Stars
                      value={Math.round(average)}
                      size={small ? 14 : 15}
                      color={ACCENT.star}
                      disabled
                    />
                  </View>
                  <Text style={{ marginTop: 2, fontFamily: FONT.bold, color: currentTheme.colors.textSecondary }}>
                    {reviews.length}
                  </Text>
                </>
              ) : (
                <Text style={{ fontFamily: FONT.bold, color: currentTheme.colors.textSecondary }}>
                  {t("challengeDetails.noReviewsStats", { defaultValue: "0 · 0" })}
                </Text>
              )}
            </View>
          </View>

          {/* Breakdown */}
          {!loading && reviews.length > 0 ? (
            <View style={{ marginTop: 12 }}>
              {([5, 4, 3, 2, 1] as const).map(distRow)}
            </View>
          ) : null}
        </LinearGradient>

        {/* List header */}
        <View style={{ height: 10 }} />
      </View>
    );
  }, [
    ACCENT.headerGradient,
    ACCENT.star,
    GLASS.bg,
    GLASS.bg2,
    GLASS.strokeSoft,
    IS_TINY,
    R.soft,
    alreadyReviewed,
    average,
    canReview,
    currentTheme.colors.primary,
    currentTheme.colors.secondary,
    currentTheme.colors.textPrimary,
    currentTheme.colors.textSecondary,
    dist,
    distMax,
    loading,
    openCreate,
    reviews.length,
    t,
  ]);

  /* ---------------------------------- Empty --------------------------------- */
  const Empty = useMemo(() => {
    if (loading) return null;
    return (
      <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 16 }}>
        <LinearGradient
          colors={ACCENT.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.emptyCard,
            { borderRadius: R.soft, borderColor: GLASS.strokeSoft, padding: R.pad },
          ]}
        >
          <View style={[styles.row, { marginBottom: 8 }]}>
            <View style={[styles.badgeIcon, { backgroundColor: GLASS.bg, borderColor: GLASS.strokeSoft }]}>
              <Ionicons name="sparkles-outline" size={16} color={currentTheme.colors.secondary} />
            </View>
            <Text style={{ fontFamily: FONT.bold, color: currentTheme.colors.textPrimary, flex: 1 }}>
              {t("challengeDetails.noReviewsYet")}
            </Text>
          </View>

          <Text style={{ color: currentTheme.colors.textSecondary, lineHeight: 18, fontFamily: FONT.regular }}>
            {t("challengeDetails.noReviewsHint", {
              defaultValue: "Sois le premier à laisser un retour utile. 10 secondes, impact réel.",
            })}
          </Text>

          {canReview && !alreadyReviewed ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={openCreate}
              style={{ marginTop: 12, alignSelf: "flex-start" }}
            >
              <LinearGradient
                colors={[currentTheme.colors.primary, currentTheme.colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.miniCta, { borderRadius: 14 }]}
              >
                <Ionicons name="create-outline" size={16} color="#fff" style={{ marginRight: 8 }} />
                <Text style={{ color: "#fff", fontFamily: FONT.bold }}>
                  {t("challengeDetails.leaveReview")}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : null}
        </LinearGradient>
      </View>
    );
  }, [
    loading,
    ACCENT.headerGradient,
    GLASS.bg,
    GLASS.strokeSoft,
    R.soft,
    R.pad,
    currentTheme.colors.secondary,
    currentTheme.colors.textPrimary,
    currentTheme.colors.textSecondary,
    currentTheme.colors.primary,
    t,
    canReview,
    alreadyReviewed,
    openCreate,
  ]);

  /* ---------------------------------- Modal --------------------------------- */
  const closeModal = useCallback(() => {
    if (submitting) return;
    setShowModal(false);
  }, [submitting]);

  const modalTitle = isEditing ? t("editYourReview") : t("challengeDetails.yourReview");

  const modalMaxW = useMemo(
    () => Math.min(W - 32, IS_TABLET ? 540 : 520),
    [W, IS_TABLET]
  );

  return (
    <View style={{ marginTop: 22, paddingBottom: 10 }}>
      {/* Header */}
      {Header}

      {/* Empty */}
      {!loading && reviews.length === 0 ? Empty : null}

      {/* Reviews */}
      {reviews.length > 0 ? (
        <View style={{ paddingHorizontal: 16 }}>
          {reviews.map((r) => (
            <View key={r.id}>{/* keep spacing consistent */}
              <LinearGradient
                colors={ACCENT.borderGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ borderRadius: R.card, padding: 1.2, marginBottom: 12 }}
              >
                {/* We reuse the exact card UI by calling the same markup as ReviewCard would render */}
                {/* But without nesting any VirtualizedList */}
                <View style={[styles.card, { borderRadius: R.card, padding: R.pad }]}>
                  <View style={[styles.row, { marginBottom: 10 }]}>
                    <View style={{ marginRight: 12 }}>
                      <ReviewAvatar
                        uri={
                          avatarCache[r.userId] ||
                          (r.avatar && r.avatar.startsWith("http") ? r.avatar : "")
                        }
                        size={IS_TINY ? 38 : 42}
                      />
                      <View
                        style={[
                          styles.avatarRing,
                          {
                            width: (IS_TINY ? 38 : 42) + 8,
                            height: (IS_TINY ? 38 : 42) + 8,
                            borderRadius: ((IS_TINY ? 38 : 42) + 8) / 2,
                            borderColor: GLASS.strokeSoft,
                          },
                        ]}
                      />
                    </View>

                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          fontFamily: FONT.bold,
                          letterSpacing: 0.2,
                          color: currentTheme.colors.textPrimary,
                          fontSize: IS_TINY ? 14 : 15,
                        }}
                      >
                        {r.username || anonymousLabel}
                      </Text>

                      <View style={[styles.row, { marginTop: 4, flexWrap: "wrap" }]}>
                        <Text
                          style={{
                            color: currentTheme.colors.textSecondary,
                            fontFamily: FONT.regular,
                            marginRight: 10,
                          }}
                        >
                          {formatDate(r.createdAt as Timestamp)}
                        </Text>

                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <Stars
                            value={r.rating || 0}
                            size={IS_TINY ? 16 : 17}
                            color={ACCENT.star}
                            disabled
                          />
                        </View>
                      </View>
                    </View>

                    <Chip
                      label={`${r.daysSelected} ${daysShort}`}
                      bg={ACCENT.chipBG}
                      fg={ACCENT.chipFG}
                    />
                  </View>

                  <Text
                    style={{
                      color: currentTheme.colors.textPrimary,
                      lineHeight: 20,
                      opacity: isDarkMode ? 0.95 : 0.92,
                      fontFamily: FONT.regular,
                    }}
                  >
                    {r.text}
                  </Text>

                  {/* Actions */}
                  {(() => {
                    const canEditOrDelete =
                      (r.userId === currentUserId && !!currentUserId) ||
                      (currentUserId === ADMIN_UID && r.userId !== currentUserId);

                    if (!canEditOrDelete) return null;

                    return (
                      <View
                        style={[
                          styles.row,
                          { justifyContent: "flex-end", marginTop: 10 },
                        ]}
                      >
                        {r.userId === currentUserId ? (
                          <>
                            <TouchableOpacity
                              onPress={() => openEdit(r)}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              accessibilityRole="button"
                              accessibilityLabel={t("editYourReview")}
                              style={styles.iconBtn}
                              activeOpacity={0.8}
                            >
                              <Ionicons
                                name="create-outline"
                                size={18}
                                color={currentTheme.colors.secondary}
                              />
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => onDelete(r.id)}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              accessibilityRole="button"
                              accessibilityLabel={t("deleteReview")}
                              style={styles.iconBtn}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="trash-outline" size={18} color="#FF5A6A" />
                            </TouchableOpacity>
                          </>
                        ) : (
                          <TouchableOpacity
                            onPress={() => onDelete(r.id)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            accessibilityRole="button"
                            accessibilityLabel={t("deleteReview")}
                            style={styles.iconBtn}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="trash-outline" size={18} color="#FF5A6A" />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })()}
                </View>
              </LinearGradient>
            </View>
          ))}
        </View>
      ) : null}

      {/* Modal */}
      <Modal
        visible={showModal}
        animationType="fade"
        transparent
        onRequestClose={closeModal}
      >
        <Pressable
          style={[
            styles.backdrop,
            {
              backgroundColor: isDarkMode
                ? "rgba(0,0,0,0.62)"
                : "rgba(0,0,0,0.45)",
            },
          ]}
          onPress={closeModal}
        />

        <KeyboardAvoidingView
          behavior={Platform.select({ ios: "padding", android: undefined })}
          style={styles.modalWrap}
        >
          <View
            style={[
              styles.modalCard,
              {
                width: modalMaxW,
                backgroundColor: currentTheme.colors.background,
                borderColor: GLASS.stroke,
                borderRadius: 22,
                shadowColor: GLASS.shadow,
              },
            ]}
          >
            <View
              style={[
                styles.row,
                { justifyContent: "space-between", marginBottom: 10 },
              ]}
            >
              <View style={[styles.row, { flex: 1, minWidth: 0 }]}>
                <View
                  style={[
                    styles.badgeIcon,
                    { backgroundColor: GLASS.bg, borderColor: GLASS.strokeSoft },
                  ]}
                >
                  <Ionicons
                    name="create-outline"
                    size={16}
                    color={currentTheme.colors.secondary}
                  />
                </View>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: FONT.bold,
                    fontSize: 16,
                    color: currentTheme.colors.textPrimary,
                    flex: 1,
                  }}
                >
                  {modalTitle}
                </Text>
              </View>

              <TouchableOpacity
                onPress={closeModal}
                disabled={submitting}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel={t("common.close", { defaultValue: "Fermer" })}
                style={[
                  styles.closeBtn,
                  { borderColor: GLASS.strokeSoft, backgroundColor: GLASS.bg },
                ]}
              >
                <Ionicons name="close" size={18} color={currentTheme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={{ marginBottom: 12 }}>
              <Stars value={rating} onChange={setRating} size={28} color={ACCENT.star} />
            </View>

            <TextInput
              multiline
              value={text}
              onChangeText={setText}
              placeholder={t("challengeDetails.reviewPlaceholder")}
              maxLength={500}
              placeholderTextColor={INPUT.placeholder}
              selectionColor={ACCENT.star}
              style={[
                styles.textarea,
                {
                  backgroundColor: INPUT.bg,
                  color: INPUT.text,
                  borderColor: INPUT.stroke,
                },
              ]}
            />

            <View style={[styles.row, { justifyContent: "space-between", marginTop: 8 }]}>
              <Text
                style={{
                  color: currentTheme.colors.textSecondary,
                  fontSize: 12,
                  fontFamily: FONT.regular,
                }}
              >
                {t("challengeDetails.reviewPrivacy", {
                  defaultValue: "Reste utile, clair, et bienveillant.",
                })}
              </Text>

              <Text
                style={{
                  color: currentTheme.colors.textSecondary,
                  fontSize: 12,
                  fontFamily: FONT.regular,
                }}
              >
                {text.length}/500
              </Text>
            </View>

            <View style={[styles.row, { justifyContent: "flex-end", marginTop: 14 }]}>
              <TouchableOpacity
                onPress={closeModal}
                disabled={submitting}
                style={[styles.secondaryBtn, { borderColor: GLASS.strokeSoft }]}
                activeOpacity={0.85}
              >
                <Text style={{ color: currentTheme.colors.textSecondary, fontFamily: FONT.bold }}>
                  {t("common.cancel", { defaultValue: "Annuler" })}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={submitting ? undefined : onSubmit}
                activeOpacity={0.85}
                style={{ marginLeft: 10 }}
              >
                <LinearGradient
                  colors={[currentTheme.colors.primary, currentTheme.colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryBtn}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{ color: "#fff", fontFamily: FONT.bold }}>
                      {isEditing ? t("saveReview") : t("challengeDetails.submitReview")}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
    );
};
type Styles = {
  row: ViewStyle;

  chip: ViewStyle;
  chipText: TextStyle;

  headerWrap: ViewStyle;

  badgeIcon: ViewStyle;

  cta: ViewStyle;
  ctaText: TextStyle;

  centerInfo: TextStyle;

  distRow: ViewStyle;
  distLabel: TextStyle;
  distTrack: ViewStyle;
  distFill: ViewStyle;
  distCount: TextStyle;

  emptyCard: ViewStyle;
  miniCta: ViewStyle;

  card: ViewStyle;

  avatarRing: ViewStyle;

  iconBtn: ViewStyle;

  backdrop: ViewStyle;
  modalWrap: ViewStyle;
  modalCard: ViewStyle;
  closeBtn: ViewStyle;

  textarea: TextStyle;

  secondaryBtn: ViewStyle;
  primaryBtn: ViewStyle;
};

const styles = StyleSheet.create<Styles>({
  row: { flexDirection: "row", alignItems: "center" },

  chip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    maxWidth: 84,
  },
  chipText: { fontFamily: FONT.bold, fontSize: 12 },

  headerWrap: {
    borderWidth: StyleSheet.hairlineWidth,
  },

  badgeIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 10,
  },

  cta: {
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 8,
  },
  ctaText: { color: "#fff", fontFamily: FONT.bold },

  centerInfo: {
    textAlign: "center",
    marginBottom: 12,
    fontSize: 13,
    fontFamily: FONT.regular,
  },

  distRow: { flexDirection: "row", alignItems: "center" },
  distLabel: {
    width: 14,
    textAlign: "right",
    fontFamily: FONT.bold,
    marginRight: 6,
    fontSize: 12,
  },
  distTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  distFill: { height: "100%", borderRadius: 999 },
  distCount: {
    width: 42,
    textAlign: "right",
    fontFamily: FONT.bold,
    fontSize: 12,
    marginLeft: 8,
  },

  emptyCard: { borderWidth: StyleSheet.hairlineWidth },
  miniCta: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  card: {
    backgroundColor: "transparent",
  },

  avatarRing: {
    position: "absolute",
    left: -4,
    top: -4,
    borderWidth: StyleSheet.hairlineWidth,
  },

  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },

  modalWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  modalCard: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 26,
    elevation: 10,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },

  textarea: {
    height: 130,
    borderRadius: 14,
    padding: 12,
    textAlignVertical: "top",
    borderWidth: 1,
    fontFamily: FONT.regular,
  },

  secondaryBtn: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  primaryBtn: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 14,
    minWidth: 132,
    alignItems: "center",
    justifyContent: "center",
  },
});


export default ChallengeReviews;
