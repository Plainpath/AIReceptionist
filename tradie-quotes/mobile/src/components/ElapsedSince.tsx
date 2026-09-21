import React, { useEffect, useState } from "react";
import { Text, TextStyle } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

function format(ms: number) {
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Live "Xm ago" since a lead/event timestamp — ticks every 30s so the urgency
 * of an unanswered lead is visible without a manual refresh. */
export function ElapsedSince({ date, style }: { date: string; style?: TextStyle }) {
  const theme = useTheme();
  const [, forceTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const ms = Date.now() - new Date(date).getTime();
  const urgent = ms > 15 * 60 * 1000;

  return (
    <Text style={[{ fontFamily: theme.fonts.bodyMedium, color: urgent ? theme.colors.accent[800] : theme.colors.neutral[600] }, style]}>
      {format(ms)}
    </Text>
  );
}
