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

export type FamilySettings = {
  user_name: string;
  mom_name: string;
  dad_name: string;
  mom_warmth: string;
  dad_warmth: string;
  mom_voice: string;
  dad_voice: string;
};

export type Note = {
  id: string;
  conversation: PersonaKey;
  sender: "mom" | "dad";
  text: string;
  message_id: string;
  created_at: string;
  saved_at: string;
};

export type Checkin = {
  date: string;
  responded: boolean;
  response: string | null;
  mom_prompt: string;
  dad_prompt: string;
  mom_name: string;
  dad_name: string;
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

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE ${path} -> ${res.status}`);
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
  settings: () => getJSON<FamilySettings>("/settings"),
  updateSettings: (partial: Partial<FamilySettings>) => postJSON<FamilySettings>("/settings", partial),
  checkin: () => getJSON<Checkin>("/checkin"),
  respondCheckin: (response: string) => postJSON<{ ok: boolean }>("/checkin/respond", { response }),
  notes: () => getJSON<{ notes: Note[] }>("/notes"),
  addNote: (note: {
    conversation: PersonaKey;
    sender: "mom" | "dad";
    text: string;
    message_id: string;
    created_at?: string;
  }) => postJSON<Note>("/notes", note),
  deleteNote: (id: string) => del<{ ok: boolean }>(`/notes/${id}`),
  ttsUrl: (persona: PersonaKey, text: string, voice?: string) =>
    `${API_BASE}/tts?persona=${persona}&text=${encodeURIComponent(text.slice(0, 900))}${
      voice ? `&voice=${voice}` : ""
    }`,
};
