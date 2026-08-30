import React from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { colors, font, radius, shadow, spacing } from "@/src/constants/theme";
import { GlassSurface } from "@/src/components/GlassSurface";

const EMOJIS = ["❤️", "😂", "🥹", "👍", "😮", "😢"];
const BAR_HEIGHT = 60;

type Layout = { x: number; y: number; width: number; height: number };

export function ReactionPicker({
  layout,
  current,
  saved,
  onPick,
  onToggleSave,
  onClose,
}: {
  layout: Layout;
  current?: string;
  saved: boolean;
  onPick: (emoji: string) => void;
  onToggleSave: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = Dimensions.get("window");
  const placeAbove = layout.y > height * 0.45;
  let top = placeAbove ? layout.y - BAR_HEIGHT - 10 : layout.y + layout.height + 10;
  top = Math.max(insets.top + 8, Math.min(top, height - 180));

  return (
    <Pressable style={styles.backdrop} onPress={onClose} testID="reaction-backdrop">
      <View style={[styles.wrapper, { top }]} pointerEvents="box-none">
        <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.barShell}>
          <GlassSurface
            style={[styles.bar, shadow]}
            contentStyle={styles.barContent}
            tintColor={colors.glassStrong}
            intensity={70}
            interactive
          >
          {EMOJIS.map((e) => (
            <Pressable
              key={e}
              testID={`reaction-pick-${e}`}
              onPress={() => onPick(e)}
              style={[styles.emojiBtn, current === e && styles.emojiActive]}
              hitSlop={4}
            >
              <Text style={styles.emoji}>{e}</Text>
            </Pressable>
          ))}
          <View style={styles.sep} />
          <Pressable testID="reaction-save" onPress={onToggleSave} style={styles.saveBtn} hitSlop={4}>
            <Ionicons
              name={saved ? "bookmark" : "bookmark-outline"}
              size={20}
              color={saved ? colors.brand : colors.textMuted}
            />
          </Pressable>
          </GlassSurface>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(31,42,38,0.12)", zIndex: 50 },
  wrapper: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  barShell: { borderRadius: radius.pill },
  bar: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  barContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  emojiBtn: { width: 40, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  emojiActive: { backgroundColor: colors.brandSoft },
  emoji: { fontSize: 24 },
  sep: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: colors.border, marginHorizontal: 2 },
  saveBtn: { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
});
