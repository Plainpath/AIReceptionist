import React, { useState } from "react";
import { ActivityIndicator, Linking, ScrollView, Share, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { useTheme } from "../theme/ThemeProvider";
import { useBusiness, useInvoice, useQuote, useRecordPayment, useSendInvoice, useSendQuote } from "../api/hooks";
import { BlueprintBox } from "../components/Blueprint";
import { Tag } from "../components/Tag";
import { Button } from "../components/Button";
import { Sheet } from "../components/Sheet";
import { Toast, useToast } from "../components/Toast";
import { aud } from "../lib/format";
import { API_URL } from "../api/client";
import { shareDocPdf } from "../lib/pdf";
import type { RootScreenProps } from "../navigation/types";
import type { Line, Totals } from "../api/types";

export function PdfPreviewScreen({ route, navigation }: RootScreenProps<"PdfPreview">) {
  const theme = useTheme();
  const { quoteId, invoiceId } = route.params;
  const isInvoice = !!invoiceId;
  const business = useBusiness();
  const quote = useQuote(quoteId || null);
  const invoice = useInvoice(invoiceId || null);
  const sendQuote = useSendQuote();
  const sendInvoice = useSendInvoice();
  const recordPayment = useRecordPayment(invoiceId || "");
  const { toast, flash } = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [resending, setResending] = useState(false);

  const doc = isInvoice ? invoice.data : quote.data;
  const loading = business.isLoading || (isInvoice ? invoice.isLoading : quote.isLoading) || !doc || !business.data;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg, justifyContent: "center" }}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const b = business.data!;
  const lines: Line[] = doc!.lines;
  const totals: Totals = doc!.totals;
  const ref = doc!.ref;
  const client = doc!.client;
  const paid = isInvoice ? (doc as any).paid : 0;
  const dueOrValid = isInvoice
    ? (doc as any).dueDate
      ? `Due ${new Date((doc as any).dueDate).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}`
      : "Due on receipt"
    : "Valid 30 days";
  const scope = (quote.data?.shape || "Labour + materials") === "Flat price"
    ? "Supply and install as discussed — one fixed price."
    : "Supply and install, including labour, materials and testing.";

  const ensureShareToken = async (): Promise<string> => {
    if (doc!.shareToken) return doc!.shareToken;
    if (isInvoice) {
      const updated = await sendInvoice.mutateAsync(invoiceId!);
      return updated.shareToken!;
    }
    const updated = await sendQuote.mutateAsync(quoteId!);
    return updated.shareToken!;
  };

  const hostedLink = (token: string) => `${API_URL}/public/${isInvoice ? "invoices" : "quotes"}/${token}`;

  const outstanding = isInvoice && doc!.status !== "Paid";

  const onResend = async () => {
    setResending(true);
    try {
      await sendInvoice.mutateAsync(invoiceId!);
      flash(`${ref} resent to ${client.name}`);
    } finally {
      setResending(false);
    }
  };

  const pay = async (amount: number) => {
    const balance = (doc as any).totals.balance;
    await recordPayment.mutateAsync({ amount, method: "Bank transfer" });
    flash(amount >= balance - 0.01 ? "Marked paid in full · receipt sent" : "Part payment recorded");
    setCustomAmount("");
    setPayOpen(false);
  };

  const payCustom = () => {
    const balance = (doc as any).totals.balance;
    const amount = Math.round(parseFloat(customAmount) * 100) / 100;
    if (!amount || amount <= 0) return flash("Enter an amount first");
    if (amount > balance) return flash(`Can't exceed ${aud(balance, true)} owing`);
    pay(amount);
  };

  const finishSend = (msg: string) => {
    setSheetOpen(false);
    flash(msg);
    setTimeout(() => navigation.navigate("Tabs"), 700);
  };

  const onShareFile = async () => {
    setSending(true);
    try {
      await ensureShareToken();
      await shareDocPdf(isInvoice ? "invoices" : "quotes", doc!.id, ref);
      finishSend(`Sent via share sheet · delivery tracked`);
    } finally {
      setSending(false);
    }
  };

  const onCopyLink = async () => {
    setSending(true);
    try {
      const token = await ensureShareToken();
      await Clipboard.setStringAsync(hostedLink(token));
      finishSend("Link copied · we’ll tell you when it’s opened");
    } finally {
      setSending(false);
    }
  };

  const onEmail = async () => {
    setSending(true);
    try {
      const token = await ensureShareToken();
      const subject = `${isInvoice ? "Invoice" : "Quote"} ${ref} from ${b.name}`;
      const body = `Hi ${client.name},%0D%0A%0D%0AHere's your ${isInvoice ? "invoice" : "quote"}: ${hostedLink(token)}%0D%0A%0D%0AThanks,%0D%0A${b.name}`;
      await Linking.openURL(`mailto:?subject=${encodeURIComponent(subject)}&body=${body}`);
      finishSend("Emailed · delivery and viewed status will appear here");
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Button label="‹ Back" variant="secondary" minHeight={36} onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: theme.fonts.heading, fontSize: 18, color: theme.colors.text }}>
            {isInvoice ? "Tax Invoice" : "Quotation"}
          </Text>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.neutral[600] }}>PDF · {ref}</Text>
        </View>
        <Tag label="A4" variant="neutral" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, backgroundColor: theme.colors.neutral[200] }} style={{ flex: 1 }}>
        <BlueprintBox style={{ backgroundColor: "#fff", padding: 20 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 14,
              paddingBottom: 14,
              borderBottomWidth: 2,
              borderBottomColor: theme.colors.accent.accent,
            }}
          >
            <View>
              <Text style={{ fontFamily: theme.fonts.heading, fontWeight: "600", fontSize: 22, color: theme.colors.accent[800] }}>{b.name}</Text>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 9.5, lineHeight: 15, color: theme.colors.neutral[700], marginTop: 6 }}>
                {b.licence ? `Lic. ${b.licence} · ` : ""}ABN {b.abn}
                {"\n"}
                {b.address}
                {"\n"}
                {b.phone}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: theme.colors.neutral[600] }}>
                {isInvoice ? "Tax Invoice" : "Quotation"}
              </Text>
              <Text style={{ fontFamily: theme.fonts.heading, fontSize: 17, color: theme.colors.text, marginTop: 2 }}>{ref}</Text>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 9.5, color: theme.colors.neutral[700], marginTop: 4, textAlign: "right" }}>
                {new Date(doc!.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
                {"\n"}
                {dueOrValid}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 14, marginTop: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 8.5, letterSpacing: 1.2, textTransform: "uppercase", color: theme.colors.neutral[600] }}>
                Prepared for
              </Text>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, lineHeight: 17, color: theme.colors.text, marginTop: 3 }}>
                {client.name}
                {"\n"}
                {client.address}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 8.5, letterSpacing: 1.2, textTransform: "uppercase", color: theme.colors.neutral[600] }}>
                Scope
              </Text>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, lineHeight: 17, color: theme.colors.text, marginTop: 3 }}>{scope}</Text>
            </View>
          </View>

          <View style={{ marginTop: 18 }}>
            <View style={{ flexDirection: "row", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: theme.colors.divider }}>
              <Text style={{ width: 18, fontFamily: theme.fonts.body, fontSize: 8.5, color: theme.colors.neutral[600] }}>#</Text>
              <Text style={{ flex: 1, fontFamily: theme.fonts.body, fontSize: 8.5, color: theme.colors.neutral[600] }}>DESCRIPTION</Text>
              <Text style={{ width: 40, fontFamily: theme.fonts.body, fontSize: 8.5, color: theme.colors.neutral[600], textAlign: "right" }}>QTY</Text>
              <Text style={{ width: 55, fontFamily: theme.fonts.body, fontSize: 8.5, color: theme.colors.neutral[600], textAlign: "right" }}>RATE</Text>
              <Text style={{ width: 60, fontFamily: theme.fonts.body, fontSize: 8.5, color: theme.colors.neutral[600], textAlign: "right" }}>AMOUNT</Text>
            </View>
            {lines.map((l, i) => (
              <View key={l.id} style={{ flexDirection: "row", paddingVertical: 6 }}>
                <Text style={{ width: 18, fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.neutral[600] }}>{i + 1}</Text>
                <Text style={{ flex: 1, fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.text }}>{l.label}</Text>
                <Text style={{ width: 40, fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.text, textAlign: "right" }}>
                  {l.qty} {l.unit}
                </Text>
                <Text style={{ width: 55, fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.text, textAlign: "right" }}>{aud(l.rate, true)}</Text>
                <Text style={{ width: 60, fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.text, textAlign: "right" }}>
                  {aud(l.qty * l.rate, true)}
                </Text>
              </View>
            ))}
          </View>

          <View style={{ alignItems: "flex-end", marginTop: 12 }}>
            <View style={{ width: 210 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: theme.colors.divider }}>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.neutral[700] }}>Subtotal (ex GST)</Text>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.text }}>{aud(totals.sub, true)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: theme.colors.divider }}>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.neutral[700] }}>GST 10%</Text>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.text }}>{aud(totals.gst, true)}</Text>
              </View>
              {!isInvoice && b.depositPercent > 0 && (
                <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: theme.colors.divider }}>
                  <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.neutral[700] }}>Deposit on acceptance ({b.depositPercent}%)</Text>
                  <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.text }}>{aud(totals.deposit, true)}</Text>
                </View>
              )}
              {paid > 0 && (
                <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: theme.colors.divider }}>
                  <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.neutral[700] }}>Payment received</Text>
                  <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.text }}>− {aud(paid, true)}</Text>
                </View>
              )}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", padding: 8, marginTop: 6, backgroundColor: theme.colors.accent.accent }}>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 9, letterSpacing: 1.2, textTransform: "uppercase", color: "#fff" }}>Total inc GST</Text>
                <Text style={{ fontFamily: theme.fonts.heading, fontSize: 17, color: "#fff" }}>{aud(isInvoice ? totals.total - paid : totals.total, true)}</Text>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 14, marginTop: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.divider }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 8.5, letterSpacing: 1.2, textTransform: "uppercase", color: theme.colors.neutral[600] }}>
                Payment
              </Text>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 10.5, lineHeight: 16, color: theme.colors.neutral[800], marginTop: 3 }}>
                {isInvoice
                  ? `${b.name} · BSB ${b.bsb || "—"} · Acct ${b.accountNumber || "—"}. Or pay now via the invoice link.`
                  : `Deposit of ${aud(totals.deposit, true)} on acceptance. Balance on completion by transfer or card.`}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 8.5, letterSpacing: 1.2, textTransform: "uppercase", color: theme.colors.neutral[600] }}>
                Terms
              </Text>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 10.5, lineHeight: 16, color: theme.colors.neutral[800], marginTop: 3 }}>
                Quote valid 30 days. Variations quoted separately. All work to AS/NZS 3000.
              </Text>
            </View>
          </View>
        </BlueprintBox>
      </ScrollView>

      <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.divider, padding: 16, flexDirection: "row", gap: 8 }}>
        {!isInvoice && (
          <Button label="Edit" variant="secondary" minHeight={44} onPress={() => navigation.navigate("QuoteBuilder", { quoteId: quoteId })} />
        )}
        {outstanding && (
          <Button label="Record payment" variant="secondary" minHeight={44} onPress={() => setPayOpen(true)} />
        )}
        {outstanding && (
          <Button label="Resend invoice" variant="secondary" flex minHeight={44} disabled={resending} onPress={onResend} />
        )}
        <Button
          label={isInvoice ? "Send invoice" : "Send quote"}
          variant="primary"
          flex={!outstanding}
          minHeight={44}
          onPress={() => setSheetOpen(true)}
        />
      </View>

      <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <Text style={{ fontFamily: theme.fonts.heading, fontSize: 22, color: theme.colors.text }}>
          Send {isInvoice ? "invoice" : "quote"}
        </Text>
        <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.neutral[700], marginTop: 4 }}>
          {client.name} · {aud(totals.total, true)}
        </Text>
        <View style={{ gap: 9, marginTop: 16 }}>
          <Button variant="secondary" minHeight={52} disabled={sending} onPress={onShareFile}>
            <View style={{ alignItems: "flex-start", flex: 1 }}>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.text }}>Share sheet</Text>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.neutral[600] }}>SMS, WhatsApp, Mail — sends the real PDF</Text>
            </View>
          </Button>
          <Button variant="secondary" minHeight={52} disabled={sending} onPress={onCopyLink}>
            <View style={{ alignItems: "flex-start", flex: 1 }}>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.text }}>Copy accept link</Text>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.neutral[600] }}>
                Client taps {isInvoice ? "Pay now" : "Accept"} on the link
              </Text>
            </View>
          </Button>
          <Button variant="secondary" minHeight={52} disabled={sending} onPress={onEmail}>
            <View style={{ alignItems: "flex-start", flex: 1 }}>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.text }}>Email with a message</Text>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.neutral[600] }}>Editable note, link included</Text>
            </View>
          </Button>
        </View>
        <Button label="Cancel" variant="ghost" minHeight={40} style={{ marginTop: 8, borderWidth: 0 }} onPress={() => setSheetOpen(false)} />
      </Sheet>

      {outstanding && (
        <Sheet visible={payOpen} onClose={() => setPayOpen(false)}>
          <Text style={{ fontFamily: theme.fonts.heading, fontSize: 22, color: theme.colors.text }}>Record payment</Text>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.neutral[700], marginTop: 4 }}>
            {ref} · {aud(Math.max(0, totals.balance), true)} outstanding
          </Text>
          <View style={{ gap: 9, marginTop: 16 }}>
            <Button variant="secondary" minHeight={48} onPress={() => pay(totals.balance)}>
              <View style={{ flexDirection: "row", flex: 1, justifyContent: "space-between", width: "100%" }}>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.text }}>Paid in full</Text>
                <Text style={{ fontFamily: theme.fonts.heading, fontSize: 15, color: theme.colors.text }}>
                  {aud(totals.balance, true)}
                </Text>
              </View>
            </Button>
            <Button variant="secondary" minHeight={48} onPress={() => pay(totals.deposit)}>
              <View style={{ flexDirection: "row", flex: 1, justifyContent: "space-between", width: "100%" }}>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.text }}>Deposit only</Text>
                <Text style={{ fontFamily: theme.fonts.heading, fontSize: 15, color: theme.colors.text }}>
                  {aud(totals.deposit, true)}
                </Text>
              </View>
            </Button>
          </View>

          <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: theme.colors.neutral[600], marginTop: 18 }}>
            Or enter a part payment
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8, alignItems: "center" }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                flex: 1,
                minHeight: 44,
                borderWidth: 1,
                borderColor: theme.colors.divider,
                backgroundColor: theme.colors.surface,
                paddingHorizontal: 12,
              }}
            >
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.neutral[600] }}>$</Text>
              <TextInput
                value={customAmount}
                onChangeText={setCustomAmount}
                placeholder={(Math.round((totals.balance / 2) * 100) / 100).toFixed(2)}
                placeholderTextColor={theme.colors.neutral[500]}
                keyboardType="decimal-pad"
                style={{ flex: 1, marginLeft: 4, fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.text, minHeight: 42 }}
              />
            </View>
            <Button label="Record" variant="primary" minHeight={44} onPress={payCustom} />
          </View>
          <Button
            label="Cancel"
            variant="ghost"
            minHeight={40}
            style={{ marginTop: 8, borderWidth: 0 }}
            onPress={() => {
              setCustomAmount("");
              setPayOpen(false);
            }}
          />
        </Sheet>
      )}
      <Toast message={toast} />
    </SafeAreaView>
  );
}
