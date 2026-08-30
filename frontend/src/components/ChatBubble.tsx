import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { Avatar } from "@/src/components/Avatar";
import { PERSONAS, colors, font, formatTime, radius, spacing } from "@/src/constants/theme";
import type { Message } from "@/src/lib/api";

export function ChatBubble({
  message,
  group = false,
  showMeta = false,
  index = 0,
  name,
  initial,
  saved = false,
  onSave,
}: {
  message: Message;
  group?: boolean;
  showMeta?: boolean;
  index?: number;
  name?: string;
  initial?: string;
  saved?: boolean;
  onSave?: () => void;
}) {
  const isUser = message.sender === "user";

  if (isUser) {
    return (
      <Animated.View
        entering={FadeInDown.duration(220).delay(Math.min(index, 6) * 18)}
        style={styles.rowRight}
        testID={`bubble-${message.id}`}
      >
        <View style={[styles.bubble, styles.userBubble]}>
          <Text style={[styles.text, styles.userText]}>{message.text}</Text>
        </View>
        <Text style={[styles.time, styles.timeRight]}>{formatTime(message.created_at)}</Text>
      </Animated.View>
    );
  }

  const persona = message.sender as "mom" | "dad";
  const p = PERSONAS[persona];
  return (
    <Animated.View
      entering={FadeInDown.duration(220).delay(Math.min(index, 6) * 18)}
      style={styles.rowLeft}
      testID={`bubble-${message.id}`}
    >
      {group ? (
        <View style={styles.avatarSlot}>
          {showMeta ? <Avatar persona={persona} size={30} initial={initial} /> : null}
        </View>
      ) : null}
      <View style={styles.leftContent}>
        {group && showMeta ? <Text style={[styles.name, { color: p.deep }]}>{name || p.name}</Text> : null}
        <Pressable
          onLongPress={onSave}
          delayLongPress={280}
          testID={`bubble-save-${message.id}`}
          style={[styles.bubble, styles.parentBubble, { backgroundColor: p.color }]}
        >
          <Text style={[styles.text, { color: p.bubbleText }]}>{message.text}</Text>
        </Pressable>
        <View style={styles.metaRow}>
          <Text style={styles.time}>{formatTime(message.created_at)}</Text>
          {saved ? <Ionicons name="bookmark" size={11} color={p.deep} style={styles.savedIcon} /> : null}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rowRight: { alignItems: "flex-end", marginBottom: spacing.md, paddingLeft: spacing.xxxl },
  rowLeft: { flexDirection: "row", alignItems: "flex-end", marginBottom: spacing.md, paddingRight: spacing.xxxl },
  avatarSlot: { width: 30, marginRight: spacing.sm, marginBottom: 20 },
  leftContent: { flexShrink: 1, alignItems: "flex-start" },
  bubble: { maxWidth: "100%", paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.lg },
  userBubble: { backgroundColor: colors.brand, borderBottomRightRadius: radius.sm },
  parentBubble: { borderBottomLeftRadius: radius.sm },
  text: { fontFamily: font.regular, fontSize: 15.5, lineHeight: 21 },
  userText: { color: "#FFFFFF" },
  name: { fontFamily: font.semibold, fontSize: 12, marginBottom: 3, marginLeft: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 4, marginLeft: 6 },
  time: { fontFamily: font.regular, fontSize: 11, color: colors.textFaint },
  timeRight: { marginRight: 6, marginLeft: 0, marginTop: 4 },
  savedIcon: { marginLeft: 5 },
});
