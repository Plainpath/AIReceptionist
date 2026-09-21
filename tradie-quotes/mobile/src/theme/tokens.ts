import { accentRamp } from "./colorMix";

export type ThemeMode = "light" | "dark";

export const fonts = {
  heading: "BarlowCondensed_600SemiBold",
  headingRegular: "BarlowCondensed_400Regular",
  body: "Barlow_400Regular",
  bodyMedium: "Barlow_500Medium",
  bodyBold: "Barlow_700Bold",
};

export const space = { 1: 3, 2: 7, 3: 10, 4: 14, 6: 20, 8: 27 };
export const radius = { sm: 6, md: 10, lg: 16, xl: 24, full: 999 };

// Light: Material Design / skeuomorphic-light — warm paper background,
// elevated white surfaces, soft realistic shadows standing in for physical
// layers. Dark: same paper-and-shadow language on a navy "device screen at
// night" ground, tuned to match — low-numbered neutrals sit close to the
// background (subtle fills/tracks), high-numbered ones read as light text.
const palettes: Record<ThemeMode, { bg: string; surface: string; text: string; divider: string; neutral: Record<number, string>; shadowColor: string }> = {
  light: {
    bg: "#efece5",
    surface: "#ffffff",
    text: "#221f1a",
    divider: "rgba(34,31,26,0.09)",
    shadowColor: "#1a1712",
    neutral: {
      100: "#f7f6f3",
      200: "#ece9e3",
      300: "#dcd8d0",
      400: "#c3bdb2",
      500: "#a49d90",
      600: "#847c6e",
      700: "#655e52",
      800: "#453f37",
      900: "#2a2620",
    },
  },
  dark: {
    bg: "#0e1320",
    surface: "#171f31",
    text: "#f4f6fb",
    divider: "rgba(255,255,255,0.09)",
    shadowColor: "#000000",
    neutral: {
      100: "#1a2132",
      200: "#232c40",
      300: "#2c3650",
      400: "#3a4560",
      500: "#4c5770",
      600: "#8089a0",
      700: "#9aa3b8",
      800: "#c3cbdc",
      900: "#f4f6fb",
    },
  },
};

/** Realistic paper-layer shadows (elevation 0–4), cross-platform: classic
 * shadow* for iOS/Android + boxShadow for RN Web / new-arch native. */
function makeElevation(shadowColor: string) {
  return function elevation(level: 0 | 1 | 2 | 3 | 4) {
    const presets = {
      0: { blur: 0, y: 0, opacity: 0 },
      1: { blur: 3, y: 1, opacity: 0.1 },
      2: { blur: 8, y: 2, opacity: 0.12 },
      3: { blur: 16, y: 4, opacity: 0.14 },
      4: { blur: 28, y: 8, opacity: 0.18 },
    } as const;
    const p = presets[level];
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(shadowColor.slice(i, i + 2), 16));
    return {
      shadowColor,
      shadowOffset: { width: 0, height: p.y },
      shadowOpacity: p.opacity,
      shadowRadius: p.blur,
      elevation: level * 2,
      boxShadow: p.opacity ? `0px ${p.y}px ${p.blur}px rgba(${r},${g},${b},${p.opacity})` : undefined,
    };
  };
}

export function makeTheme(accentHex: string, mode: ThemeMode = "light") {
  const accent = accentRamp(accentHex);
  const base = palettes[mode];
  return {
    mode,
    colors: {
      bg: base.bg,
      surface: base.surface,
      text: base.text,
      divider: base.divider,
      neutral: base.neutral,
      accent,
    },
    fonts,
    space,
    radius,
    elevation: makeElevation(base.shadowColor),
  };
}

export type Theme = ReturnType<typeof makeTheme>;
