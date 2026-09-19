import React from "react";
import { View } from "react-native";

export function TabBarIcon({ color, round }: { color: string; round?: boolean }) {
  return (
    <View
      style={{
        width: 17,
        height: 17,
        borderWidth: 1.5,
        borderColor: color,
        borderRadius: round ? 999 : 0,
      }}
    />
  );
}
