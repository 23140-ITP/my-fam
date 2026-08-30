import { useCallback, useState } from "react";
import { Platform } from "react-native";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

import { API_BASE } from "@/src/lib/api";

export type StartResult = { ok: boolean; blocked?: boolean };

export function useRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);
  const [busy, setBusy] = useState(false);

  const start = useCallback(async (): Promise<StartResult> => {
    try {
      let perm = await AudioModule.getRecordingPermissionsAsync();
      if (!perm.granted && perm.canAskAgain !== false) {
        perm = await AudioModule.requestRecordingPermissionsAsync();
      }
      if (!perm.granted) {
        return { ok: false, blocked: perm.canAskAgain === false };
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }, [recorder]);

  const stopAndTranscribe = useCallback(async (): Promise<string> => {
    try {
      await recorder.stop();
    } catch {
      return "";
    }
    const uri = recorder.uri;
    if (!uri) return "";
    setBusy(true);
    try {
      const form = new FormData();
      if (Platform.OS === "web") {
        const blob = await (await fetch(uri)).blob();
        form.append("file", blob, "recording.webm");
      } else {
        form.append("file", { uri, name: "recording.m4a", type: "audio/m4a" } as any);
      }
      const res = await fetch(`${API_BASE}/transcribe`, { method: "POST", body: form });
      if (!res.ok) return "";
      const json = await res.json();
      return (json.text || "").trim();
    } catch {
      return "";
    } finally {
      setBusy(false);
    }
  }, [recorder]);

  return { isRecording: state.isRecording, busy, start, stopAndTranscribe };
}
