// components/InventorySection.tsx
import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PixelRatio,
  Dimensions,
  ActivityIndicator,
  I18nManager,
  AccessibilityRole,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import designSystem, { Theme } from "../theme/designSystem";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const normalize = (size: number) => {
  const baseWidth = 375;
  const scale = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), 1.8);
  const normalizedSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(normalizedSize));
};

type UserInventory = {
  streakPass?: number;
  // futur : xpBoost?: number; superPass?: number; etc.
  [key: string]: number | undefined;
};

type InventorySectionProps = {
  userData?: {
    inventory?: UserInventory;
  } | null;
  loading?: boolean;
  onPressItem?: (key: string) => void;
};

type InventoryItem = {
  key: string;
  count: number;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  accentColor: string;
};

const InventorySection: React.FC<InventorySectionProps> = ({
  userData,
  loading = false,
  onPressItem,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const currentTheme: Theme = isDark
    ? designSystem.darkTheme
    : designSystem.lightTheme;

  const inventory: UserInventory = (userData?.inventory ?? {}) as UserInventory;

  const items: InventoryItem[] = useMemo(() => {
    const result: InventoryItem[] = [];

    const streakPassCount =
      typeof inventory.streakPass === "number" ? inventory.streakPass : 0;

    if (streakPassCount > 0) {
      result.push({
        key: "streakPass",
        count: streakPassCount,
        icon: "shield-checkmark",
        title: t("inventory.items.streakPass.title", "Streak Pass"),
        subtitle: t(
          "inventory.items.streakPass.subtitle",
          "Protège ta série une fois en cas de défi manqué."
        ),
        accentColor: "#FFD54F",
      });
    }

    // 👉 futur : mapper ici d'autres items (xpBoost, superPass, etc.)

    return result;
  }, [inventory, t]);

  const hasItems = items.length > 0;

  const totalCount = useMemo(
    () => items.reduce((sum, it) => sum + (it.count || 0), 0),
    [items]
  );

  const containerRole: AccessibilityRole = "summary";

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark
            ? "rgba(10,10,18,0.9)"
            : "rgba(255,255,255,0.96)",
          borderColor: isDark
            ? "rgba(255,255,255,0.06)"
            : "rgba(0,0,0,0.05)",
        },
      ]}
      accessibilityRole={containerRole}
      accessibilityLabel={t("inventory.title", "Inventaire")}
      accessibilityHint={t("inventory.subtitle", "Gère ici tes bonus spéciaux et protections de série.")}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Ionicons
            name="briefcase-outline"
            size={normalize(20)}
            color={currentTheme.colors.secondary}
          />
          <Text
            style={[
              styles.title,
              { color: currentTheme.colors.textPrimary },
            ]}
          >
            {t("inventory.title", "Inventaire")}
          </Text>
        </View>

        {hasItems && (
          <View
            style={[
              styles.pill,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.04)",
              },
            ]}
          >
            <Ionicons
              name="sparkles"
              size={normalize(14)}
              color={currentTheme.colors.secondary}
            />
            <Text
              style={[
                styles.pillText,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {t("inventory.totalItems", {
                defaultValue: "{{count}} objets",
                count: totalCount,
              })}
            </Text>
          </View>
        )}
      </View>

      {/* Subheader */}
      <Text
        style={[
          styles.subtitle,
          { color: currentTheme.colors.textSecondary },
        ]}
      >
        {t(
          "inventory.subtitle",
          "Gère ici tes bonus spéciaux et protections de série."
        )}
      </Text>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={currentTheme.colors.secondary} />
          <Text
            style={[
              styles.loadingText,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            {t("common.loading", "Chargement...")}
          </Text>
        </View>
      ) : hasItems ? (
        <View style={styles.list}>
          {items.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.itemCard,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.02)"
                    : "rgba(0,0,0,0.02)",
                  borderColor: isDark
                    ? "rgba(255,255,255,0.10)"
                    : "rgba(0,0,0,0.06)",
                },
              ]}
              activeOpacity={0.85}
              onPress={() => onPressItem?.(item.key)}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              accessibilityHint={t(
                "inventory.itemHint",
                "Voir plus d'informations sur cet objet."
              )}
            >
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: item.accentColor },
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={normalize(18)}
                  color="#1A1A1A"
                />
              </View>

              <View style={styles.itemTextZone}>
                <View style={styles.itemTitleRow}>
                  <Text
                    style={[
                      styles.itemTitle,
                      { color: currentTheme.colors.textPrimary },
                    ]}
                  >
                    {item.title}
                  </Text>
                  <View style={styles.badgeCount}>
                    <Text style={styles.badgeCountText}>×{item.count}</Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.itemSubtitle,
                    { color: currentTheme.colors.textSecondary },
                  ]}
                  numberOfLines={2}
                >
                  {item.subtitle}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          {/* Petit hint sur le streak pass */}
          <View
            style={[
              styles.helperBox,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.03)"
                  : "rgba(0,0,0,0.02)",
              },
            ]}
          >
            <Ionicons
              name="information-circle-outline"
              size={normalize(16)}
              color={currentTheme.colors.secondary}
            />
            <Text
              style={[
                styles.helperText,
                { color: currentTheme.colors.textSecondary },
              ]}
            >
              {t(
                "inventory.streakHint",
                "Tu peux utiliser tes Streak Pass dans l'écran d'un défi manqué pour sauver ta série."
              )}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons
            name="cloud-outline"
            size={normalize(24)}
            color={currentTheme.colors.textSecondary}
          />
          <Text
            style={[
              styles.emptyTitle,
              { color: currentTheme.colors.textPrimary },
            ]}
          >
            {t("inventory.emptyTitle", "Aucun bonus pour l’instant")}
          </Text>
          <Text
            style={[
              styles.emptyText,
              { color: currentTheme.colors.textSecondary },
            ]}
          >
            {t(
              "inventory.emptyText",
              "Complète des défis et tourne la roue du jour pour remplir ton inventaire."
            )}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: normalize(16),
    marginTop: normalize(12),
    marginBottom: normalize(6),
    paddingHorizontal: normalize(14),
    paddingVertical: normalize(12),
    borderRadius: normalize(18),
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: normalize(4),
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: normalize(6),
  },
  title: {
    fontSize: normalize(16),
    fontFamily: "Comfortaa_700Bold",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
  subtitle: {
    fontSize: normalize(12),
    fontFamily: "Comfortaa_400Regular",
    marginBottom: normalize(8),
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: normalize(10),
    paddingVertical: normalize(4),
    columnGap: normalize(4),
  },
  pillText: {
    fontSize: normalize(11),
    fontFamily: "Comfortaa_400Regular",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
  list: {
    marginTop: normalize(4),
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: normalize(10),
    paddingHorizontal: normalize(10),
    borderRadius: normalize(14),
    borderWidth: 1,
    marginBottom: normalize(8),
  },
  iconCircle: {
    width: normalize(32),
    height: normalize(32),
    borderRadius: normalize(16),
    alignItems: "center",
    justifyContent: "center",
    marginRight: normalize(10),
  },
  itemTextZone: {
    flex: 1,
  },
  itemTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: normalize(2),
  },
  itemTitle: {
    flex: 1,
    fontSize: normalize(14),
    fontFamily: "Comfortaa_700Bold",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
  badgeCount: {
    borderRadius: 999,
    paddingHorizontal: normalize(8),
    paddingVertical: normalize(2),
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  badgeCountText: {
    fontSize: normalize(11),
    fontFamily: "Comfortaa_700Bold",
    color: "#FFD54F",
  },
  itemSubtitle: {
    fontSize: normalize(11),
    fontFamily: "Comfortaa_400Regular",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
  helperBox: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: normalize(6),
    paddingHorizontal: normalize(10),
    paddingVertical: normalize(6),
    borderRadius: normalize(12),
    marginTop: normalize(4),
  },
  helperText: {
    flex: 1,
    fontSize: normalize(11),
    fontFamily: "Comfortaa_400Regular",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: normalize(10),
  },
  emptyTitle: {
    fontSize: normalize(14),
    fontFamily: "Comfortaa_700Bold",
    marginTop: normalize(6),
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
  emptyText: {
    fontSize: normalize(12),
    fontFamily: "Comfortaa_400Regular",
    marginTop: normalize(2),
    textAlign: "center",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: normalize(8),
    paddingVertical: normalize(6),
  },
  loadingText: {
    fontSize: normalize(12),
    fontFamily: "Comfortaa_400Regular",
    writingDirection: I18nManager.isRTL ? "rtl" : "ltr",
   textAlign: I18nManager.isRTL ? "right" : "left",
  },
});

export default React.memo(InventorySection);
