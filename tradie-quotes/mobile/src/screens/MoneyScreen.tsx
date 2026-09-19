import React, { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlatList, Pressable } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import {
  useAcceptQuote,
  useConvertToInvoice,
  useInvoices,
  useQuotes,
  useRecordPayment,
} from "../api/hooks";
import { BlueprintBox } from "../components/Blueprint";
import { SegmentedControl } from "../components/SegmentedControl";
import { Tag } from "../components/Tag";
import { Button } from "../components/Button";
import { Sheet } from "../components/Sheet";
import { Toast, useToast } from "../components/Toast";
import { aud } from "../lib/format";
import type { Invoice, Quote } from "../api/types";
import type { TabScreenProps } from "../navigation/types";

function invoiceTagColors(theme: ReturnType<typeof useTheme>, status: Invoice["status"]) {
  if (status === "Overdue") return { bg: theme.colors.accent[900], fg: "#fff" };
  if (status === "Paid") return { bg: theme.colors.neutral[200], fg: theme.colors.neutral[800] };
  return { bg: theme.colors.accent[100], fg: theme.colors.accent[800] };
}

export function MoneyScreen({ navigation }: TabScreenProps<"Money">) {
  const theme = useTheme();
  const [tab, setTab] = useState<"quotes" | "invoices">("quotes");
  const quotes = useQuotes();
  const invoices = useInvoices();
  const acceptQuote = useAcceptQuote();
  const convert = useConvertToInvoice();
  const { toast, flash } = useToast();
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);
  const recordPayment = useRecordPayment(payTarget?.id || "");

  const onQuotePress = async (q: Quote) => {
    if (q.status === "Draft") {
      navigation.navigate("QuoteBuilder", { quoteId: q.id });
    } else if (q.status === "Sent") {
      await acceptQuote.mutateAsync(q.id);
      flash(`${q.ref} marked accepted — convert to invoice`);
    } else if (q.status === "Accepted") {
      const inv = await convert.mutateAsync(q.id);
      flash(`${inv.ref} created from ${q.ref}`);
      setTab("invoices");
    } else if (q.status === "Invoiced" && q.invoice) {
      navigation.navigate("PdfPreview", { invoiceId: q.invoice.id });
    } else {
      navigation.navigate("PdfPreview", { quoteId: q.id });
    }
  };

  const onInvoicePress = (inv: Invoice) => {
    if (inv.status === "Paid") {
      flash("Receipt re-sent");
    } else {
      setPayTarget(inv);
    }
  };

  const pay = async (amount: number) => {
    if (!payTarget) return;
    await recordPayment.mutateAsync({ amount, method: "Bank transfer" });
    flash(amount >= payTarget.totals.balance - 0.01 ? "Marked paid in full · receipt sent" : "Part payment recorded");
    setPayTarget(null);
  };

  const loading = quotes.isLoading || invoices.isLoading;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={["top", "left", "right"]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <Text style={{ fontFamily: theme.fonts.heading, fontWeight: "600", fontSize: 26, color: theme.colors.text }}>Money</Text>
        <View style={{ marginTop: 14 }}>
          <SegmentedControl
            value={tab}
            onChange={setTab}
            options={[
              { label: "Quotes", value: "quotes" },
              { label: "Invoices", value: "invoices" },
            ]}
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : tab === "quotes" ? (
        <FlatList
          data={quotes.data || []}
          keyExtractor={(q) => q.id}
          contentContainerStyle={{ padding: 16 }}
          ListHeaderComponent={<BlueprintBox noCorners style={{ marginBottom: -1 }} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => onQuotePress(item)} style={{ padding: 13, borderWidth: 1, borderTopWidth: 0, borderColor: theme.colors.divider }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <Text style={{ fontFamily: theme.fonts.heading, fontSize: 15, color: theme.colors.text }}>{item.ref}</Text>
                <Tag
                  label={item.status === "Sent" ? `Viewed ${item.viewedCount}×` : item.status}
                  variant={item.status === "Declined" ? "neutral" : "accent"}
                />
              </View>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.neutral[700], marginTop: 3 }}>{item.client.name}</Text>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.neutral[600], marginTop: 2 }}>
                {item.status === "Draft" ? "Not sent yet" : item.shape}
              </Text>
              <Text style={{ position: "absolute", right: 13, top: 13, fontFamily: theme.fonts.heading, fontSize: 16, color: theme.colors.text }}>
                {aud(item.totals.total)}
              </Text>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={invoices.data || []}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => {
            const colors = invoiceTagColors(theme, item.status);
            return (
              <Pressable
                onPress={() => onInvoicePress(item)}
                style={{ padding: 13, borderWidth: 1, borderTopWidth: 0, borderColor: theme.colors.divider }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                  <Text style={{ fontFamily: theme.fonts.heading, fontSize: 15, color: theme.colors.text }}>{item.ref}</Text>
                  <Tag label={item.status} bg={colors.bg} fg={colors.fg} />
                </View>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.neutral[700], marginTop: 3 }}>{item.client.name}</Text>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.neutral[600], marginTop: 2 }}>
                  {item.status === "Paid" ? "Paid in full" : `${aud(Math.max(0, item.totals.balance))} due`}
                </Text>
                <Text style={{ position: "absolute", right: 13, top: 13, fontFamily: theme.fonts.heading, fontSize: 16, color: theme.colors.text }}>
                  {aud(item.totals.total)}
                </Text>
              </Pressable>
            );
          }}
        />
      )}

      <Sheet visible={!!payTarget} onClose={() => setPayTarget(null)}>
        {payTarget && (
          <>
            <Text style={{ fontFamily: theme.fonts.heading, fontSize: 22, color: theme.colors.text }}>Record payment</Text>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.neutral[700], marginTop: 4 }}>
              {payTarget.ref} · {aud(Math.max(0, payTarget.totals.balance), true)} outstanding
            </Text>
            <View style={{ gap: 9, marginTop: 16 }}>
              <Button variant="secondary" minHeight={48} onPress={() => pay(payTarget.totals.balance)}>
                <View style={{ flexDirection: "row", flex: 1, justifyContent: "space-between", width: "100%" }}>
                  <Text style={{ fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.text }}>Paid in full</Text>
                  <Text style={{ fontFamily: theme.fonts.heading, fontSize: 15, color: theme.colors.text }}>
                    {aud(payTarget.totals.balance, true)}
                  </Text>
                </View>
              </Button>
              <Button variant="secondary" minHeight={48} onPress={() => pay(payTarget.totals.deposit)}>
                <View style={{ flexDirection: "row", flex: 1, justifyContent: "space-between", width: "100%" }}>
                  <Text style={{ fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.text }}>Deposit only</Text>
                  <Text style={{ fontFamily: theme.fonts.heading, fontSize: 15, color: theme.colors.text }}>
                    {aud(payTarget.totals.deposit, true)}
                  </Text>
                </View>
              </Button>
              <Button variant="secondary" minHeight={48} onPress={() => pay(Math.round((payTarget.totals.balance / 2) * 100) / 100)}>
                <View style={{ flexDirection: "row", flex: 1, justifyContent: "space-between", width: "100%" }}>
                  <Text style={{ fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.text }}>Half now</Text>
                  <Text style={{ fontFamily: theme.fonts.heading, fontSize: 15, color: theme.colors.text }}>enter</Text>
                </View>
              </Button>
            </View>
            <Button label="Cancel" variant="ghost" minHeight={40} style={{ marginTop: 8, borderWidth: 0 }} onPress={() => setPayTarget(null)} />
          </>
        )}
      </Sheet>
      <Toast message={toast} />
    </SafeAreaView>
  );
}
