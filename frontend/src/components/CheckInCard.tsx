import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";

import { Avatar } from "@/src/components/Avatar";
import { colors, font, radius, shadow, spacing } from "@/src/constants/theme";
import type { Checkin } from "@/src/lib/api";

type Action = "sleptWell" | "rough" | "ate" | undefined;

const CHIPS: { label: string; action: Action; response: string }[] = [
  { label: "Slept well 🌙", action: "sleptWell", response: "I slept well" },
  { label: "Rough night", action: "rough", response: "Rough night" },
  { label: "Just ate 🍲", action: "ate", response: "Just ate" },
  { label: "I'm okay 💛", action: undefined, response: "I'm okay" },
];

export function CheckInCard({
  checkin,
  onRespond,
}: {
  checkin: Checkin;
  onRespond: (text: string, action?: Action) => void;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(360)}
      exiting={FadeOut.duration(200)}
      style={[styles.card, shadow]}
      testID="checkin-card"
    >
      <View style={styles.head}>
        <Text style={styles.title}>Family check-in</Text>
        <View style={styles.liveDot} />
      </View>

      <View style={styles.msgRow}>
        <Avatar persona="mom" size={28} />
        <View style={[styles.bubble, { backgroundColor: colors.momSoft }]}>
          <Text style={[styles.who, { color: colors.momDeep }]}>{checkin.mom_name}</Text>
          <Text style={styles.msg}>{checkin.mom_prompt}</Text>
        </View>
      </View>

      <View style={styles.msgRow}>
        <Avatar persona="dad" size={28} />
        <View style={[styles.bubble, { backgroundColor: colors.dadSoft }]}>
          <Text style={[styles.who, { color: colors.dadDeep }]}>{checkin.dad_name}</Text>
          <Text style={styles.msg}>{checkin.dad_prompt}</Text>
        </View>
      </View>

      <View style={styles.chips}>
        {CHIPS.map((c) => (
          <Pressable
            key={c.label}
            testID={`checkin-chip-${c.response}`}
            style={styles.chip}
            onPress={() => onRespond(c.response, c.action)}
          >
            <Text style={styles.chipText}>{c.label}</Text>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  title: { fontFamily: font.bold, fontSize: 16, color: colors.text },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, marginBottom: spacing.sm },
  bubble: { flex: 1, borderRadius: radius.lg, borderBottomLeftRadius: radius.sm, paddingVertical: 8, paddingHorizontal: spacing.md },
  who: { fontFamily: font.bold, fontSize: 11.5, marginBottom: 1 },
  msg: { fontFamily: font.regular, fontSize: 14, color: colors.text, lineHeight: 19 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { fontFamily: font.semibold, fontSize: 13, color: colors.brand },
});
