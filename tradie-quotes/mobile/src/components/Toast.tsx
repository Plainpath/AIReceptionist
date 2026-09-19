import React, { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { BlueprintBox } from "./Blueprint";

export function Toast({ message }: { message: string | null }) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (message) {
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    } else {
      Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }).start();
    }
  }, [message]);

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: "absolute", left: 16, right: 16, bottom: 96, zIndex: 90, opacity }}
    >
      <BlueprintBox style={{ backgroundColor: theme.colors.accent[900], padding: 12 }}>
        <Text style={{ color: "#fff", fontFamily: theme.fonts.body, fontSize: 12.5, lineHeight: 17 }}>{message}</Text>
      </BlueprintBox>
    </Animated.View>
  );
}

export function useToast() {
  const [toast, setToast] = React.useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (msg: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(msg);
    timer.current = setTimeout(() => setToast(null), 2600);
  };
  return { toast, flash };
}
