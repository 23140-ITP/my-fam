import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Avatar } from "@/src/components/Avatar";
import { colors, font, radius, spacing } from "@/src/constants/theme";
import { useTts } from "@/src/hooks/useTts";
import { haptic } from "@/src/lib/haptics";

const CONFIG = {
  mom: {
    voices: [
      { id: "coral", label: "Coral" },
      { id: "shimmer", label: "Shimmer" },
      { id: "nova", label: "Nova" },
      { id: "sage", label: "Sage" },
    ],
    warmth: [
      { id: "gentle", label: "Extra gentle" },
      { id: "balanced", label: "Balanced" },
      { id: "firm", label: "Firm & caring" },
    ],
    sample: "Hi sweetheart, I'm so proud of you.",
    accent: colors.momDeep,
    fallback: "Mom",
  },
  dad: {
    voices: [
      { id: "onyx", label: "Onyx" },
      { id: "ash", label: "Ash" },
      { id: "echo", label: "Echo" },
      { id: "ballad", label: "Ballad" },
    ],
    warmth: [
      { id: "gentle", label: "Softer" },
      { id: "balanced", label: "Balanced" },
      { id: "firm", label: "Tough love" },
    ],
    sample: "Hey kiddo, you've got this.",
    accent: colors.dadDeep,
    fallback: "Dad",
  },
} as const;

export function ParentSettings({
  persona,
  name,
  warmth,
  voice,
  onChange,
}: {
  persona: "mom" | "dad";
  name: string;
  warmth: string;
  voice: string;
  onChange: (partial: Record<string, string>) => void;
}) {
  const cfg = CONFIG[persona];
  const tts = useTts();
  const [draft, setDraft] = useState(name);

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <Avatar persona={persona} size={40} initial={(draft[0] || cfg.fallback[0]).toUpperCase()} />
        <Text style={styles.title}>{draft || cfg.fallback}</Text>
      </View>

      <Text style={styles.label}>Name</Text>
      <TextInput
        testID={`parent-name-${persona}`}
        style={styles.input}
        value={draft}
        onChangeText={setDraft}
        onEndEditing={() => onChange({ [`${persona}_name`]: draft.trim() || cfg.fallback })}
        onSubmitEditing={() => onChange({ [`${persona}_name`]: draft.trim() || cfg.fallback })}
        placeholder={cfg.fallback}
        placeholderTextColor={colors.textFaint}
        maxLength={20}
        returnKeyType="done"
      />

      <Text style={styles.label}>Warmth</Text>
      <View style={styles.seg}>
        {cfg.warmth.map((w) => {
          const active = warmth === w.id;
          return (
            <Pressable
              key={w.id}
              testID={`warmth-${persona}-${w.id}`}
              style={[styles.segItem, active && { backgroundColor: cfg.accent }]}
              onPress={() => {
                haptic.select();
                onChange({ [`${persona}_warmth`]: w.id });
              }}
            >
              <Text style={[styles.segText, active && styles.segTextActive]}>{w.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Voice</Text>
      <View style={styles.voices}>
        {cfg.voices.map((v) => {
          const active = voice === v.id;
          return (
            <Pressable
              key={v.id}
              testID={`voice-${persona}-${v.id}`}
              style={[styles.voiceChip, active && { borderColor: cfg.accent }]}
              onPress={() => {
                haptic.select();
                onChange({ [`${persona}_voice`]: v.id });
                tts.speak(persona, cfg.sample, v.id);
              }}
            >
              <Ionicons
                name={active ? "volume-high" : "play"}
                size={13}
                color={active ? cfg.accent : colors.textMuted}
              />
              <Text style={[styles.voiceText, active && { color: cfg.accent }]}>{v.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>Tap a voice to hear a quick preview.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg },
  headRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  title: { fontFamily: font.bold, fontSize: 17, color: colors.text },
  label: { fontFamily: font.semibold, fontSize: 12.5, color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.sm },
  input: {
    height: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: font.semibold,
    fontSize: 15,
    color: colors.text,
  },
  seg: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.md, padding: 3, gap: 3 },
  segItem: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: "center" },
  segText: { fontFamily: font.semibold, fontSize: 12.5, color: colors.textMuted },
  segTextActive: { color: colors.white },
  voices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  voiceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  voiceText: { fontFamily: font.semibold, fontSize: 13, color: colors.textMuted },
  hint: { fontFamily: font.regular, fontSize: 11.5, color: colors.textFaint, marginTop: spacing.sm },
});
