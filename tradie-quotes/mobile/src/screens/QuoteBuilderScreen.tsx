import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
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
} from "../api/hooks";
import { BlueprintBox } from "../components/Blueprint";
import { Button } from "../components/Button";
import { SegmentedControl } from "../components/SegmentedControl";
import { Tag } from "../components/Tag";
import { PriceBookCard } from "../components/PriceBookCard";
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

  const creating = useRef(false);
  useEffect(() => {
    if (quoteId || creating.current) return;
    creating.current = true;
    createQuote
      .mutateAsync({ leadId: route.params.leadId, clientId: route.params.clientId })
      .then((q) => setQuoteId(q.id))
      .catch(() => flash("Couldn't start a new quote"));
  }, [quoteId]);

  const dropZoneRef = useRef<View>(null);
  const dropRect = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const [dropActive, setDropActive] = useState(false);

  const measureDropZone = () => {
    dropZoneRef.current?.measureInWindow((x, y, width, height) => {
      dropRect.current = { x, y, width, height };
    });
  };

  const isOver = (x: number, y: number) => {
    const r = dropRect.current;
    return x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
  };

  const onCardMove = (x: number, y: number) => setDropActive(isOver(x, y));
  const onCardDrop = (item: { label: string; rate: number; unit: string }, x: number, y: number) => {
    setDropActive(false);
    if (isOver(x, y)) {
      addLine.mutate({ label: item.label, qty: 1, unit: item.unit, rate: item.rate });
      flash(item.label.split(",")[0] + " added");
    }
  };

  if (!quoteId || quote.isLoading || !quote.data || business.isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg, justifyContent: "center" }}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const q = quote.data;
  const shape = q.shape;
  const linesHeading = shape === "Flat price" ? "The price" : shape === "Itemised" ? "Items" : "Labour + materials";

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

        <View ref={dropZoneRef} onLayout={measureDropZone}>
          <BlueprintBox style={{ minHeight: 96, borderColor: dropActive ? theme.colors.accent.accent : theme.colors.divider }}>
            {q.lines.map((l) => (
              <View
                key={l.id}
                style={{ padding: 11, borderBottomWidth: 1, borderBottomColor: theme.colors.divider, flexDirection: "row", alignItems: "flex-start", gap: 10 }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontFamily: theme.fonts.body, fontSize: 13.5, color: theme.colors.text }}>{l.label}</Text>
                  <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.neutral[600], marginTop: 3 }}>
                    {l.qty} {l.unit} × {aud(l.rate)}
                  </Text>
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
                Drag items up from the price book,{"\n"}or hold the mic and say the job.
              </Text>
            )}
            <View style={{ padding: 9 }}>
              <Button
                label="+ Blank line"
                variant="ghost"
                minHeight={30}
                style={{ borderWidth: 0, paddingHorizontal: 0, alignSelf: "flex-start" }}
                onPress={() => addLine.mutate({ label: "New line", qty: 1, unit: "ea", rate: 0 })}
              />
            </View>
            {dropActive && (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  inset: 0,
                  borderWidth: 1.5,
                  borderStyle: "dashed",
                  borderColor: theme.colors.accent.accent,
                  backgroundColor: `${theme.colors.accent.accent}18`,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontFamily: theme.fonts.heading, fontSize: 14, color: theme.colors.accent[800], backgroundColor: theme.colors.bg, paddingHorizontal: 10, paddingVertical: 4 }}>
                  Drop to add
                </Text>
              </View>
            )}
          </BlueprintBox>
        </View>

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

        <Text style={{ fontFamily: theme.fonts.body, fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase", color: theme.colors.neutral[700], marginTop: 20, marginBottom: 7 }}>
          Price book · drag up to add
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {(priceBook.data || []).map((item) => (
            <PriceBookCard key={item.id} item={item} onMove={onCardMove} onDrop={onCardDrop} />
          ))}
        </ScrollView>
      </ScrollView>
      <Toast message={toast} />
    </SafeAreaView>
  );
}
