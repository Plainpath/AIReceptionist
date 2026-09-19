import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

type Variant = "accent" | "neutral" | "outline" | "custom";

export function Tag({
  label,
  variant = "neutral",
  bg,
  fg,
}: {
  label: string;
  variant?: Variant;
  bg?: string;
  fg?: string;
}) {
  const theme = useTheme();
  let background = bg;
  let color = fg;
  let borderColor: string | undefined;
  if (!background) {
    if (variant === "accent") {
      background = theme.colors.accent[100];
      color = theme.colors.accent[800];
    } else if (variant === "outline") {
      background = "transparent";
      color = theme.colors.accent.accent;
      borderColor = theme.colors.accent.accent;
    } else {
      background = theme.colors.neutral[100];
      color = theme.colors.neutral[800];
    }
  }
  return (
    <View
      style={{
        backgroundColor: background,
        borderColor,
        borderWidth: borderColor ? 1 : 0,
        paddingHorizontal: 10,
        paddingVertical: 3,
        alignSelf: "flex-start",
      }}
    >
      <Text
        style={{
          color,
          fontFamily: theme.fonts.body,
          fontSize: 10.5,
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
    </View>
  );
}
