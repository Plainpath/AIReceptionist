import React from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { useTheme } from "../theme/ThemeProvider";
import { useBusiness, useInvoices, useLeads, useQuotes } from "../api/hooks";
import { BlueprintBox } from "../components/Blueprint";
import { Tag } from "../components/Tag";
import { Button } from "../components/Button";
import { aud } from "../lib/format";
import type { TabScreenProps } from "../navigation/types";
import { useQueryClient } from "@tanstack/react-query";

type Props = TabScreenProps<"Dashboard">;

function QuotesIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path d="M11.6 3.4 3.4 11.6a1.4 1.4 0 0 0 0 2l3 3a1.4 1.4 0 0 0 2 0l8.2-8.2" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
      <Path d="M13 2 18 7" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}
function InvoicesIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path d="M5 2.5h7l3.5 3.5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
      <Path d="M6.5 11h6M6.5 14h6M6.5 8h3" stroke={color} strokeWidth={1.2} strokeLinecap="round" />
    </Svg>
  );
}
function ClientsIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Circle cx={10} cy={6.6} r={3.2} stroke={color} strokeWidth={1.4} />
      <Path d="M3.6 17c.7-3.4 3.4-5.4 6.4-5.4s5.7 2 6.4 5.4" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}
function PaymentsIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M7.3 3.6c.5-.7 1.5-1.2 2.7-1.2s2.2.5 2.7 1.2l2 3.1c.3.5.5 1.2.5 1.9v7.2a2 2 0 0 1-2 2H6.8a2 2 0 0 1-2-2V8.6c0-.7.2-1.4.5-1.9l2-3.1Z"
        stroke={color}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <Path d="M10 9.5v4.2M8.4 11h3.2" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

