import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp, FadeOut } from "react-native-reanimated";

import { CareRing } from "@/src/components/CareRing";
import { colors, font, radius, shadow, spacing } from "@/src/constants/theme";
import { api, Care } from "@/src/lib/api";
import { haptic } from "@/src/lib/haptics";

const MEALS = ["Breakfast", "Lunch", "Dinner", "Snack"] as const;

export default function CareScreen() {
  const insets = useSafeAreaInsets();
  const [care, setCare] = useState<Care | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setCare(await api.care());
    } catch {
      /* keep */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const onWater = async (delta: number) => {
    haptic.light();
    const next = await api.addWater(delta);
    setCare(next);
    if (delta > 0 && next.water_glasses >= next.water_goal) {
      haptic.success();
      flash("Fully hydrated! Mom's proud 💧");
    }
  };

  const onMeal = async (label: string) => {
    haptic.select();
    const was = care?.meals.some((m) => m.label === label);
    const next = await api.toggleMeal(label);
    setCare(next);
    if (!was) {
      haptic.success();
      flash(`${label} logged — good, you ate 💛`);
    }
  };

  const onSleep = async (well: boolean) => {
    haptic.success();
    const next = await api.setSleep(well, well ? 7.5 : 5);
    setCare(next);
    flash(well ? "Glad you rested well 🌙" : "Dad says take it easy today 💙");
  };

  const water = care?.water_glasses ?? 0;
  const goal = care?.water_goal ?? 8;
  const slept = care?.slept_well ?? null;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Care</Text>
        <Text style={styles.sub}>A few small things, just for you.</Text>

        {/* Water */}
        <Animated.View entering={FadeInDown.duration(320)} style={[styles.card, shadow]}>
          <View style={styles.cardHead}>
            <View style={[styles.iconChip, { backgroundColor: colors.dadSoft }]}>
              <Ionicons name="water" size={18} color={colors.dad} />
            </View>
            <Text style={styles.cardTitle}>Water</Text>
          </View>
          <View style={styles.waterRow}>
            <Pressable
              testID="water-minus"
              style={styles.stepBtn}
              onPress={() => onWater(-1)}
              hitSlop={8}
            >
              <Ionicons name="remove" size={24} color={colors.brand} />
            </Pressable>
            <CareRing progress={goal ? water / goal : 0} color={colors.dad} size={128} strokeWidth={11}>
              <Text style={styles.bigValue}>{water}</Text>
              <Text style={styles.smallValue}>of {goal} glasses</Text>
            </CareRing>
            <Pressable
              testID="water-plus"
              style={[styles.stepBtn, styles.stepBtnPrimary]}
              onPress={() => onWater(1)}
              hitSlop={8}
            >
              <Ionicons name="add" size={24} color={colors.white} />
            </Pressable>
          </View>
        </Animated.View>

        {/* Food */}
        <Animated.View entering={FadeInDown.duration(320).delay(70)} style={[styles.card, shadow]}>
          <View style={styles.cardHead}>
            <View style={[styles.iconChip, { backgroundColor: colors.momSoft }]}>
              <Ionicons name="restaurant" size={18} color={colors.momDeep} />
            </View>
            <Text style={styles.cardTitle}>Have you eaten?</Text>
          </View>
          <View style={styles.mealsWrap}>
            {MEALS.map((label) => {
              const active = care?.meals.some((m) => m.label === label) ?? false;
              return (
                <Pressable
                  key={label}
                  testID={`meal-${label}`}
                  onPress={() => onMeal(label)}
                  style={[styles.mealChip, active && styles.mealChipActive]}
                >
                  {active ? <Ionicons name="checkmark" size={15} color={colors.white} /> : null}
                  <Text style={[styles.mealText, active && styles.mealTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* Sleep */}
        <Animated.View entering={FadeInDown.duration(320).delay(140)} style={[styles.card, shadow]}>
          <View style={styles.cardHead}>
            <View style={[styles.iconChip, { backgroundColor: colors.brandSoft }]}>
              <Ionicons name="moon" size={18} color={colors.brand} />
            </View>
            <Text style={styles.cardTitle}>How did you sleep?</Text>
          </View>
          <View style={styles.sleepRow}>
            <Pressable
              testID="sleep-well"
              onPress={() => onSleep(true)}
              style={[styles.sleepBtn, slept === true && styles.sleepBtnWell]}
            >
              <Ionicons
                name="happy"
                size={22}
                color={slept === true ? colors.white : colors.brand}
              />
              <Text style={[styles.sleepText, slept === true && styles.sleepTextActive]}>
                Slept well
              </Text>
            </Pressable>
            <Pressable
              testID="sleep-poor"
              onPress={() => onSleep(false)}
              style={[styles.sleepBtn, slept === false && styles.sleepBtnPoor]}
            >
              <Ionicons
                name="sad"
                size={22}
                color={slept === false ? colors.white : colors.clay}
              />
              <Text style={[styles.sleepText, slept === false && styles.sleepTextActive]}>
                Not great
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>

      {toast ? (
        <Animated.View
          entering={FadeInUp.duration(260)}
          exiting={FadeOut.duration(200)}
          style={[styles.toast, { bottom: insets.bottom + spacing.lg, pointerEvents: "none" }]}
        >
          <Text style={styles.toastText} testID="care-toast">
            {toast}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing.lg },
  title: { fontFamily: font.extrabold, fontSize: 30, color: colors.text, letterSpacing: -0.6 },
  sub: { fontFamily: font.regular, fontSize: 14.5, color: colors.textMuted, marginTop: 4, marginBottom: spacing.xl },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  iconChip: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontFamily: font.bold, fontSize: 17, color: colors.text },
  waterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnPrimary: { backgroundColor: colors.brand },
  bigValue: { fontFamily: font.extrabold, fontSize: 34, color: colors.text },
  smallValue: { fontFamily: font.medium, fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  mealsWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  mealChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  mealChipActive: { backgroundColor: colors.momDeep, borderColor: colors.momDeep },
  mealText: { fontFamily: font.semibold, fontSize: 14, color: colors.text },
  mealTextActive: { color: colors.white },
  sleepRow: { flexDirection: "row", gap: spacing.md },
  sleepBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  sleepBtnWell: { backgroundColor: colors.brand, borderColor: colors.brand },
  sleepBtnPoor: { backgroundColor: colors.clay, borderColor: colors.clay },
  sleepText: { fontFamily: font.semibold, fontSize: 15, color: colors.text },
  sleepTextActive: { color: colors.white },
  toast: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: colors.text,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
  },
  toastText: { fontFamily: font.semibold, fontSize: 14, color: colors.surface },
});
