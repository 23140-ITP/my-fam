import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";

import { Avatar } from "@/src/components/Avatar";
import { ChatBubble } from "@/src/components/ChatBubble";
import { TypingIndicator } from "@/src/components/TypingIndicator";
import { QuickReplies } from "@/src/components/QuickReplies";
import { ReactionPicker } from "@/src/components/ReactionPicker";
import {
  PERSONAS,
  PersonaKey,
  QUICK_REPLIES,
  colors,
  font,
  radius,
  spacing,
} from "@/src/constants/theme";
import { api, Message } from "@/src/lib/api";
import { useFamily } from "@/src/store/family";
import { useRecorder } from "@/src/hooks/useRecorder";
import { haptic } from "@/src/lib/haptics";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function ChatScreen() {
  const raw = useLocalSearchParams<{ persona: string }>().persona;
  const persona: PersonaKey = raw === "dad" ? "dad" : raw === "family" ? "family" : "mom";
  const isGroup = persona === "family";
  const p = PERSONAS[persona];
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState<null | "mom" | "dad">(null);
  const [showQuick, setShowQuick] = useState(true);
  const [recError, setRecError] = useState<null | "denied" | "blocked">(null);
  const listRef = useRef<FlatList<Message>>(null);
  const recorder = useRecorder();
  const { nameFor, initialFor } = useFamily();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState<{
    message: Message;
    layout: { x: number; y: number; width: number; height: number };
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const displayName = isGroup ? "Family group" : nameFor(persona);

  useEffect(() => {
    (async () => {
      try {
        const [data, n, rx] = await Promise.all([
          api.messages(persona),
          api.notes(),
          api.reactions(persona),
        ]);
        setMessages(data.messages);
        const ids = new Set<string>();
        const map: Record<string, string> = {};
        n.notes.forEach((note) => {
          ids.add(note.message_id);
          map[note.message_id] = note.id;
        });
        setSavedIds(ids);
        setNoteMap(map);
        const rmap: Record<string, string> = {};
        rx.reactions.forEach((x) => {
          rmap[x.message_id] = x.emoji;
        });
        setReactions(rmap);
      } catch {
        /* keep */
      } finally {
        setLoading(false);
      }
    })();
  }, [persona]);

  const scrollEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      haptic.light();
      setInput("");
      const userMsg: Message = {
        id: `local-${Date.now()}`,
        conversation: persona,
        sender: "user",
        text: clean,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      try {
        if (isGroup) {
          setTyping("mom");
          const res = await api.chat(persona, clean);
          await delay(650);
          setMessages((prev) => [...prev, res.replies[0]]);
          setTyping("dad");
          await delay(900);
          setMessages((prev) => [...prev, res.replies[1]]);
          setTyping(null);
        } else {
          setTyping(persona);
          const res = await api.chat(persona, clean);
          await delay(500);
          setMessages((prev) => [...prev, res.replies[0]]);
          setTyping(null);
        }
      } catch {
        setTyping(null);
      }
    },
    [persona, isGroup],
  );

  const onMic = useCallback(async () => {
    setRecError(null);
    if (recorder.isRecording) {
      const text = await recorder.stopAndTranscribe();
      if (text) setInput((prev) => (prev ? `${prev} ${text}` : text));
    } else {
      const r = await recorder.start();
      if (!r.ok) setRecError(r.blocked ? "blocked" : "denied");
    }
  }, [recorder]);

  const flashToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1600);
  }, []);

  const toggleSave = useCallback(
    async (message: Message) => {
      if (message.sender === "user") return;
      haptic.light();
      if (savedIds.has(message.id)) {
        const noteId = noteMap[message.id];
        setSavedIds((s) => {
          const n = new Set(s);
          n.delete(message.id);
          return n;
        });
        flashToast("Removed from Notes");
        if (noteId) {
          try {
            await api.deleteNote(noteId);
          } catch {
            /* ignore */
          }
        }
      } else {
        setSavedIds((s) => new Set(s).add(message.id));
        flashToast("Saved to Notes from Home 💛");
        try {
          const note = await api.addNote({
            conversation: persona,
            sender: message.sender as "mom" | "dad",
            text: message.text,
            message_id: message.id,
            created_at: message.created_at,
          });
          setNoteMap((m) => ({ ...m, [message.id]: note.id }));
        } catch {
          /* ignore */
        }
      }
    },
    [savedIds, noteMap, persona, flashToast],
  );

  const setReactionEmoji = useCallback(
    async (message: Message, emoji: string) => {
      if (message.sender === "user") return;
      haptic.light();
      const willRemove = reactions[message.id] === emoji;
      setReactions((r) => {
        const n = { ...r };
        if (willRemove) delete n[message.id];
        else n[message.id] = emoji;
        return n;
      });
      if (!willRemove) {
        flashToast(
          emoji === "❤️"
            ? `${nameFor(message.sender as "mom" | "dad")} felt your love 💛`
            : `Reacted ${emoji}`,
        );
      }
      try {
        await api.toggleReaction({ conversation: persona, message_id: message.id, emoji });
      } catch {
        /* ignore */
      }
    },
    [reactions, persona, flashToast, nameFor],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const prev = messages[index - 1];
      const showMeta = isGroup && item.sender !== "user" && (!prev || prev.sender !== item.sender);
      const parent = item.sender !== "user" ? (item.sender as "mom" | "dad") : null;
      return (
        <ChatBubble
          message={item}
          group={isGroup}
          showMeta={showMeta}
          index={index}
          name={parent ? nameFor(parent) : undefined}
          initial={parent ? initialFor(parent) : undefined}
          saved={savedIds.has(item.id)}
          reaction={reactions[item.id]}
          onReact={parent ? (emoji) => setReactionEmoji(item, emoji) : undefined}
          onOpenReactions={parent ? (layout) => setPicker({ message: item, layout }) : undefined}
        />
      );
    },
    [messages, isGroup, nameFor, initialFor, savedIds, reactions, setReactionEmoji],
  );

  const subtitle = typing
    ? isGroup
      ? `${nameFor(typing)} is typing…`
      : "typing…"
    : p.subtitle;

  const hasText = input.trim().length > 0;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable testID="chat-back" onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.brand} />
        </Pressable>
        <Avatar persona={persona} size={38} initial={isGroup ? undefined : initialFor(persona)} />
        <View style={styles.headerText}>
          <Text style={styles.headerName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={[styles.headerSub, typing ? { color: p.deep } : null]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        {!isGroup ? (
          <Pressable
            testID="chat-call-btn"
            onPress={() => router.push(`/call/${persona}`)}
            hitSlop={10}
            style={styles.callBtn}
          >
            <Ionicons name="call" size={20} color={colors.brand} />
          </Pressable>
        ) : (
          <Pressable
            testID="chat-call-btn"
            onPress={() => router.push(`/call/family`)}
            hitSlop={10}
            style={styles.callBtn}
          >
            <Ionicons name="call" size={20} color={colors.clay} />
          </Pressable>
        )}
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior="translate-with-padding" keyboardVerticalOffset={0}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollEnd}
          ListEmptyComponent={
            loading ? (
              <View style={styles.empty}>
                <ActivityIndicator color={colors.brand} />
              </View>
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Say hello 👋</Text>
              </View>
            )
          }
          ListFooterComponent={
            typing ? (
              <View style={{ marginTop: spacing.xs }}>
                <TypingIndicator persona={typing} />
              </View>
            ) : null
          }
        />

        {recError ? (
          <View style={styles.permBanner}>
            <Ionicons name="mic-off" size={16} color={colors.danger} />
            <Text style={styles.permText}>
              {recError === "blocked"
                ? "Microphone is off. Enable it in Settings to talk."
                : "Microphone permission needed to record."}
            </Text>
            {recError === "blocked" ? (
              <Pressable onPress={() => Linking.openSettings()} testID="chat-open-settings">
                <Text style={styles.permAction}>Settings</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {showQuick && !hasText && !recorder.isRecording ? (
          <QuickReplies options={QUICK_REPLIES[persona]} onSelect={(t) => send(t)} />
        ) : null}

        {recorder.isRecording ? (
          <View style={styles.recHint}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>Listening… tap the mic to add it</Text>
          </View>
        ) : null}

        <View style={[styles.inputBar, { paddingBottom: (insets.bottom || spacing.sm) + spacing.sm }]}>
          <Pressable
            testID="chat-quick-toggle"
            onPress={() => setShowQuick((s) => !s)}
            hitSlop={8}
            style={styles.plusBtn}
          >
            <Ionicons name={showQuick ? "close" : "add"} size={22} color={colors.textMuted} />
          </Pressable>
          <TextInput
            testID="chat-input"
            style={styles.input}
            placeholder={`Message ${isGroup ? "the family" : nameFor(persona)}…`}
            placeholderTextColor={colors.textFaint}
            value={input}
            onChangeText={setInput}
            multiline
            onSubmitEditing={() => send(input)}
          />
          {hasText ? (
            <Pressable testID="chat-send" onPress={() => send(input)} style={styles.sendBtn}>
              <Ionicons name="arrow-up" size={20} color={colors.white} />
            </Pressable>
          ) : (
            <Pressable
              testID="chat-mic"
              onPress={onMic}
              style={[styles.sendBtn, recorder.isRecording && styles.micActive]}
            >
              {recorder.busy ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Ionicons name={recorder.isRecording ? "stop" : "mic"} size={19} color={colors.white} />
              )}
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>

      {toast ? (
        <View style={[styles.toast, { bottom: (insets.bottom || spacing.sm) + 78, pointerEvents: "none" }]}>
          <Text style={styles.toastText} testID="chat-toast">
            {toast}
          </Text>
        </View>
      ) : null}

      {picker ? (
        <ReactionPicker
          layout={picker.layout}
          current={reactions[picker.message.id]}
          saved={savedIds.has(picker.message.id)}
          onPick={(emoji) => {
            setReactionEmoji(picker.message, emoji);
            setPicker(null);
          }}
          onToggleSave={() => {
            toggleSave(picker.message);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: "rgba(255,249,243,0.96)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 2 },
  headerText: { flex: 1, marginLeft: 2 },
  headerName: { fontFamily: font.bold, fontSize: 17, color: colors.text },
  headerSub: { fontFamily: font.regular, fontSize: 12.5, color: colors.textMuted, marginTop: 1 },
  callBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: { padding: spacing.lg, paddingBottom: spacing.md, flexGrow: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: spacing.xxxl },
  emptyText: { fontFamily: font.medium, fontSize: 15, color: colors.textFaint },
  permBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.momSoft,
  },
  permText: { flex: 1, fontFamily: font.medium, fontSize: 12.5, color: colors.text },
  permAction: { fontFamily: font.bold, fontSize: 12.5, color: colors.brand },
  recHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  recDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.danger },
  recText: { fontFamily: font.medium, fontSize: 12.5, color: colors.textMuted },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  plusBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === "ios" ? 11 : 8,
    paddingBottom: Platform.OS === "ios" ? 11 : 8,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: font.regular,
    fontSize: 15.5,
    color: colors.text,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  micActive: { backgroundColor: colors.danger },
  toast: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: colors.text,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
  },
  toastText: { fontFamily: font.semibold, fontSize: 13.5, color: colors.surface },
});
