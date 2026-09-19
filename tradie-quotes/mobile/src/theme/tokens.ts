import { accentRamp } from "./colorMix";

// Ported from the Industry design system (project/_ds/…/styles.css).
export const neutral = {
  100: "#f5f5f8",
  200: "#e7e7ea",
  300: "#d4d4d7",
  400: "#b7b7ba",
  500: "#98989b",
  600: "#7a7a7d",
  700: "#5d5d60",
  800: "#424244",
  900: "#2b2b2d",
};

export const base = {
  bg: "#f2f2f3",
  surface: "#e9e9ea",
  text: "#1d1f20",
  divider: "rgba(29,31,32,0.16)",
};

export const fonts = {
  heading: "BarlowCondensed_600SemiBold",
  headingRegular: "BarlowCondensed_400Regular",
  body: "Barlow_400Regular",
  bodyMedium: "Barlow_500Medium",
  bodyBold: "Barlow_700Bold",
};

export const space = { 1: 3, 2: 7, 3: 10, 4: 14, 6: 20, 8: 27 };
export const radius = { sm: 2, md: 4, lg: 7 };

export function makeTheme(accentHex: string) {
  const accent = accentRamp(accentHex);
  return {
    colors: {
      bg: base.bg,
      surface: base.surface,
      text: base.text,
      divider: base.divider,
      neutral,
      accent,
    },
    fonts,
    space,
    radius,
  };
}

export type Theme = ReturnType<typeof makeTheme>;
