import React from "react";
import { Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useTheme } from "../theme/ThemeProvider";
import { BlueprintBox } from "./Blueprint";
import { Button } from "./Button";
import type { Job } from "../api/types";

export function JobCard({
  job,
  onMove,
  onDrop,
  onOpenDetails,
}: {
  job: Job;
  onMove: (absoluteX: number, absoluteY: number) => void;
  onDrop: (job: Job, absoluteX: number, absoluteY: number) => void;
  onOpenDetails: (job: Job) => void;
}) {
  const theme = useTheme();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const dragging = useSharedValue(0);

  const time = new Date(job.scheduledStart).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });

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
      runOnJS(onDrop)(job, e.absoluteX, e.absoluteY);
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      dragging.value = 0;
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: dragging.value ? 1.04 : 1 }],
    zIndex: dragging.value ? 50 : 1,
    elevation: dragging.value ? 8 : 0,
  }));

  return (
    <View style={{ flexDirection: "row", alignItems: "stretch", gap: 6, marginBottom: 8 }}>
      <GestureDetector gesture={pan}>
        <Animated.View style={[{ flex: 1 }, style]}>
          <BlueprintBox elevation={2} style={{ padding: 10, flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: theme.colors.accent.accent }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: theme.fonts.heading, fontSize: 13.5, color: theme.colors.text }} numberOfLines={1}>
                  {job.title}
                </Text>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.neutral[600], marginTop: 1 }} numberOfLines={1}>
                  {time} · {job.client.name}
                </Text>
              </View>
            </View>
          </BlueprintBox>
        </Animated.View>
      </GestureDetector>
      <Button
        variant="secondary"
        minHeight={0}
        style={{ width: 36, paddingHorizontal: 0 }}
        onPress={() => onOpenDetails(job)}
      >
        <Text style={{ color: theme.colors.text, fontSize: 16 }}>⋯</Text>
      </Button>
    </View>
  );
}
