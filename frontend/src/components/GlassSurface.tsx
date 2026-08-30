import React from "react";
import {
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import { GlassView } from "expo-glass-effect";

type GlassSurfaceProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  tintColor?: string;
  intensity?: number;
  interactive?: boolean;
  testID?: string;
};

const nativeGlassAvailable =
  Platform.OS === "ios" && Number(Platform.Version) >= 26;

export function GlassSurface({
  children,
  style,
  contentStyle,
  tintColor = "rgba(255,255,255,0.30)",
  intensity = 55,
  interactive = false,
  testID,
}: GlassSurfaceProps) {
  return (
    <View testID={testID} style={[styles.container, style]}>
      {nativeGlassAvailable ? (
        <GlassView
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          glassEffectStyle="regular"
          tintColor={tintColor}
          isInteractive={interactive}
        />
      ) : (
        <BlurView
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          intensity={intensity}
          tint="light"
        />
      )}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.tint,
          { backgroundColor: tintColor },
        ]}
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.specular]}
      />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  content: {
    flex: 1,
  },
  tint: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.56)",
  },
  specular: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.76)",
  },
});
