import { useCallback } from "react";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

import { api } from "@/src/lib/api";
import type { PersonaKey } from "@/src/constants/theme";

export function useTts() {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  const speak = useCallback(
    async (persona: PersonaKey, text: string, voice?: string) => {
      if (persona === "family") return;
      try {
        await setAudioModeAsync({ playsInSilentMode: true });
        player.replace({ uri: api.ttsUrl(persona, text, voice) });
        player.play();
      } catch {
        /* ignore playback errors (e.g. web autoplay) */
      }
    },
    [player],
  );

  const stop = useCallback(() => {
    try {
      player.pause();
    } catch {
      /* noop */
    }
  }, [player]);

  return { speak, stop, playing: !!status.playing, status };
}
