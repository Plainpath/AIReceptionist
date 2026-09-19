import React, { createContext, useContext, useMemo } from "react";
import { makeTheme, Theme } from "./tokens";

const ThemeContext = createContext<Theme>(makeTheme("#5980a6"));

export function ThemeProvider({ accent, children }: { accent: string; children: React.ReactNode }) {
  const theme = useMemo(() => makeTheme(accent || "#5980a6"), [accent]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
