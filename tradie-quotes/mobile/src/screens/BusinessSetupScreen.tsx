import React, { useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { useBusiness, useUpdateBusiness } from "../api/hooks";
import { BlueprintBox } from "../components/Blueprint";
import { Tag } from "../components/Tag";
import type { TabScreenProps } from "../navigation/types";

function Field({ label, value, onChangeText, onBlur }: { label: string; value: string; onChangeText: (v: string) => void; onBlur: () => void }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 5 }}>
      <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.neutral[700] }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        style={{
          minHeight: 36,
          paddingHorizontal: 10,
          borderWidth: 1,
          borderColor: theme.colors.divider,
          backgroundColor: theme.colors.surface,
          fontFamily: theme.fonts.body,
          fontSize: 14,
          color: theme.colors.text,
        }}
      />
    </View>
  );
}

export function BusinessSetupScreen({}: TabScreenProps<"Business">) {
  const theme = useTheme();
  const business = useBusiness();
  const update = useUpdateBusiness();
  const [local, setLocal] = useState<Record<string, string>>({});

  if (business.isLoading || !business.data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg, justifyContent: "center" }}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }
  const b = business.data;

  const val = (key: string, fallback: string) => local[key] ?? fallback;
  const commit = (key: "name" | "abn" | "licence" | "bsb" | "accountNumber") => {
    const v = local[key];
    if (v != null && v !== (b as any)[key]) update.mutate({ [key]: v } as any);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <Text style={{ fontFamily: theme.fonts.heading, fontWeight: "600", fontSize: 26, color: theme.colors.text }}>Business</Text>

        <BlueprintBox style={{ marginTop: 16, padding: 14, flexDirection: "row", gap: 13, alignItems: "center" }}>
          <View style={{ width: 62, height: 62, backgroundColor: theme.colors.neutral[200], alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 10, color: theme.colors.neutral[700] }}>logo</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: theme.fonts.heading, fontSize: 18, color: theme.colors.text }}>{b.name}</Text>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.neutral[600], marginTop: 2 }}>
              Brand colour and logo carry through to every PDF
            </Text>
          </View>
        </BlueprintBox>

        <View style={{ marginTop: 20, gap: 12 }}>
          <Field label="Trading name" value={val("name", b.name)} onChangeText={(v) => setLocal((s) => ({ ...s, name: v }))} onBlur={() => commit("name")} />
          <Field label="ABN" value={val("abn", b.abn)} onChangeText={(v) => setLocal((s) => ({ ...s, abn: v }))} onBlur={() => commit("abn")} />
          <Field
            label="Electrical licence"
            value={val("licence", b.licence || "")}
            onChangeText={(v) => setLocal((s) => ({ ...s, licence: v }))}
            onBlur={() => commit("licence")}
          />
          <View style={{ gap: 5 }}>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.neutral[700] }}>GST</Text>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.text, paddingVertical: 8 }}>
              {b.gstRegistered ? "Registered · 10% on all items" : "Not registered"}
            </Text>
          </View>
          <Field
            label="Bank — BSB"
            value={val("bsb", b.bsb || "")}
            onChangeText={(v) => setLocal((s) => ({ ...s, bsb: v }))}
            onBlur={() => commit("bsb")}
          />
          <Field
            label="Bank — Account number"
            value={val("accountNumber", b.accountNumber || "")}
            onChangeText={(v) => setLocal((s) => ({ ...s, accountNumber: v }))}
            onBlur={() => commit("accountNumber")}
          />
        </View>

        <Text
          style={{
            fontFamily: theme.fonts.body,
            fontSize: 10,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: theme.colors.neutral[700],
            marginTop: 24,
            marginBottom: 9,
          }}
        >
          Connected services
        </Text>
        <BlueprintBox>
          {b.services.map((s) => (
            <View
              key={s.id}
              style={{ padding: 13, borderTopWidth: 1, borderTopColor: theme.colors.divider, flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 13.5, color: theme.colors.text }}>{s.name}</Text>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.neutral[600], marginTop: 2 }}>{s.note}</Text>
              </View>
              <Tag label={s.state} variant={s.state === "Not set" ? "neutral" : "accent"} />
            </View>
          ))}
        </BlueprintBox>
      </ScrollView>
    </SafeAreaView>
  );
}
