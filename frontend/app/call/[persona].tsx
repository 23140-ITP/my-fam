import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { Waveform } from "@/src/components/Waveform";
import { PERSONAS, PersonaKey, colors, font, radius, spacing } from "@/src/constants/theme";
import { api } from "@/src/lib/api";
import { useRecorder } from "@/src/hooks/useRecorder";
import { useTts } from "@/src/hooks/useTts";
import { useFamily } from "@/src/store/family";
import { haptic } from "@/src/lib/haptics";

type Status = "connecting" | "idle" | "listening" | "thinking" | "speaking";
type Turn = { id: string; sender: "user" | "mom" | "dad"; text: string };

function fmt(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

export default function CallScreen() {
  const raw = useLocalSearchParams<{ persona: string }>().persona;
  const isGroup = raw === "family";
  const persona: PersonaKey = raw === "dad" ? "dad" : raw === "family" ? "family" : "mom";
  const p = PERSONAS[persona];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const recorder = useRecorder();
  const tts = useTts();
  const { nameFor, initialFor } = useFamily();
  const title = isGroup ? `${nameFor("mom")} & ${nameFor("dad")}` : nameFor(persona);

  const [status, setStatus] = useState<Status>("connecting");
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [permBlocked, setPermBlocked] = useState(false);
  const [speaking, setSpeaking] = useState<"mom" | "dad" | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const speakTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef<{ persona: "mom" | "dad"; text: string }[]>([]);
  const idx = useRef(0);
  const token = useRef(0);
  const mutedRef = useRef(false);

  // Play a queue of parent clips one after another (Mom, then Dad in a group call)
  const playIndex = useCallback(
    (i: number) => {
      const q = queue.current;
      if (speakTimer.current) clearTimeout(speakTimer.current);
      if (i >= q.length) {
        setStatus((s) => (s === "speaking" ? "idle" : s));
        setSpeaking(null);
        return;
      }
      idx.current = i;
      const item = q[i];
      const myToken = ++token.current;
      setSpeaking(item.persona);
      setStatus("speaking");
      if (mutedRef.current) {
        speakTimer.current = setTimeout(() => {
          if (myToken === token.current) playIndex(i + 1);
        }, 850);
      } else {
        tts.speak(item.persona, item.text);
        const est = Math.min(14000, Math.max(2400, item.text.length * 70)) + 3500;
        speakTimer.current = setTimeout(() => {
          if (myToken === token.current) playIndex(i + 1);
        }, est);
      }
    },
    [tts],
  );

  const startSpeaking = useCallback(
    (items: { persona: "mom" | "dad"; text: string }[]) => {
      queue.current = items;
      idx.current = 0;
      playIndex(0);
    },
    [playIndex],
  );

  // Connect, then greeting
  useEffect(() => {
    haptic.medium();
    const t = setTimeout(() => {
      if (isGroup) {
        const items = [
          { persona: "mom" as const, text: PERSONAS.mom.greeting },
          { persona: "dad" as const, text: PERSONAS.dad.greeting },
        ];
        setTurns(items.map((it, i) => ({ id: `greet-${i}`, sender: it.persona, text: it.text })));
        startSpeaking(items);
      } else {
        const only = persona as "mom" | "dad";
        setTurns([{ id: "greet", sender: only, text: p.greeting }]);
        startSpeaking([{ persona: only, text: p.greeting }]);
      }
    }, 1300);
    return () => {
      clearTimeout(t);
      if (speakTimer.current) clearTimeout(speakTimer.current);
      token.current++;
      tts.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Call timer
  const connecting = status === "connecting";
  useEffect(() => {
    if (connecting) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [connecting]);

  // Advance the speech queue when a clip finishes playing
  const finished = tts.status?.didJustFinish;
  useEffect(() => {
    if (finished && !mutedRef.current) playIndex(idx.current + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [turns]);

  const onPrimary = useCallback(async () => {
    setPermBlocked(false);
    if (status === "idle") {
      haptic.medium();
      const r = await recorder.start();
      if (r.ok) setStatus("listening");
      else setPermBlocked(!!r.blocked);
    } else if (status === "listening") {
      haptic.light();
      setStatus("thinking");
      const text = await recorder.stopAndTranscribe();
      if (!text) {
        setStatus("idle");
        return;
      }
      setTurns((t) => [...t, { id: `u-${Date.now()}`, sender: "user", text }]);
      try {
        const { replies } = await api.chat(persona, text);
        setTurns((t) => [...t, ...replies.map((r) => ({ id: r.id, sender: r.sender, text: r.text }))]);
        const items = replies
          .filter((r) => r.sender !== "user")
          .map((r) => ({ persona: r.sender as "mom" | "dad", text: r.text }));
        startSpeaking(items);
      } catch {
        setStatus("idle");
      }
    }
  }, [status, recorder, persona, startSpeaking]);

  const toggleMute = useCallback(() => {
    haptic.select();
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (next) {
      token.current++;
      if (speakTimer.current) clearTimeout(speakTimer.current);
      tts.stop();
      setStatus((s) => (s === "speaking" ? "idle" : s));
      setSpeaking(null);
    }
  }, [tts]);

  const endCall = useCallback(() => {
    haptic.medium();
    token.current++;
    tts.stop();
    router.back();
  }, [tts, router]);

  // Avatar pulse
  const pulse = useSharedValue(1);
  const active = status === "speaking" || status === "listening";
  useEffect(() => {
    if (active) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 750, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 750, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
      );
    } else {
      pulse.value = withTiming(1, { duration: 300 });
    }
  }, [active, pulse]);
  const avatarStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const speakerName = speaking ? nameFor(speaking) : title;
  const statusText =
    status === "connecting"
      ? "Connecting…"
      : status === "listening"
        ? "Listening…"
        : status === "thinking"
          ? "Thinking…"
          : status === "speaking"
            ? `${speakerName} is talking…`
            : "Tap to talk";

  return (
    <View style={styles.root}>
      <Image source={{ uri: p.bg }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={["rgba(20,26,24,0.45)", "rgba(20,26,24,0.72)", "rgba(20,26,24,0.94)"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
        {/* Top */}
        <View style={styles.top}>
          <Text style={styles.calling}>Calling {title}</Text>
          <Text style={styles.timer}>{connecting ? "…" : fmt(seconds)}</Text>
        </View>

        {/* Avatar + status */}
        <View style={styles.center}>
          {isGroup ? (
            <View style={styles.groupAvatars}>
              {(["mom", "dad"] as const).map((k) => {
                const activeK = speaking === k;
                return (
                  <Animated.View
                    key={k}
                    style={[
                      styles.groupAvatar,
                      activeK ? avatarStyle : undefined,
                      {
                        opacity: !speaking || activeK ? 1 : 0.5,
                        borderColor: activeK ? PERSONAS[k].color : "rgba(255,255,255,0.3)",
                      },
                    ]}
                  >
                    <Image source={{ uri: PERSONAS[k].bg }} style={styles.avatarImg} contentFit="cover" />
                    <View style={styles.avatarScrim} />
                    <Text style={styles.groupInitial}>{initialFor(k)}</Text>
                  </Animated.View>
                );
              })}
            </View>
          ) : (
            <Animated.View style={[styles.avatarRing, avatarStyle]}>
              <Image source={{ uri: p.bg }} style={styles.avatarImg} contentFit="cover" />
              <View style={styles.avatarScrim} />
              <Text style={styles.avatarInitial}>{initialFor(persona)}</Text>
            </Animated.View>
          )}
          <Text style={styles.statusText} testID="call-status">
            {statusText}
          </Text>
          <View style={styles.waveWrap}>
            <Waveform active={active} color={speaking ? PERSONAS[speaking].color : "rgba(255,255,255,0.92)"} />
          </View>
        </View>

        {/* Transcript */}
        <View style={styles.transcriptBox}>
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: spacing.sm }}
          >
            {turns.map((t) => (
              <Animated.View
                key={t.id}
                entering={FadeIn.duration(260)}
                style={[styles.turn, t.sender === "user" ? styles.turnUser : styles.turnParent]}
              >
                <Text style={styles.turnWho}>{t.sender === "user" ? "You" : nameFor(t.sender)}</Text>
                <Text style={styles.turnText}>{t.text}</Text>
              </Animated.View>
            ))}
          </ScrollView>
        </View>

        {permBlocked ? (
          <Pressable style={styles.permPill} onPress={() => Linking.openSettings()} testID="call-open-settings">
            <Ionicons name="mic-off" size={15} color="#fff" />
            <Text style={styles.permPillText}>Enable microphone in Settings</Text>
          </Pressable>
        ) : null}

        {/* Controls */}
        <View style={styles.controls}>
          <Pressable testID="call-mute" onPress={toggleMute} style={styles.smallBtn}>
            <Ionicons name={muted ? "volume-mute" : "volume-high"} size={24} color="#fff" />
            <Text style={styles.smallLabel}>{muted ? "Muted" : "Sound"}</Text>
          </Pressable>

          <Pressable
            testID="call-primary"
            onPress={onPrimary}
            disabled={status === "connecting" || status === "thinking" || status === "speaking"}
            style={[
              styles.primaryBtn,
              status === "listening" && styles.primaryListening,
              (status === "connecting" || status === "thinking" || status === "speaking") &&
                styles.primaryBusy,
            ]}
          >
            {status === "thinking" || status === "connecting" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons
                name={status === "listening" ? "radio-button-on" : status === "speaking" ? "musical-notes" : "mic"}
                size={30}
                color="#fff"
              />
            )}
          </Pressable>

          <Pressable testID="call-end" onPress={endCall} style={[styles.smallBtn, styles.endBtn]}>
            <Ionicons name="call" size={24} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
            <Text style={styles.smallLabel}>End</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#141A18" },
  content: { flex: 1, paddingHorizontal: spacing.xl },
  top: { alignItems: "center", gap: 4 },
  calling: { fontFamily: font.semibold, fontSize: 15, color: "rgba(255,255,255,0.85)" },
  timer: { fontFamily: font.medium, fontSize: 13, color: "rgba(255,255,255,0.6)" },
  center: { alignItems: "center", marginTop: spacing.xl },
  avatarRing: {
    width: 148,
    height: 148,
    borderRadius: 74,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.35)",
  },
  avatarImg: { ...StyleSheet.absoluteFillObject },
  avatarScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(31,42,38,0.25)" },
  avatarInitial: { fontFamily: font.extrabold, fontSize: 58, color: "#fff" },
  groupAvatars: { flexDirection: "row", gap: spacing.lg, alignItems: "center", justifyContent: "center" },
  groupAvatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
  },
  groupInitial: { fontFamily: font.extrabold, fontSize: 44, color: "#fff" },
  statusText: { fontFamily: font.semibold, fontSize: 18, color: "#fff", marginTop: spacing.lg },
  waveWrap: { marginTop: spacing.md, height: 64, justifyContent: "center" },
  transcriptBox: { flex: 1, marginTop: spacing.md, marginBottom: spacing.md },
  turn: { marginBottom: spacing.md, maxWidth: "88%" },
  turnUser: { alignSelf: "flex-end", alignItems: "flex-end" },
  turnParent: { alignSelf: "flex-start" },
  turnWho: { fontFamily: font.bold, fontSize: 11.5, color: "rgba(255,255,255,0.55)", marginBottom: 2 },
  turnText: { fontFamily: font.regular, fontSize: 15, color: "rgba(255,255,255,0.95)", lineHeight: 21 },
  permPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    alignSelf: "center",
    backgroundColor: "rgba(217,106,91,0.9)",
    paddingVertical: 8,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
  },
  permPillText: { fontFamily: font.semibold, fontSize: 12.5, color: "#fff" },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", marginTop: spacing.sm },
  smallBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  smallLabel: { fontFamily: font.medium, fontSize: 10, color: "rgba(255,255,255,0.85)" },
  endBtn: { backgroundColor: colors.danger },
  primaryBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.22)",
  },
  primaryListening: { backgroundColor: colors.danger },
  primaryBusy: { opacity: 0.75 },
});
