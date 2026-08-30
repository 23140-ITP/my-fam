import React, { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Avatar } from "@/src/components/Avatar";
import { CareRing } from "@/src/components/CareRing";
import {
  PERSONAS,
  PersonaKey,
  colors,
  font,
  formatTime,
  greetingForTime,
  radius,
  shadow,
  spacing,
} from "@/src/constants/theme";
import { api, Care, Conversation } from "@/src/lib/api";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [name, setName] = useState("friend");
  const [care, setCare] = useState<Care | null>(null);
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.home();
      setName(data.name);
      setCare(data.care);
      setConvos(data.conversations);
    } catch {
      /* keep last state */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const water = care?.water_glasses ?? 0;
  const waterGoal = care?.water_goal ?? 8;
  const meals = care?.meals.length ?? 0;
  const slept = care?.slept_well ?? null;
  const nudge = buildNudge(water, waterGoal, meals, slept);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
        }
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting} testID="home-greeting">
              {greetingForTime(name)}
            </Text>
            <Text style={styles.sub}>How are you feeling today?</Text>
          </View>
          <Pressable
            testID="home-profile-btn"
            onPress={() => router.push("/profile")}
            style={styles.profileBtn}
            hitSlop={8}
          >
            <Ionicons name="person" size={20} color={colors.brand} />
          </Pressable>
        </View>

        <Animated.View entering={FadeInDown.duration(320)} style={[styles.careCard, shadow]}>
          <View style={styles.careHead}>
            <Text style={styles.cardTitle}>Today&apos;s care</Text>
            <Pressable
              testID="home-care-details"
              onPress={() => router.push("/care")}
              style={styles.detailsBtn}
              hitSlop={8}
            >
              <Text style={styles.detailsText}>Details</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.brand} />
            </Pressable>
          </View>
          <View style={styles.ringRow}>
            <CareStat
              progress={Math.min(meals / 3, 1)}
              color={colors.mom}
              icon="restaurant"
              value={`${meals}/3`}
              label="Meals"
            />
            <CareStat
              progress={waterGoal ? water / waterGoal : 0}
              color={colors.dad}
              icon="water"
              value={`${water}/${waterGoal}`}
              label="Water"
            />
            <CareStat
              progress={slept === true ? 1 : slept === false ? 0.33 : 0}
              color={colors.brand}
              icon="moon"
              value={slept === true ? "Good" : slept === false ? "Poor" : "—"}
              label="Sleep"
            />
          </View>
        </Animated.View>

        {nudge ? (
          <Animated.View entering={FadeInDown.duration(360).delay(80)}>
            <Pressable
              testID="home-nudge"
              onPress={() => router.push("/care")}
              style={[styles.nudge, { backgroundColor: nudge.bg }]}
            >
              <Ionicons name={nudge.icon} size={20} color={nudge.color} />
              <Text style={styles.nudgeText}>{nudge.text}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
            </Pressable>
          </Animated.View>
        ) : null}

        <Text style={styles.sectionTitle}>Family</Text>
        {(["mom", "dad", "family"] as PersonaKey[]).map((key, i) => {
          const conv = convos.find((c) => c.conversation === key);
          const p = PERSONAS[key];
          return (
            <Animated.View key={key} entering={FadeInDown.duration(320).delay(120 + i * 60)}>
              <Pressable
                testID={`home-chat-${key}`}
                style={styles.chatRow}
                onPress={() => router.push(`/chat/${key}`)}
              >
                <Avatar persona={key} size={54} />
                <View style={styles.chatMid}>
                  <Text style={styles.chatName}>{key === "family" ? "Family group" : p.name}</Text>
                  <Text style={styles.chatSnippet} numberOfLines={1}>
                    {previewText(conv)}
                  </Text>
                </View>
                <View style={styles.chatRight}>
                  <Text style={styles.chatTime}>{formatTime(conv?.last_time)}</Text>
                  {conv?.unread ? <View style={[styles.dot, { backgroundColor: p.color }]} /> : null}
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function CareStat({
  progress,
  color,
  icon,
  value,
  label,
}: {
  progress: number;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.stat}>
      <CareRing progress={progress} color={color} size={84} strokeWidth={8}>
        <Ionicons name={icon} size={22} color={color} />
        <Text style={styles.statValue}>{value}</Text>
      </CareRing>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function previewText(conv?: Conversation): string {
  if (!conv || !conv.last_text) return "Say hi 👋";
  const who =
    conv.last_sender === "user"
      ? "You: "
      : conv.conversation === "family"
        ? `${conv.last_sender === "mom" ? "Mom" : "Dad"}: `
        : "";
  return `${who}${conv.last_text}`;
}

function buildNudge(
  water: number,
  goal: number,
  meals: number,
  slept: boolean | null,
): { text: string; bg: string; color: string; icon: keyof typeof Ionicons.glyphMap } | null {
  if (water < goal) {
    return {
      text: `${water} of ${goal} glasses so far — Mom says keep sipping 💧`,
      bg: colors.dadSoft,
      color: colors.dad,
      icon: "water",
    };
  }
  if (meals === 0) {
    return {
      text: "Haven't eaten yet? Dad says fuel up — even a small snack counts.",
      bg: colors.momSoft,
      color: colors.momDeep,
      icon: "restaurant",
    };
  }
  if (slept === null) {
    return {
      text: "How did you sleep last night? Let Mom & Dad know.",
      bg: colors.brandSoft,
      color: colors.brand,
      icon: "moon",
    };
  }
  return {
    text: "You're taking good care of yourself today. Proud of you 💛",
    bg: colors.brandSoft,
    color: colors.brand,
    icon: "heart",
  };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing.lg },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.xl },
  greeting: { fontFamily: font.extrabold, fontSize: 27, color: colors.text, letterSpacing: -0.5 },
  sub: { fontFamily: font.regular, fontSize: 15, color: colors.textMuted, marginTop: 3 },
  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  careCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  careHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontFamily: font.bold, fontSize: 17, color: colors.text },
  detailsBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  detailsText: { fontFamily: font.semibold, fontSize: 13, color: colors.brand },
  ringRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.lg },
  stat: { alignItems: "center", flex: 1 },
  statValue: { fontFamily: font.bold, fontSize: 12, color: colors.text, marginTop: 2 },
  statLabel: { fontFamily: font.medium, fontSize: 13, color: colors.textMuted, marginTop: spacing.sm },
  nudge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  nudgeText: { flex: 1, fontFamily: font.medium, fontSize: 14, color: colors.text, lineHeight: 19 },
  sectionTitle: {
    fontFamily: font.bold,
    fontSize: 17,
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  chatMid: { flex: 1, marginLeft: spacing.md },
  chatName: { fontFamily: font.bold, fontSize: 16, color: colors.text },
  chatSnippet: { fontFamily: font.regular, fontSize: 13.5, color: colors.textMuted, marginTop: 2 },
  chatRight: { alignItems: "flex-end", gap: 6 },
  chatTime: { fontFamily: font.regular, fontSize: 11.5, color: colors.textFaint },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