export function DashboardScreen({ navigation }: Props) {
  const theme = useTheme();
  const qc = useQueryClient();
  const business = useBusiness();
  const leads = useLeads();
  const quotes = useQuotes();
  const invoices = useInvoices();

  const loading = business.isLoading || leads.isLoading || quotes.isLoading || invoices.isLoading;
  const refreshing = business.isFetching || leads.isFetching || quotes.isFetching || invoices.isFetching;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["business"] });
    qc.invalidateQueries({ queryKey: ["leads"] });
    qc.invalidateQueries({ queryKey: ["quotes"] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
  };

  if (loading || !business.data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg, justifyContent: "center" }}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const owed = (invoices.data || []).reduce((s, i) => s + Math.max(0, i.totals.balance), 0);
  const overdue = (invoices.data || [])
    .filter((i) => i.status === "Overdue")
    .reduce((s, i) => s + Math.max(0, i.totals.balance), 0);
  const paid = (invoices.data || []).reduce((s, i) => s + i.paid, 0);
  const pending = Math.max(0, owed - overdue);
  const progressTotal = paid + overdue + pending || 1;

  const overdueInvoices = (invoices.data || []).filter((i) => i.status === "Overdue");
  const followUpQuotes = (quotes.data || []).filter((q) => q.status === "Sent" && q.viewedCount > 0);

  const initials = business.data.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const tiles = [
    { label: "Quotes", Icon: QuotesIcon, onPress: () => navigation.navigate("Money", { tab: "quotes" }) },
    { label: "Invoices", Icon: InvoicesIcon, onPress: () => navigation.navigate("Money", { tab: "invoices" }) },
    { label: "Clients", Icon: ClientsIcon, onPress: () => navigation.navigate("Clients") },
    { label: "Payments", Icon: PaymentsIcon, onPress: () => navigation.navigate("AccountingSummary") },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <View>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 9.5, letterSpacing: 2, textTransform: "uppercase", color: theme.colors.accent[700] }}>
              Dashboard
            </Text>
            <Text style={{ fontFamily: theme.fonts.heading, fontWeight: "600", fontSize: 26, color: theme.colors.text, marginTop: 2 }}>
              {business.data.name}
            </Text>
          </View>
          <BlueprintBox style={{ width: 42, height: 42, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: theme.fonts.heading, fontSize: 15, color: theme.colors.accent[700] }}>{initials}</Text>
          </BlueprintBox>
        </View>

        <Pressable onPress={() => navigation.navigate("Money", { tab: "invoices" })} style={{ marginTop: 20 }}>
          <BlueprintBox elevation={2} style={{ padding: 16 }}>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, fontWeight: "600", color: theme.colors.accent.accent }}>Outstanding</Text>
            <Text style={{ fontFamily: theme.fonts.heading, fontSize: 32, color: theme.colors.text, marginTop: 3 }}>{aud(owed)}</Text>
            <View style={{ flexDirection: "row", height: 8, borderRadius: theme.radius.full, overflow: "hidden", marginTop: 14, backgroundColor: theme.colors.neutral[200] }}>
              <View style={{ width: `${(paid / progressTotal) * 100}%`, backgroundColor: theme.colors.accent.accent }} />
              <View style={{ width: `${(pending / progressTotal) * 100}%`, backgroundColor: "#f2a93b" }} />
              <View style={{ flex: 1, backgroundColor: theme.colors.neutral[300] }} />
            </View>
            <View style={{ flexDirection: "row", gap: 16, marginTop: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.accent.accent }} />
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.neutral[600] }}>Paid {aud(paid)}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#f2a93b" }} />
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.neutral[600] }}>Pending {aud(pending)}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.neutral[300] }} />
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.neutral[600] }}>Overdue {aud(overdue)}</Text>
              </View>
            </View>
          </BlueprintBox>
        </Pressable>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 14 }}>
          {tiles.map(({ label, Icon, onPress }) => (
            <Pressable key={label} onPress={onPress} style={{ width: "47%" }}>
              <BlueprintBox style={{ padding: 16 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: theme.radius.md,
                    backgroundColor: `${theme.colors.accent.accent}18`,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon color={theme.colors.accent.accent} />
                </View>
                <Text style={{ fontFamily: theme.fonts.heading, fontSize: 15, color: theme.colors.text, marginTop: 16 }}>{label}</Text>
              </BlueprintBox>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 26, marginBottom: 10 }}>
          <Text style={styles(theme).sectionLabel}>New leads · {(leads.data || []).length}</Text>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.neutral[600] }}>from chat & calls</Text>
        </View>

        <View style={{ gap: 14 }}>
          {(leads.data || []).map((l) => (
            <BlueprintBox key={l.id} style={{ padding: 13, gap: 9 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {business.data!.showLeadSources && <Tag label={l.source} variant="accent" />}
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.neutral[600], marginLeft: "auto" }}>
                  {new Date(l.receivedAt).toLocaleString("en-AU", { hour: "numeric", minute: "2-digit" })}
                </Text>
              </View>
              <Text style={{ fontFamily: theme.fonts.heading, fontWeight: "600", fontSize: 18, color: theme.colors.text }}>
                {l.client.name}
              </Text>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 19, color: theme.colors.neutral[700] }}>
                {l.snippet}
              </Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 3 }}>
                <Button
                  label="Quote this"
                  variant="primary"
                  flex
                  minHeight={38}
                  onPress={() => navigation.navigate("QuoteBuilder", { leadId: l.id })}
                />
                <Button
                  label="Client"
                  variant="secondary"
                  minHeight={38}
                  onPress={() => navigation.navigate("ClientDetail", { clientId: l.client.id })}
                />
              </View>
            </BlueprintBox>
          ))}
          {(leads.data || []).length === 0 && (
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.neutral[600] }}>No new leads right now.</Text>
          )}
        </View>

        <Text style={[styles(theme).sectionLabel, { marginTop: 26, marginBottom: 10 }]}>Needs attention</Text>
        <BlueprintBox>
          {overdueInvoices.map((i) => (
            <View key={i.id} style={styles(theme).attentionRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: theme.fonts.heading, fontSize: 15, color: theme.colors.text }}>
                  {i.ref} · {i.client.name}
                </Text>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.neutral[600], marginTop: 2 }}>
                  Overdue · {i.dueDate ? `due ${new Date(i.dueDate).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}` : ""}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontFamily: theme.fonts.heading, fontSize: 16, color: theme.colors.text }}>
                  {aud(Math.max(0, i.totals.balance))}
                </Text>
                <Button
                  label="Remind"
                  variant="ghost"
                  minHeight={20}
                  style={{ paddingHorizontal: 0, marginTop: 2, borderWidth: 0 }}
                  onPress={() => navigation.navigate("ClientDetail", { clientId: i.client.id })}
                />
              </View>
            </View>
          ))}
          {followUpQuotes.map((q) => (
            <View key={q.id} style={styles(theme).attentionRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: theme.fonts.heading, fontSize: 15, color: theme.colors.text }}>
                  {q.ref} · {q.client.name}
                </Text>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.neutral[600], marginTop: 2 }}>
                  Sent · opened {q.viewedCount}×
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontFamily: theme.fonts.heading, fontSize: 16, color: theme.colors.text }}>{aud(q.totals.total)}</Text>
                <Button
                  label="Follow up"
                  variant="ghost"
                  minHeight={20}
                  style={{ paddingHorizontal: 0, marginTop: 2, borderWidth: 0 }}
                  onPress={() => navigation.navigate("ClientDetail", { clientId: q.client.id })}
                />
              </View>
            </View>
          ))}
          {overdueInvoices.length === 0 && followUpQuotes.length === 0 && (
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.neutral[600], padding: 13 }}>
              Nothing needs chasing.
            </Text>
          )}
        </BlueprintBox>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) => ({
  sectionLabel: {
    fontFamily: theme.fonts.body,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase" as const,
    color: theme.colors.neutral[700],
  },
  attentionRow: {
    padding: 13,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
  },
});
