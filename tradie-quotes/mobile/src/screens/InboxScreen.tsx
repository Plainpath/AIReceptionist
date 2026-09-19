import React from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { useBusiness, useInvoices, useLeads, useQuotes } from "../api/hooks";
import { BlueprintBox } from "../components/Blueprint";
import { Tag } from "../components/Tag";
import { Button } from "../components/Button";
import { aud } from "../lib/format";
import type { TabScreenProps } from "../navigation/types";
import { useQueryClient } from "@tanstack/react-query";

type Props = TabScreenProps<"Inbox">;

export function InboxScreen({ navigation }: Props) {
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
  const paidThisMonth = (invoices.data || []).reduce((s, i) => s + i.paid, 0);
  const overdueInvoices = (invoices.data || []).filter((i) => i.status === "Overdue");
  const followUpQuotes = (quotes.data || []).filter((q) => q.status === "Sent" && q.viewedCount > 0);

  const initials = business.data.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <View>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 9.5, letterSpacing: 2, textTransform: "uppercase", color: theme.colors.accent[700] }}>
              Quotes & invoices
            </Text>
            <Text style={{ fontFamily: theme.fonts.heading, fontWeight: "600", fontSize: 26, color: theme.colors.text, marginTop: 2 }}>
              {business.data.name}
            </Text>
          </View>
          <BlueprintBox style={{ width: 42, height: 42, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: theme.fonts.heading, fontSize: 15, color: theme.colors.accent[700] }}>{initials}</Text>
          </BlueprintBox>
        </View>

        <BlueprintBox style={{ flexDirection: "row", marginTop: 22 }}>
          <View style={{ flex: 1, padding: 11 }}>
            <Text style={styles(theme).kicker}>Owed</Text>
            <Text style={styles(theme).stat}>{aud(owed)}</Text>
          </View>
          <View style={{ flex: 1, padding: 11, borderLeftWidth: 1, borderLeftColor: theme.colors.divider }}>
            <Text style={styles(theme).kicker}>Overdue</Text>
            <Text style={[styles(theme).stat, { color: theme.colors.accent[800] }]}>{aud(overdue)}</Text>
          </View>
          <View style={{ flex: 1, padding: 11, borderLeftWidth: 1, borderLeftColor: theme.colors.divider }}>
            <Text style={styles(theme).kicker}>Paid</Text>
            <Text style={styles(theme).stat}>{aud(paidThisMonth)}</Text>
          </View>
        </BlueprintBox>

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
  kicker: {
    fontFamily: theme.fonts.body,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: "uppercase" as const,
    color: theme.colors.neutral[600],
  },
  stat: { fontFamily: theme.fonts.heading, fontSize: 21, color: theme.colors.text, marginTop: 3 },
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
