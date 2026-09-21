import React from "react";
import { Pressable, Text, StyleSheet, ViewStyle, GestureResponderEvent } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

type Variant = "primary" | "secondary" | "ghost";

export function Button({
  label,
  onPress,
  variant = "secondary",
  style,
  flex,
  minHeight = 44,
  icon,
  disabled,
  children,
}: {
  label?: string;
  onPress?: (e: GestureResponderEvent) => void;
  variant?: Variant;
  style?: ViewStyle;
  flex?: boolean;
  minHeight?: number;
  icon?: React.ReactNode;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  const bg = variant === "primary" ? theme.colors.accent.accent : variant === "ghost" ? "transparent" : theme.colors.surface;
  const borderColor = variant === "secondary" ? theme.colors.divider : "transparent";
  const color = variant === "primary" ? "#fff" : variant === "ghost" ? theme.colors.accent.accent : theme.colors.text;
  const restingElevation = variant === "primary" ? 2 : variant === "secondary" ? 1 : 0;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderColor,
          borderWidth: variant === "secondary" ? 1 : 0,
          borderRadius: variant === "ghost" ? theme.radius.sm : theme.radius.full,
          minHeight,
          opacity: disabled ? 0.45 : 1,
          flex: flex ? 1 : undefined,
          transform: [{ scale: pressed && !disabled ? 0.97 : 1 }],
        },
        variant !== "ghost"
          ? theme.elevation((pressed && !disabled ? Math.max(0, restingElevation - 1) : restingElevation) as 0 | 1 | 2)
          : null,
        style,
      ]}
    >
      {icon}
      {children ? children : label ? <Text style={{ fontFamily: theme.fonts.heading, fontSize: 14, color }}>{label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16,
  },
});
