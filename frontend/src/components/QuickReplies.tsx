import React from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { colors, font, radius, spacing } from "@/src/constants/theme";
import { haptic } from "@/src/lib/haptics";

export function QuickReplies({
  options,
  onSelect,
}: {
  options: string[];
  onSelect: (text: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.row}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {options.map((opt) => (
        <Pressable
          key={opt}
          testID={`quick-reply-${opt}`}
          style={styles.chip}
          onPress={() => {
            haptic.select();
            onSelect(opt);
          }}
        >
          <Text style={styles.chipText} numberOfLines={1}>
            {opt}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { maxHeight: 56, flexGrow: 0 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: "center", paddingVertical: spacing.sm },
  chip: {
    flexShrink: 0,
    height: 36,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { fontFamily: font.medium, fontSize: 13.5, color: colors.brand },
});
