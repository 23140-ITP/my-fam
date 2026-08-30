import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { api, FamilySettings } from "@/src/lib/api";
import type { PersonaKey } from "@/src/constants/theme";

const DEFAULT: FamilySettings = {
  user_name: "friend",
  mom_name: "Mom",
  dad_name: "Dad",
  mom_warmth: "balanced",
  dad_warmth: "balanced",
  mom_voice: "coral",
  dad_voice: "onyx",
};

type Ctx = {
  settings: FamilySettings;
  refresh: () => Promise<void>;
  update: (partial: Partial<FamilySettings>) => Promise<void>;
  nameFor: (p: PersonaKey) => string;
  initialFor: (p: PersonaKey) => string | undefined;
};

const FamilyContext = createContext<Ctx>({
  settings: DEFAULT,
  refresh: async () => {},
  update: async () => {},
  nameFor: () => "",
  initialFor: () => undefined,
});

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<FamilySettings>(DEFAULT);

  const refresh = useCallback(async () => {
    try {
      setSettings(await api.settings());
    } catch {
      /* keep defaults */
    }
  }, []);

  const update = useCallback(async (partial: Partial<FamilySettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
    try {
      const saved = await api.updateSettings(partial);
      setSettings(saved);
    } catch {
      /* optimistic value already applied */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const nameFor = useCallback(
    (p: PersonaKey) => (p === "mom" ? settings.mom_name : p === "dad" ? settings.dad_name : "Family group"),
    [settings],
  );

  const initialFor = useCallback(
    (p: PersonaKey) =>
      p === "mom"
        ? (settings.mom_name[0] || "M").toUpperCase()
        : p === "dad"
          ? (settings.dad_name[0] || "D").toUpperCase()
          : undefined,
    [settings],
  );

  return (
    <FamilyContext.Provider value={{ settings, refresh, update, nameFor, initialFor }}>
      {children}
    </FamilyContext.Provider>
  );
}

export const useFamily = () => useContext(FamilyContext);
