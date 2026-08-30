import type { PersonaKey } from "@/src/constants/theme";

const ROOT = process.env.EXPO_PUBLIC_BACKEND_URL;
export const API_BASE = `${ROOT}/api`;

export type Message = {
  id: string;
  conversation: PersonaKey;
  sender: "user" | "mom" | "dad";
  text: string;
  created_at: string;
};

export type Care = {
  date: string;
  meals: { label: string; time: string }[];
  water_glasses: number;
  water_goal: number;
  slept_well: boolean | null;
  sleep_hours: number | null;
};

export type Conversation = {
  conversation: PersonaKey;
  last_text: string;
  last_sender: string;
  last_time: string | null;
  unread: boolean;
};

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`);
  return res.json();
}

export const api = {
  home: () => getJSON<{ name: string; care: Care; conversations: Conversation[] }>("/home"),
  care: () => getJSON<Care>("/care"),
  addWater: (delta: number) => postJSON<Care>("/care/water", { delta }),
  toggleMeal: (label: string) => postJSON<Care>("/care/meal", { label }),
  setSleep: (slept_well: boolean, hours?: number) =>
    postJSON<Care>("/care/sleep", { slept_well, hours }),
  messages: (conversation: PersonaKey) =>
    getJSON<{ messages: Message[] }>(`/messages?conversation=${conversation}`),
  chat: (conversation: PersonaKey, text: string) =>
    postJSON<{ replies: Message[] }>("/chat", { conversation, text }),
  conversations: () => getJSON<{ conversations: Conversation[] }>("/conversations"),
  profile: () => getJSON<{ name: string }>("/profile"),
  setProfile: (name: string) => postJSON<{ name: string }>("/profile", { name }),
  ttsUrl: (persona: PersonaKey, text: string) =>
    `${API_BASE}/tts?persona=${persona}&text=${encodeURIComponent(text.slice(0, 900))}`,
};
