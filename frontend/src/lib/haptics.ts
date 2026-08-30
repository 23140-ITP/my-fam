import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

import { storage } from "@/src/utils/storage";

const KEY = "haptics_enabled";
let enabled = true;

export async function loadHaptics() {
  const v = await storage.getItem<boolean>(KEY, true);
  enabled = v !== false;
  return enabled;
}

export function isHapticsEnabled() {
  return enabled;
}

export async function setHapticsEnabled(v: boolean) {
  enabled = v;
  await storage.setItem(KEY, v);
}

const on = () => enabled && Platform.OS !== "web";

export const haptic = {
  light: () => on() && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => on() && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  success: () => on() && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  select: () => on() && Haptics.selectionAsync(),
};
