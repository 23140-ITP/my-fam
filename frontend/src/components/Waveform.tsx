import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const PEAKS = [0.5, 0.85, 0.45, 1, 0.65, 0.9, 0.4, 0.75, 0.55];

function Bar({ index, active, color }: { index: number; active: boolean; color: string }) {
  const v = useSharedValue(0.25);
  useEffect(() => {
    if (active) {
      v.value = withDelay(
        index * 70,
        withRepeat(
          withSequence(
            withTiming(PEAKS[index % PEAKS.length], { duration: 420, easing: Easing.inOut(Easing.quad) }),
            withTiming(0.25, { duration: 420, easing: Easing.inOut(Easing.quad) }),
          ),
          -1,
        ),
      );
    } else {
      v.value = withTiming(0.22, { duration: 300 });
    }
  }, [active, index, v]);

  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: v.value }] }));
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

export function Waveform({
  active,
  color = "#FFFFFF",
  bars = 9,
}: {
  active: boolean;
  color?: string;
  bars?: number;
}) {
  return (
    <View style={styles.row}>
      {Array.from({ length: bars }).map((_, i) => (
        <Bar key={i} index={i} active={active} color={color} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 64 },
  bar: { width: 6, height: 60, borderRadius: 3 },
});
