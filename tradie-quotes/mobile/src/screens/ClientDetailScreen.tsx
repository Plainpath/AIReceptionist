import React from "react";
import { ActivityIndicator, Linking, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { useClient } from "../api/hooks";
import { Tag } from "../components/Tag";
import { BlueprintBox } from "../components/Blueprint";
import { Button } from "../components/Button";
import { Toast, useToast } from "../components/Toast";
import { aud } from "../lib/format";
import type { RootScreenProps } from "../navigation/types";

export function ClientDetailScreen({ route, navigation }: RootScreenProps<"ClientDetail">) {
  const theme = useTheme();
  const { clientId } = route.params;
  const client = useClient(clientId);
  const { toast, flash } = useToast();

  if (client.isLoading || !client.data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg, justifyContent: "center" }}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const c = client.data;

  const onDirections = () => {
    if (!c.address) return flash("No address on file for this client");
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c.address)}`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Button label="‹ Back" variant="secondary" minHeight={36} onPress={() => navigation.goBack()} />
        <Text style={{ fontFamily: theme.fonts.body, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: theme.colors.neutral[600] }}>
          Client
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
          <Text style={{ fontFamily: theme.fonts.heading, fontWeight: "600", fontSize: 30, color: theme.colors.text }}>{c.name}</Text>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.neutral[700], marginTop: 5 }}>{c.address}</Text>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 9, flexWrap: "wrap" }}>
            <Tag label="Repeat client" variant="accent" />
            <Tag label={c.origin} variant="outline" />
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <BlueprintBox style={{ flexDirection: "row" }}>
            <View style={{ flex: 1, padding: 11 }}>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 9, letterSpacing: 1.2, textTransform: "uppercase", color: theme.colors.neutral[600] }}>
                Outstanding
              </Text>
              <Text style={{ fontFamily: theme.fonts.heading, fontSize: 21, color: theme.colors.text, marginTop: 3 }}>{aud(c.outstanding)}</Text>
            </View>
            <View style={{ flex: 1, padding: 11, borderLeftWidth: 1, borderLeftColor: theme.colors.divider }}>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 9, letterSpacing: 1.2, textTransform: "uppercase", color: theme.colors.neutral[600] }}>
                Lifetime
              </Text>
              <Text style={{ fontFamily: theme.fonts.heading, fontSize: 21, color: theme.colors.text, marginTop: 3 }}>{aud(c.lifetime)}</Text>
            </View>
          </BlueprintBox>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <Button label="New quote" variant="primary" flex minHeight={44} onPress={() => navigation.navigate("QuoteBuilder", { clientId: c.id })} />
            <Button label="Call" variant="secondary" minHeight={44} onPress={() => flash(`Calling ${c.name} — the secretary will log it`)} />
            <Button label="Message" variant="secondary" minHeight={44} onPress={() => flash("Message thread opened")} />
          </View>
          <View style={{ marginTop: 8 }}>
            <Button label="Directions" variant="secondary" minHeight={44} onPress={onDirections} />
          </View>
        </View>

        <Text
          style={{
            paddingHorizontal: 16,
            paddingTop: 26,
            paddingBottom: 8,
            fontFamily: theme.fonts.body,
            fontSize: 10,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: theme.colors.neutral[700],
          }}
        >
          Activity
        </Text>
        <View style={{ paddingHorizontal: 16 }}>
          {c.activity.map((a, i) => (
            <View key={a.id} style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ width: 26, alignItems: "center" }}>
                <View style={{ width: 9, height: 9, borderWidth: 1, borderColor: theme.colors.accent.accent, marginTop: 5 }} />
                {i < c.activity.length - 1 && <View style={{ flex: 1, width: 1, backgroundColor: theme.colors.divider }} />}
              </View>
              <View style={{ flex: 1, paddingBottom: 16, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                  <Text style={{ fontFamily: theme.fonts.body, fontSize: 9.5, letterSpacing: 1, textTransform: "uppercase", color: theme.colors.accent[700] }}>
                    {a.kind}
                  </Text>
                  <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.neutral[600], marginLeft: "auto" }}>
                    {new Date(a.occurredAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                  </Text>
                </View>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 19, color: theme.colors.text, marginTop: 3 }}>
                  {a.text}
                </Text>
                {(a.quote || a.invoice) && a.amount != null && (
                  <BlueprintBox style={{ marginTop: 7, padding: 9, flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.text, flex: 1 }}>
                      {a.quote?.ref || a.invoice?.ref}
                    </Text>
                    <Text style={{ fontFamily: theme.fonts.heading, fontSize: 14, color: theme.colors.text }}>{aud(a.amount)}</Text>
                  </BlueprintBox>
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <Toast message={toast} />
    </SafeAreaView>
  );
}
