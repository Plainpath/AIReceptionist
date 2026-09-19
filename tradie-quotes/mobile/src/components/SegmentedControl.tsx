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
    <View style={{ flexDirection: "row", borderWidth: 1, borderColor: theme.colors.divider }}>
      {options.map((opt, i) => {
        const on = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 8,
              borderLeftWidth: i === 0 ? 0 : 1,
              borderLeftColor: theme.colors.divider,
              backgroundColor: on ? theme.colors.accent.accent : "transparent",
            }}
          >
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: on ? "#fff" : theme.colors.text }}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
