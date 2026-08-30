import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Avatar } from "@/src/components/Avatar";
import {
  PERSONAS,
  PersonaKey,
  colors,
  font,
  formatTime,
  radius,
  spacing,
} from "@/src/constants/theme";
import { api, Conversation } from "@/src/lib/api";
import { useFamily } from "@/src/store/family";

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { nameFor, initialFor } = useFamily();
  const [convos, setConvos] = useState<Conversation[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await api.conversations();
      setConvos(data.conversations);
    } catch {
      /* keep */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Chats</Text>
        <Text style={styles.sub}>Your family is always a message away.</Text>

        <View style={styles.list}>
          {(["mom", "dad", "family"] as PersonaKey[]).map((key, i) => {
            const conv = convos.find((c) => c.conversation === key);
            const p = PERSONAS[key];
            return (
              <Animated.View key={key} entering={FadeInDown.duration(320).delay(i * 70)}>
                <Pressable
                  testID={`chats-row-${key}`}
                  style={styles.row}
                  onPress={() => router.push(`/chat/${key}`)}
                >
                  <Avatar persona={key} size={56} initial={initialFor(key)} />
                  <View style={styles.mid}>
                    <Text style={styles.name}>{key === "family" ? "Family group" : nameFor(key)}</Text>
                    <Text style={styles.snippet} numberOfLines={1}>
                      {preview(conv, nameFor)}
                    </Text>
                  </View>
                  <View style={styles.right}>
                    <Text style={styles.time}>{formatTime(conv?.last_time)}</Text>
                    {conv?.unread ? <View style={[styles.dot, { backgroundColor: p.color }]} /> : null}
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function preview(conv: Conversation | undefined, nameFor: (p: PersonaKey) => string): string {
  if (!conv || !conv.last_text) return "Start the conversation 💬";
  const who =
    conv.last_sender === "user"
      ? "You: "
      : conv.conversation === "family"
        ? `${nameFor(conv.last_sender as PersonaKey)}: `
        : "";
  return `${who}${conv.last_text}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing.lg },
  title: { fontFamily: font.extrabold, fontSize: 30, color: colors.text, letterSpacing: -0.6 },
  sub: { fontFamily: font.regular, fontSize: 14.5, color: colors.textMuted, marginTop: 4, marginBottom: spacing.xl },
  list: { gap: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  mid: { flex: 1, marginLeft: spacing.md },
  name: { fontFamily: font.bold, fontSize: 16.5, color: colors.text },
  snippet: { fontFamily: font.regular, fontSize: 14, color: colors.textMuted, marginTop: 3 },
  right: { alignItems: "flex-end", gap: 7 },
  time: { fontFamily: font.regular, fontSize: 11.5, color: colors.textFaint },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
