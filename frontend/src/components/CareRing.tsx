import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/src/constants/theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function CareRing({
  progress,
  color,
  size = 92,
  strokeWidth = 9,
  children,
}: {
  progress: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}) {
  const clamped = Math.max(0, Math.min(1, progress));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const anim = useSharedValue(0);

  useEffect(() => {
    anim.value = withTiming(clamped, { duration: 700 });
  }, [clamped, anim]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: c * (1 - anim.value),
  }));

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.tertiary}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.center}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
