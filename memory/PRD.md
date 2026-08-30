# My Fam — Product Requirements Document

## Original Problem Statement
Build "My Fam," an AI family app for people who miss having their parents around. It should feel
like having Mom and Dad available whenever you need care, advice, encouragement, or someone to talk
to. Tracks whether the user has eaten, had water, and slept well. Three conversations: Mom, Dad, and
a Family group chat where both reply separately with two perspectives. iMessage-inspired chat UX,
warm voice-call screens, care tracker, and a no-login demo that feels alive.

## User Choices
- AI brain: OpenAI **GPT-5.6** using the user's **external** OpenAI API key.
- Voice call: **real** OpenAI TTS voices (gpt-4o-mini-tts) + Whisper (whisper-1) STT.
- Persistence: **backend** (MongoDB) for chats and care check-ins.
- Demo vibe: balanced Mom + Dad.
- Look clean like WhatsApp; colors/fonts warm like iMessage.

## Architecture
- **Frontend:** Expo Router (SDK 54), React Native. Bottom tabs (Home, Chats, Care, Profile) with
  iOS-26 NativeTabs gate + classic Tabs fallback. Stack routes: `chat/[persona]`, `call/[persona]`.
  Reanimated animations, react-native-svg care rings, react-native-keyboard-controller for chat
  keyboard, expo-audio for record/playback, Plus Jakarta Sans via expo-font.
- **Backend:** FastAPI + Motor (MongoDB). All routes under `/api`. OpenAI Python SDK with the
  user key kept server-side only. Chat=gpt-5.6, TTS=gpt-4o-mini-tts (Mom=coral, Dad=onyx),
  STT=whisper-1. Warm fallback replies if the key is missing so the demo never breaks.
- **Data (user_id="demo"):** `profiles`, `care_logs` (per-day meals/water/sleep), `messages`
  (conversation mom|dad|family, sender user|mom|dad). Seeded on first boot (idempotent).

## Design System
Ivory #F8F6F1 surface, white cards, dark-green #1F2A26 text, sage #3E6B62 brand/user bubbles,
coral #E59B86 Mom, blue #6E8FC4 Dad, clay #C08A61 group. See `/app/design_guidelines.json`.

## Implemented (2026-06)
- Home: time-based greeting, 3 animated care rings (Meals/Water/Sleep), contextual nudge, recent
  family chat rows with unread dots, pull-to-refresh.
- Chats list; direct Mom & Dad chats and Family group chat (iMessage bubbles, timestamps, typing
  indicators, quick replies, text input + mic, call button). Group shows Mom then Dad staggered.
- Care screen: water +/- (clamped 0–12), meal toggle chips, sleep well/poor, confirmation toast,
  haptics — all persisted to backend.
- Voice call screen: full-bleed watercolor bg, large avatar w/ pulse, connect→greeting→listening→
  thinking→speaking states, animated waveform, live transcript, Sound/Talk/End; push-to-talk loop
  (record → whisper → gpt-5.6 → TTS playback).
- Profile: editable name, AI-companion disclaimer, haptics toggle.
- OpenAI integration live (chat, TTS, STT). 19/19 backend tests + full frontend pass (iteration_1).

## User Personas
- Young adult / student living away from home who misses parental check-ins and encouragement.
- Anyone wanting a warm daily wellbeing nudge (food/water/sleep) with an emotional companion.

## Backlog (prioritized)
- **P1:** Real-device build to fully exercise mic recording + background audio; per-conversation
  read receipts; daily care streaks/history.
- **P2:** Editable Mom/Dad personalities & voices; shareable "note from Mom/Dad"; weekly care recap.

## Next Tasks
- Await user feedback from preview; iterate on tone/persona depth and care history if requested.
