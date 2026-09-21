import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: "row",
          backgroundColor: theme.colors.neutral[200],
          borderRadius: theme.radius.full,
          padding: 3,
          gap: 3,
        },
        theme.elevation(1),
      ]}
    >
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              {
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 8,
                borderRadius: theme.radius.full,
                backgroundColor: on ? theme.colors.surface : "transparent",
              },
              on ? theme.elevation(1) : null,
            ]}
          >
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: on ? theme.colors.accent[800] : theme.colors.neutral[700] }}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
