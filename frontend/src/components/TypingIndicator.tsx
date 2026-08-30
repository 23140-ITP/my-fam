import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { Avatar } from "@/src/components/Avatar";
import { PERSONAS, font, radius, spacing } from "@/src/constants/theme";

function Dot({ delay, color }: { delay: number; color: string }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(1, { duration: 320 }), withTiming(0, { duration: 320 })), -1),
    );
  }, [delay, v]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + v.value * 0.65,
    transform: [{ translateY: -3 * v.value }],
  }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

export function TypingIndicator({ persona }: { persona: "mom" | "dad" }) {
  const p = PERSONAS[persona];
  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.row}>
      <Avatar persona={persona} size={30} />
      <View style={styles.content}>
        <Text style={[styles.name, { color: p.deep }]}>{p.name}</Text>
        <View style={[styles.bubble, { backgroundColor: p.color }]}>
          <Dot delay={0} color={p.bubbleText === "#FFFFFF" ? "#FFFFFF" : "#7A5344"} />
          <Dot delay={140} color={p.bubbleText === "#FFFFFF" ? "#FFFFFF" : "#7A5344"} />
          <Dot delay={280} color={p.bubbleText === "#FFFFFF" ? "#FFFFFF" : "#7A5344"} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", marginBottom: spacing.md },
  content: { marginLeft: spacing.sm },
  name: { fontFamily: font.semibold, fontSize: 12, marginBottom: 3, marginLeft: 4 },
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    borderBottomLeftRadius: radius.sm,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
