import React, { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { useAccountingSummary } from "../api/hooks";
import { shareAccountingCsv } from "../lib/pdf";
import { BlueprintBox } from "../components/Blueprint";
import { Button } from "../components/Button";
import { Toast, useToast } from "../components/Toast";
import { aud } from "../lib/format";
import type { RootScreenProps } from "../navigation/types";

type PeriodKey = "quarter" | "lastQuarter" | "year" | "all";

// AU BAS quarters run Jul–Sep, Oct–Dec, Jan–Mar, Apr–Jun.
function quarterStart(date: Date) {
  const m = date.getMonth(); // 0-11
  const fyMonth = (m + 6) % 12; // months since 1 Jul
  const quarterIndex = Math.floor(fyMonth / 3);
  const startMonth = (6 + quarterIndex * 3) % 12;
  const year = startMonth > m ? date.getFullYear() - 1 : date.getFullYear();
  return new Date(year, startMonth, 1);
}

function periodRange(key: PeriodKey): { from?: string; to?: string; label: string } {
  const now = new Date();
  if (key === "all") return { label: "All time" };
  if (key === "quarter") {
    const start = quarterStart(now);
    const end = new Date(start.getFullYear(), start.getMonth() + 3, 1);
    return { from: start.toISOString(), to: end.toISOString(), label: `Q${Math.floor(start.getMonth() / 3) + 1} FY${start.getFullYear() + (start.getMonth() >= 6 ? 1 : 0)}` };
  }
  if (key === "lastQuarter") {
    const thisStart = quarterStart(now);
    const start = new Date(thisStart.getFullYear(), thisStart.getMonth() - 3, 1);
    const end = thisStart;
    return { from: start.toISOString(), to: end.toISOString(), label: "Last quarter" };
  }
  // year: current AU financial year (1 Jul – 30 Jun)
  const fyStartYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const start = new Date(fyStartYear, 6, 1);
  const end = new Date(fyStartYear + 1, 6, 1);
  return { from: start.toISOString(), to: end.toISOString(), label: `FY${fyStartYear + 1}` };
}

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "quarter", label: "This quarter" },
  { key: "lastQuarter", label: "Last quarter" },
  { key: "year", label: "This FY" },
  { key: "all", label: "All time" },
];

export function AccountingSummaryScreen({ navigation }: RootScreenProps<"AccountingSummary">) {
  const theme = useTheme();
  const { toast, flash } = useToast();
  const [period, setPeriod] = useState<PeriodKey>("quarter");
  const [exporting, setExporting] = useState(false);
  const range = useMemo(() => periodRange(period), [period]);
  const summary = useAccountingSummary(range.from, range.to);

  const onExport = async () => {
    setExporting(true);
    try {
      await shareAccountingCsv(range.from, range.to);
    } catch {
      flash("Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Button label="‹ Back" variant="secondary" minHeight={36} onPress={() => navigation.goBack()} />
        <Text style={{ fontFamily: theme.fonts.heading, fontSize: 18, color: theme.colors.text }}>BAS / accounting summary</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {PERIODS.map((p) => (
            <Button key={p.key} label={p.label} variant={period === p.key ? "primary" : "secondary"} minHeight={36} onPress={() => setPeriod(p.key)} />
          ))}
        </ScrollView>
        <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.neutral[600], marginTop: 8 }}>
          {range.label} · paid invoices only, based on payment date
        </Text>

        {summary.isLoading ? (
          <ActivityIndicator style={{ marginTop: 30 }} />
        ) : (
          <>
            <BlueprintBox style={{ marginTop: 16 }}>
              <View style={{ padding: 13, borderBottomWidth: 1, borderBottomColor: theme.colors.divider, flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.neutral[700] }}>Income (ex GST)</Text>
                <Text style={{ fontFamily: theme.fonts.heading, fontSize: 15, color: theme.colors.text }}>{aud(summary.data?.totals.exGst || 0, true)}</Text>
              </View>
              <View style={{ padding: 13, borderBottomWidth: 1, borderBottomColor: theme.colors.divider, flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.neutral[700] }}>GST collected (1A)</Text>
                <Text style={{ fontFamily: theme.fonts.heading, fontSize: 15, color: theme.colors.text }}>{aud(summary.data?.totals.gst || 0, true)}</Text>
              </View>
              <View style={{ padding: 13, flexDirection: "row", justifyContent: "space-between", backgroundColor: `${theme.colors.accent.accent}14` }}>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.accent[800] }}>Total received</Text>
                <Text style={{ fontFamily: theme.fonts.heading, fontSize: 17, color: theme.colors.text }}>{aud(summary.data?.totals.total || 0, true)}</Text>
              </View>
            </BlueprintBox>

            <Button
              label={exporting ? "Preparing…" : "Export CSV for MYOB / accountant"}
              variant="primary"
              minHeight={46}
              disabled={exporting || !summary.data?.count}
              style={{ marginTop: 14 }}
              onPress={onExport}
            />

            <Text style={{ fontFamily: theme.fonts.body, fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: theme.colors.neutral[700], marginTop: 22, marginBottom: 8 }}>
              Paid invoices · {summary.data?.count || 0}
            </Text>
            <BlueprintBox>
              {(summary.data?.invoices || []).map((inv, i) => (
                <View
                  key={inv.id}
                  style={{
                    padding: 13,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: theme.colors.divider,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontFamily: theme.fonts.heading, fontSize: 14, color: theme.colors.text }}>
                      {inv.ref} · {inv.client.name}
                    </Text>
                    <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.neutral[600], marginTop: 2 }}>
                      Paid {new Date(inv.paidAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })} · GST {aud(inv.gst, true)}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: theme.fonts.heading, fontSize: 15, color: theme.colors.text }}>{aud(inv.total, true)}</Text>
                </View>
              ))}
              {(summary.data?.invoices || []).length === 0 && (
                <Text style={{ padding: 20, textAlign: "center", fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.neutral[600] }}>
                  No invoices paid in full in this period yet.
                </Text>
              )}
            </BlueprintBox>
          </>
        )}
      </ScrollView>
      <Toast message={toast} />
    </SafeAreaView>
  );
}
