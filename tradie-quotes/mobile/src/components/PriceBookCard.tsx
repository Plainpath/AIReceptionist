import React from "react";
import { Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useTheme } from "../theme/ThemeProvider";
import { BlueprintBox } from "./Blueprint";
import { aud } from "../lib/format";
import type { PriceBookItem } from "../api/types";

export function PriceBookCard({
  item,
  onMove,
  onDrop,
}: {
  item: PriceBookItem;
  onMove: (absoluteX: number, absoluteY: number) => void;
  onDrop: (item: PriceBookItem, absoluteX: number, absoluteY: number) => void;
}) {
  const theme = useTheme();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const dragging = useSharedValue(0);

  const pan = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .failOffsetX([-15, 15])
    .onStart(() => {
      dragging.value = 1;
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
      runOnJS(onMove)(e.absoluteX, e.absoluteY);
    })
    .onEnd((e) => {
      runOnJS(onDrop)(item, e.absoluteX, e.absoluteY);
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      dragging.value = 0;
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: dragging.value ? 1.05 : 1 }],
    zIndex: dragging.value ? 50 : 1,
    elevation: dragging.value ? 8 : 0,
    shadowOpacity: dragging.value ? 0.25 : 0,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={style}>
        <BlueprintBox style={{ width: 136, padding: 10, backgroundColor: theme.colors.surface }}>
          <View style={{ flexDirection: "row", gap: 2, marginBottom: 7 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ width: 3, height: 3, backgroundColor: theme.colors.neutral[500] }} />
            ))}
          </View>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, lineHeight: 16, minHeight: 33, color: theme.colors.text }}>
            {item.label}
          </Text>
          <Text style={{ fontFamily: theme.fonts.heading, fontSize: 15, color: theme.colors.text, marginTop: 6 }}>
            {aud(item.rate)} / {item.unit}
          </Text>
        </BlueprintBox>
      </Animated.View>
    </GestureDetector>
  );
}
