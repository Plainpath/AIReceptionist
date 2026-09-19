function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHex(r: number, g: number, b: number) {
  const c = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Linear sRGB mix — a lightweight stand-in for CSS `color-mix(in oklch, …)`. */
export function mix(hex: string, toward: "white" | "black", amount: number) {
  const { r, g, b } = hexToRgb(hex);
  const target = toward === "white" ? 255 : 0;
  const t = 1 - amount;
  return rgbToHex(r * amount + target * t, g * amount + target * t, b * amount + target * t);
}

export function accentRamp(accent: string) {
  return {
    accent,
    100: mix(accent, "white", 0.13),
    200: mix(accent, "white", 0.26),
    300: mix(accent, "white", 0.42),
    400: mix(accent, "white", 0.58),
    500: mix(accent, "white", 0.78),
    600: mix(accent, "black", 0.88),
    700: mix(accent, "black", 0.72),
    800: mix(accent, "black", 0.55),
    900: mix(accent, "black", 0.34),
  };
}
