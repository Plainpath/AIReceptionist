import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { makeTheme, Theme, ThemeMode } from "./tokens";

const STORAGE_KEY = "tradie-quotes/theme-mode";

const ThemeContext = createContext<Theme>(makeTheme("#5980a6", "light"));
const ThemeModeContext = createContext<{ mode: ThemeMode; setMode: (m: ThemeMode) => void }>({
  mode: "light",
  setMode: () => {},
});

export function ThemeProvider({ accent, children }: { accent: string; children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(systemScheme === "dark" ? "dark" : "light");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === "light" || saved === "dark") setModeState(saved);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY, m).catch(() => {});
  };

  const theme = useMemo(() => makeTheme(accent || "#5980a6", mode), [accent, mode]);

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={theme}>
      <ThemeModeContext.Provider value={{ mode, setMode }}>{children}</ThemeModeContext.Provider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useThemeMode() {
  return useContext(ThemeModeContext);
}
