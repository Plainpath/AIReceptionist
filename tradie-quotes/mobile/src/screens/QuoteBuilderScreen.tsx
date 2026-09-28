import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import {
  useAddLine,
  useAddLinesBulk,
  useBusiness,
  useCreateQuote,
  usePriceBook,
  useQuote,
  useRemoveLine,
  useSetQuoteShape,
  useUpdateLine,
} from "../api/hooks";
import { BlueprintBox } from "../components/Blueprint";
import { Button } from "../components/Button";
import { SegmentedControl } from "../components/SegmentedControl";
import { Sheet } from "../components/Sheet";
import { Tag } from "../components/Tag";
import { VoiceCapture } from "../components/VoiceCapture";
import { Toast, useToast } from "../components/Toast";
import { aud } from "../lib/format";
import type { QuoteShape } from "../api/types";
import type { RootScreenProps } from "../navigation/types";

const SHAPES: { value: QuoteShape; label: string }[] = [
  { value: "Flat price", label: "Flat price" },
  { value: "Labour + materials", label: "Labour + mat." },
  { value: "Itemised", label: "Itemised" },
];

export function QuoteBuilderScreen({ route, navigation }: RootScreenProps<"QuoteBuilder">) {
  const theme = useTheme();
  const { toast, flash } = useToast();
  const business = useBusiness();
  const priceBook = usePriceBook();
  const createQuote = useCreateQuote();
  const [quoteId, setQuoteId] = useState<string | null>(route.params.quoteId || null);
  const quote = useQuote(quoteId);
  const setShape = useSetQuoteShape(quoteId || "");
  const addLine = useAddLine(quoteId || "");
  const addLinesBulk = useAddLinesBulk(quoteId || "");
  const removeLine = useRemoveLine(quoteId || "");
  const updateLine = useUpdateLine(quoteId || "");

  const creating = useRef(false);
  useEffect(() => {
    if (quoteId || creating.current) return;
    creating.current = true;
    createQuote
      .mutateAsync({ leadId: route.params.leadId, clientId: route.params.clientId })
      .then((q) => setQuoteId(q.id))
      .catch(() => flash("Couldn't start a new quote"));
  }, [quoteId]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [rateDraft, setRateDraft] = useState("");

  if (!quoteId || quote.isLoading || !quote.data || business.isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg, justifyContent: "center" }}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const q = quote.data;
  const shape = q.shape;
  const isFlat = shape === "Flat price";
  const linesHeading = shape === "Flat price" ? "The price" : shape === "Itemised" ? "Items" : "Labour + materials";

  const selectedItems = (priceBook.data || []).filter((i) => selectedIds.has(i.id));
  const selectedTotal = selectedItems.reduce((t, i) => t + i.rate, 0);
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const addSelectedToQuote = () => {
    if (selectedItems.length === 0) return;
    if (isFlat) {
      addLine.mutate(
        { label: selectedItems.map((i) => i.label).join(" + "), qty: 1, unit: "job", rate: selectedTotal },
        { onSuccess: () => { setSelectedIds(new Set()); setPickerOpen(false); flash("Flat price line added"); } }
      );
    } else {
      addLinesBulk.mutate(
        selectedItems.map((i) => ({ label: i.label, qty: 1, unit: i.unit, rate: i.rate })),
        {
          onSuccess: () => {
            setSelectedIds(new Set());
            setPickerOpen(false);
            flash(`${selectedItems.length} item${selectedItems.length === 1 ? "" : "s"} added`);
          },
        }
      );
    }
  };

  const startEditRate = (lineId: string, currentRate: number) => {
    setEditingRateId(lineId);
    setRateDraft(String(currentRate));
  };
  const commitRate = (lineId: string) => {
    const parsed = parseFloat(rateDraft);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      updateLine.mutate({ lineId, rate: parsed });
    }
    setEditingRateId(null);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          padding: 16,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.divider,
        }}
      >
        <Button label="‹" variant="secondary" minHeight={36} style={{ width: 36, paddingHorizontal: 0 }} onPress={() => navigation.goBack()} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: theme.fonts.heading, fontSize: 18, color: theme.colors.text }}>{q.ref}</Text>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.neutral[600] }}>
            {q.status} · {q.lines.length} line{q.lines.length === 1 ? "" : "s"}
          </Text>
        </View>
        <Button label="Preview" variant="secondary" minHeight={36} onPress={() => navigation.navigate("PdfPreview", { quoteId })} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <BlueprintBox style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: theme.fonts.heading, fontSize: 16, color: theme.colors.text }}>{q.client.name}</Text>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.neutral[600] }}>{q.client.address}</Text>
          </View>
          <Tag label={q.client.origin} variant="outline" />
        </BlueprintBox>

        <Text style={{ fontFamily: theme.fonts.body, fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase", color: theme.colors.neutral[700], marginTop: 16, marginBottom: 7 }}>
          Quote shape
        </Text>
        <SegmentedControl value={shape} onChange={(v) => setShape.mutate(v)} options={SHAPES} />

        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 20, marginBottom: 8 }}>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase", color: theme.colors.neutral[700] }}>
            {linesHeading}
          </Text>
        </View>

        <BlueprintBox elevation={1}>
          {q.lines.map((l, i) => (
            <View
              key={l.id}
              style={{ padding: 11, borderBottomWidth: 1, borderBottomColor: theme.colors.divider, flexDirection: "row", alignItems: "flex-start", gap: 10 }}
            >
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.neutral[600], minWidth: 16 }}>
                {i + 1}
              </Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 13.5, color: theme.colors.text }}>{l.label}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 5 }}>
                  <Button
                    variant="secondary"
                    minHeight={24}
                    style={{ width: 24, paddingHorizontal: 0 }}
                    disabled={l.qty <= 1}
                    onPress={() => updateLine.mutate({ lineId: l.id, qty: Math.max(1, l.qty - 1) })}
                  >
                    <Text style={{ color: theme.colors.text, fontSize: 14 }}>–</Text>
                  </Button>
                  <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.text, minWidth: 42, textAlign: "center" }}>
                    {l.qty} {l.unit}
                  </Text>
                  <Button
                    variant="secondary"
                    minHeight={24}
                    style={{ width: 24, paddingHorizontal: 0 }}
                    onPress={() => updateLine.mutate({ lineId: l.id, qty: l.qty + 1 })}
                  >
                    <Text style={{ color: theme.colors.text, fontSize: 14 }}>+</Text>
                  </Button>
                  <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.neutral[600] }}>×</Text>
                  {editingRateId === l.id ? (
                    <TextInput
                      value={rateDraft}
                      onChangeText={setRateDraft}
                      keyboardType="decimal-pad"
                      autoFocus
                      onBlur={() => commitRate(l.id)}
                      onSubmitEditing={() => commitRate(l.id)}
                      style={{
                        minWidth: 60,
                        borderWidth: 1,
                        borderColor: theme.colors.accent.accent,
                        borderRadius: theme.radius.sm,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        fontFamily: theme.fonts.body,
                        fontSize: 11.5,
                        color: theme.colors.text,
                      }}
                    />
                  ) : (
                    <Button
                      variant="ghost"
                      minHeight={0}
                      style={{ borderWidth: 0, paddingHorizontal: 0 }}
                      onPress={() => startEditRate(l.id, l.rate)}
                    >
                      <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.accent.accent, textDecorationLine: "underline" }}>
                        {aud(l.rate)}
                      </Text>
                    </Button>
                  )}
                </View>
              </View>
              <Text style={{ fontFamily: theme.fonts.heading, fontSize: 15, color: theme.colors.text }}>{aud(l.qty * l.rate)}</Text>
              <Button
                variant="ghost"
                minHeight={22}
                style={{ width: 22, borderWidth: 0, paddingHorizontal: 0 }}
                onPress={() => removeLine.mutate(l.id)}
              >
                <Text style={{ color: theme.colors.neutral[600], fontSize: 15 }}>✕</Text>
              </Button>
            </View>
          ))}
          {q.lines.length === 0 && (
            <Text style={{ padding: 26, textAlign: "center", fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.neutral[600], lineHeight: 18 }}>
              Tap Price book below, or hold the mic and say the job.
            </Text>
          )}
          <View style={{ padding: 9, flexDirection: "row" }}>
            <Button
              label="+ Blank line"
              variant="ghost"
              minHeight={30}
              style={{ borderWidth: 0, paddingHorizontal: 0, alignSelf: "flex-start" }}
              onPress={() => addLine.mutate({ label: "New line", qty: 1, unit: "ea", rate: 0 })}
            />
          </View>
        </BlueprintBox>

        <Button
          label="Price book"
          variant="primary"
          minHeight={46}
          style={{ marginTop: 12 }}
          onPress={() => setPickerOpen(true)}
        />

        <VoiceCapture
          quoteId={quoteId}
          onError={flash}
          onAccept={(lines) => {
            addLinesBulk.mutate(
              lines.map((l) => ({ label: l.label, qty: l.qty, unit: l.unit, rate: l.rate })),
              { onSuccess: () => flash(`${lines.length} lines added from voice`) }
            );
          }}
        />

        <BlueprintBox style={{ marginTop: 16 }}>
          <View style={{ padding: 9, borderBottomWidth: 1, borderBottomColor: theme.colors.divider, flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.neutral[700] }}>Subtotal (ex GST)</Text>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text }}>{aud(q.totals.sub, true)}</Text>
          </View>
          <View style={{ padding: 9, borderBottomWidth: 1, borderBottomColor: theme.colors.divider, flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.neutral[700] }}>GST 10%</Text>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text }}>{aud(q.totals.gst, true)}</Text>
          </View>
          {business.data && business.data.depositPercent > 0 && (
            <View style={{ padding: 9, borderBottomWidth: 1, borderBottomColor: theme.colors.divider, flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.neutral[700] }}>
                Deposit on acceptance ({business.data.depositPercent}%)
              </Text>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text }}>{aud(q.totals.deposit, true)}</Text>
            </View>
          )}
          <View style={{ padding: 11, flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", backgroundColor: `${theme.colors.accent.accent}14` }}>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: theme.colors.accent[800] }}>
              Total inc GST
            </Text>
            <Text style={{ fontFamily: theme.fonts.heading, fontSize: 23, color: theme.colors.text }}>{aud(q.totals.total, true)}</Text>
          </View>
        </BlueprintBox>

      </ScrollView>

      <Sheet visible={pickerOpen} onClose={() => setPickerOpen(false)}>
        <Text style={{ fontFamily: theme.fonts.heading, fontSize: 19, color: theme.colors.text }}>Price book</Text>
        <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.neutral[700], marginTop: 3 }}>
          {isFlat ? "Select items — they'll be combined into one flat-price line." : "Select items to add as separate lines."}
        </Text>
        <ScrollView style={{ maxHeight: 380, marginTop: 12 }}>
          <BlueprintBox>
            {(priceBook.data || []).map((item, i) => {
              const selected = selectedIds.has(item.id);
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  minHeight={0}
                  style={{
                    borderWidth: 0,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: theme.colors.divider,
                    justifyContent: "flex-start",
                    paddingHorizontal: 11,
                    paddingVertical: 12,
                    backgroundColor: selected ? `${theme.colors.accent.accent}14` : "transparent",
                  }}
                  onPress={() => toggleSelect(item.id)}
                >
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderWidth: 1.5,
                      borderColor: selected ? theme.colors.accent.accent : theme.colors.divider,
                      backgroundColor: selected ? theme.colors.accent.accent : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {selected && <Text style={{ color: "#fff", fontSize: 12, lineHeight: 12 }}>✓</Text>}
                  </View>
                  <Text style={{ flex: 1, fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text }}>
                    {item.label}
                  </Text>
                  <Text style={{ fontFamily: theme.fonts.heading, fontSize: 13, color: theme.colors.text }}>
                    {aud(item.rate)} / {item.unit}
                  </Text>
                </Button>
              );
            })}
            {(priceBook.data || []).length === 0 && (
              <Text style={{ padding: 20, textAlign: "center", fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.neutral[600] }}>
                No price book items yet.
              </Text>
            )}
          </BlueprintBox>
        </ScrollView>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 }}>
          <Text style={{ flex: 1, fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.neutral[700] }}>
            {selectedItems.length} selected · {aud(selectedTotal)}
          </Text>
          <Button label="Cancel" variant="secondary" minHeight={40} onPress={() => setPickerOpen(false)} />
          <Button
            label="Add to quote"
            variant="primary"
            minHeight={40}
            disabled={selectedItems.length === 0}
            onPress={addSelectedToQuote}
          />
        </View>
      </Sheet>
      <Toast message={toast} />
    </SafeAreaView>
  );
}
