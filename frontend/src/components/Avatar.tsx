import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { PERSONAS, PersonaKey, font } from "@/src/constants/theme";

export function Avatar({
  persona,
  size = 48,
  testID,
  initial,
}: {
  persona: PersonaKey;
  size: number;
  testID?: string;
  initial?: string;
}) {
  const p = PERSONAS[persona];
  return (
    <View
      testID={testID}
      style={[styles.wrap, { width: size, height: size, borderRadius: size / 2, backgroundColor: p.color }]}
    >
      <Image source={{ uri: p.bg }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      <View style={[StyleSheet.absoluteFill, styles.scrim]}>
        {persona === "family" ? (
          <Ionicons name="people" size={size * 0.46} color="#FFFFFF" />
        ) : (
          <Text style={{ fontFamily: font.bold, color: "#FFFFFF", fontSize: size * 0.42 }}>
            {initial || p.initial}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden", alignItems: "center", justifyContent: "center" },
  scrim: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(31,42,38,0.22)" },
});
