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
  const bg =
    variant === "primary" ? theme.colors.accent.accent : variant === "ghost" ? "transparent" : "transparent";
  const borderColor =
    variant === "primary" ? theme.colors.accent.accent : variant === "ghost" ? "transparent" : theme.colors.divider;
  const color = variant === "primary" ? "#fff" : variant === "ghost" ? theme.colors.accent.accent : theme.colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderColor,
          minHeight,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
          flex: flex ? 1 : undefined,
        },
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
    borderWidth: 1,
    paddingHorizontal: 14,
  },
});
