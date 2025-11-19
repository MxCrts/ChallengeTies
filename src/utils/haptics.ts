// src/utils/haptics.ts
import * as Haptics from "expo-haptics";

const safe = async (fn: () => Promise<void>) => {
  try { await fn(); } catch {}
};

export const tap = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
export const success = () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
export const warning = () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
export const error = () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
export const soft = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft));
export const medium = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
