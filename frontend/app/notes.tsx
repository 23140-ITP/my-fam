import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { PERSONAS, colors, font, formatTime, radius, spacing } from "@/src/constants/theme";
import { api, Note } from "@/src/lib/api";
import { useFamily } from "@/src/store/family";
import { haptic } from "@/src/lib/haptics";

export default function NotesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { nameFor } = useFamily();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await api.notes();
      setNotes(r.notes);
    } catch {
      /* keep */
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const remove = async (id: string) => {
    haptic.light();
    setNotes((n) => n.filter((x) => x.id !== id));
    try {
      await api.deleteNote(id);
    } catch {
      /* ignore */
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable testID="notes-back" onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.brand} />
        </Pressable>
        <Text style={styles.headerTitle}>Notes from home</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sub}>Little words from Mom &amp; Dad, kept for whenever you need them.</Text>

        {notes.length === 0 && !loading ? (
          <View style={styles.empty}>
            <Ionicons name="heart-outline" size={42} color={colors.borderStrong} />
            <Text style={styles.emptyTitle}>No keepsakes yet</Text>
            <Text style={styles.emptyText}>
              Press and hold any message from {nameFor("mom")} or {nameFor("dad")} to save it here 💛
            </Text>
          </View>
        ) : null}

        {notes.map((note, i) => {
          const p = PERSONAS[note.sender];
          return (
            <Animated.View
              key={note.id}
              entering={FadeInDown.duration(300).delay(i * 50)}
              style={[styles.noteCard, { borderLeftColor: p.color }]}
              testID={`note-${note.id}`}
            >
              <View style={styles.quoteRow}>
                <Ionicons name="bookmark" size={15} color={p.color} />
                <Text style={[styles.noteWho, { color: p.deep }]}>{nameFor(note.sender)}</Text>
                <Pressable
                  testID={`note-delete-${note.id}`}
                  onPress={() => remove(note.id)}
                  hitSlop={8}
                  style={styles.trash}
                >
                  <Ionicons name="trash-outline" size={17} color={colors.textFaint} />
                </Pressable>
              </View>
              <Text style={styles.noteText}>{note.text}</Text>
              <Text style={styles.noteDate}>
                {new Date(note.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })} ·{" "}
                {formatTime(note.created_at)}
              </Text>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: "rgba(248,246,241,0.96)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 2, width: 30 },
  headerTitle: { fontFamily: font.bold, fontSize: 17, color: colors.text },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  sub: { fontFamily: font.regular, fontSize: 14, color: colors.textMuted, marginBottom: spacing.lg, lineHeight: 20 },
  empty: { alignItems: "center", paddingTop: spacing.xxxl, gap: spacing.sm },
  emptyTitle: { fontFamily: font.bold, fontSize: 17, color: colors.text, marginTop: spacing.sm },
  emptyText: { fontFamily: font.regular, fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20, paddingHorizontal: spacing.lg },
  noteCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderLeftWidth: 4,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  quoteRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  noteWho: { fontFamily: font.bold, fontSize: 13.5 },
  trash: { marginLeft: "auto" },
  noteText: { fontFamily: font.medium, fontSize: 16, color: colors.text, lineHeight: 23 },
  noteDate: { fontFamily: font.regular, fontSize: 11.5, color: colors.textFaint, marginTop: spacing.sm },
});
