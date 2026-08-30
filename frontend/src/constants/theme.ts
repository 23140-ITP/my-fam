import { Platform } from "react-native";

export const colors = {
  surface: "#F8F6F1",
  card: "#FFFFFF",
  tertiary: "#EAE6DF",
  text: "#1F2A26",
  textMuted: "#6B756F",
  textFaint: "#9AA39F",
  brand: "#3E6B62",
  brandDark: "#2F534C",
  brandSoft: "#E7EEEB",
  mom: "#E59B86",
  momDeep: "#CE7C64",
  momSoft: "#FBEDE7",
  dad: "#6E8FC4",
  dadDeep: "#54739F",
  dadSoft: "#E8EEF7",
  clay: "#C08A61",
  claySoft: "#F4E9DF",
  border: "#EAE6DF",
  borderStrong: "#CFC9BD",
  white: "#FFFFFF",
  danger: "#D96A5B",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };

export const radius = { sm: 6, md: 12, lg: 20, xl: 28, pill: 999 };

export const font = {
  regular: "Jakarta",
  medium: "Jakarta-Medium",
  semibold: "Jakarta-SemiBold",
  bold: "Jakarta-Bold",
  extrabold: "Jakarta-ExtraBold",
};

export const shadow = Platform.select({
  ios: {
    shadowColor: "#1F2A26",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  android: { elevation: 3 },
  default: {},
}) as object;

export const softShadow = Platform.select({
  ios: {
    shadowColor: "#1F2A26",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  android: { elevation: 1 },
  default: {},
}) as object;

export type PersonaKey = "mom" | "dad" | "family";

export const PERSONAS: Record<PersonaKey, {
  key: PersonaKey;
  name: string;
  color: string;
  deep: string;
  soft: string;
  bubbleText: string;
  initial: string;
  subtitle: string;
  bg: string;
  greeting: string;
}> = {
  mom: {
    key: "mom",
    name: "Mom",
    color: colors.mom,
    deep: colors.momDeep,
    soft: colors.momSoft,
    bubbleText: "#3A241C",
    initial: "M",
    subtitle: "Always here for you",
    bg: "https://images.unsplash.com/photo-1654331046252-c1a938237ca4?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1Mjh8MHwxfHNlYXJjaHwxfHxzb2Z0JTIwd2FybSUyMGNvcmFsJTIwd2F0ZXJjb2xvciUyMHRleHR1cmV8ZW58MHx8fHwxNzg4MDcxNjczfDA&ixlib=rb-4.1.0&q=85",
    greeting: "Hi sweetheart, it's so good to hear from you. How are you feeling today?",
  },
  dad: {
    key: "dad",
    name: "Dad",
    color: colors.dad,
    deep: colors.dadDeep,
    soft: colors.dadSoft,
    bubbleText: "#FFFFFF",
    initial: "D",
    subtitle: "You've got this, kiddo",
    bg: "https://images.unsplash.com/photo-1628882836842-d5ffd7c7278e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODR8MHwxfHNlYXJjaHwxfHxjYWxtJTIwc29mdCUyMGJsdWUlMjB3YXRlcmNvbG9yJTIwdGV4dHVyZXxlbnwwfHx8fDE3ODgwNzE2NzN8MA&ixlib=rb-4.1.0&q=85",
    greeting: "Hey kiddo, good to hear your voice. What's on your mind?",
  },
  family: {
    key: "family",
    name: "Family",
    color: colors.clay,
    deep: "#A6724A",
    soft: colors.claySoft,
    bubbleText: "#FFFFFF",
    initial: "F",
    subtitle: "Mom & Dad",
    bg: "https://images.unsplash.com/photo-1705837861201-dd000d929a31?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MDV8MHwxfHNlYXJjaHwxfHx3YXJtJTIwc2FnZSUyMGdyZWVuJTIwbmF0dXJhbCUyMHRleHR1cmV8ZW58MHx8fHwxNzg4MDcxNjczfDA&ixlib=rb-4.1.0&q=85",
    greeting: "",
  },
};

export const QUICK_REPLIES: Record<PersonaKey, string[]> = {
  mom: ["I miss you 💛", "I'm feeling a bit down", "Just had lunch!", "I can't sleep"],
  dad: ["I need some advice", "Work is stressful", "I did it! 🎉", "Tell me a dad joke"],
  family: ["Miss you both ❤️", "Guess what happened today", "I need a pep talk", "Sunday call?"],
};

export function greetingForTime(name: string): string {
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return `${part}, ${name}`;
}

export function formatTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}
