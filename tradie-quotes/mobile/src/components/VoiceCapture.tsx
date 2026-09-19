import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Text, TextInput, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { BlueprintBox } from "./Blueprint";
import { Button } from "./Button";
import { Tag } from "./Tag";
import { useVoiceParse } from "../api/hooks";
import type { ParsedVoiceLine } from "../api/types";

let SpeechModule: typeof import("expo-speech-recognition") | null = null;
try {
  // Only present in a custom dev client / standalone build (see app.json plugins).
  SpeechModule = require("expo-speech-recognition");
} catch {
  SpeechModule = null;
}

type Mode = "idle" | "listening" | "typing" | "review";

function Bar({ delay }: { delay: number }) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1, duration: 450, delay, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.25, duration: 450, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={{ width: 3, height: 30, backgroundColor: theme.colors.accent.accent, transform: [{ scaleY: scale }] }} />;
}

export function VoiceCapture({ quoteId, onAccept, onError }: { quoteId: string; onAccept: (lines: ParsedVoiceLine[]) => void; onError: (msg: string) => void }) {
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>("idle");
  const [heard, setHeard] = useState("");
  const [typed, setTyped] = useState("");
  const [parsed, setParsed] = useState<ParsedVoiceLine[]>([]);
  const voiceParse = useVoiceParse(quoteId);

  useEffect(() => {
    if (!SpeechModule) return;
    let subs: any[] = [];
    try {
      subs = [
        SpeechModule.ExpoSpeechRecognitionModule.addListener("result", (e: any) => {
          setHeard(e.results?.[0]?.transcript || "");
        }),
        SpeechModule.ExpoSpeechRecognitionModule.addListener("error", () => {
          onError("Couldn't hear that — try typing it instead.");
          setMode("typing");
        }),
      ];
    } catch {
      SpeechModule = null;
    }
    return () => subs.forEach((s: any) => s?.remove?.());
  }, []);

  const finishParsing = async (transcript: string) => {
    if (!transcript.trim()) {
      setMode("idle");
      return;
    }
    try {
      const res = await voiceParse.mutateAsync(transcript);
      setParsed(res.parsed);
      setHeard(transcript);
      setMode("review");
    } catch {
      onError("Couldn't parse that line — add it manually.");
      setMode("idle");
    }
  };

  const startVoice = async () => {
    if (!SpeechModule) {
      setMode("typing");
      return;
    }
    try {
      const perm = await SpeechModule.ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        setMode("typing");
        return;
      }
      setHeard("");
      setMode("listening");
      SpeechModule.ExpoSpeechRecognitionModule.start({ lang: "en-AU", interimResults: true, continuous: true });
    } catch {
      setMode("typing");
    }
  };

  const stopVoice = async () => {
    try {
      SpeechModule?.ExpoSpeechRecognitionModule.stop();
    } catch {}
    await finishParsing(heard);
  };

  const submitTyped = async () => {
    await finishParsing(typed);
    setTyped("");
  };

  const accept = () => {
    onAccept(parsed);
    setMode("idle");
    setHeard("");
    setParsed([]);
  };

  const discard = () => {
    setMode("idle");
    setHeard("");
    setParsed([]);
  };

  return (
    <BlueprintBox style={{ marginTop: 16, padding: 12 }}>
      {mode === "idle" && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Button variant="primary" minHeight={46} style={{ width: 46, paddingHorizontal: 0, borderRadius: 0 }} onPress={startVoice}>
            <View style={{ width: 6, height: 11, backgroundColor: "#fff", borderRadius: 3 }} />
          </Button>
          <Text style={{ flex: 1, fontFamily: theme.fonts.body, fontSize: 12.5, lineHeight: 18, color: theme.colors.neutral[700] }}>
            Hold to speak a whole line item —{"\n"}
            <Text style={{ fontStyle: "italic", color: theme.colors.neutral[600] }}>
              "two hours labour at ninety plus a switchboard"
            </Text>
          </Text>
        </View>
      )}

      {mode === "listening" && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3, height: 34 }}>
            {[0, 90, 180, 270, 360, 450, 540].map((d) => (
              <Bar key={d} delay={d} />
            ))}
          </View>
          <Text style={{ flex: 1, fontFamily: theme.fonts.body, fontSize: 13, minHeight: 34, color: theme.colors.text }}>{heard}</Text>
          <Button label="Stop" variant="secondary" minHeight={34} onPress={stopVoice} />
        </View>
      )}

      {mode === "typing" && (
        <View style={{ gap: 9 }}>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.neutral[600] }}>
            Type the line item, e.g. "two hours labour at ninety plus a switchboard"
          </Text>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            placeholder="Two hours labour at ninety..."
            style={{ minHeight: 40, borderWidth: 1, borderColor: theme.colors.divider, paddingHorizontal: 10, fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text }}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button label="Parse" variant="primary" flex minHeight={38} onPress={submitTyped} disabled={!typed.trim()} />
            <Button label="Cancel" variant="secondary" minHeight={38} onPress={() => setMode("idle")} />
          </View>
        </View>
      )}

      {mode === "review" && (
        <View style={{ gap: 9 }}>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.neutral[600] }}>Heard: "{heard}"</Text>
          {parsed.map((p, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: theme.colors.divider }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text }}>{p.label}</Text>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.neutral[600], marginTop: 2 }}>{p.detail}</Text>
              </View>
              <Tag
                label={p.confidence}
                bg={p.confidence === "High" ? theme.colors.accent[100] : theme.colors.neutral[200]}
                fg={p.confidence === "High" ? theme.colors.accent[800] : theme.colors.neutral[800]}
              />
            </View>
          ))}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
            <Button label={`Add ${parsed.length} item${parsed.length === 1 ? "" : "s"}`} variant="primary" flex minHeight={38} onPress={accept} />
            <Button label="Discard" variant="secondary" minHeight={38} onPress={discard} />
          </View>
        </View>
      )}
    </BlueprintBox>
  );
}
