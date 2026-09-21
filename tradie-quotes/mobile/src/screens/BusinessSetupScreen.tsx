import React, { useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { useTheme, useThemeMode } from "../theme/ThemeProvider";
import { useAddEmployee, useBusiness, useEmployees, useRemoveEmployee, useUpdateBusiness } from "../api/hooks";
import { BlueprintBox } from "../components/Blueprint";
import { Button } from "../components/Button";
import { SegmentedControl } from "../components/SegmentedControl";
import { Sheet } from "../components/Sheet";
import { Tag } from "../components/Tag";
import { Toast, useToast } from "../components/Toast";
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

export function BusinessSetupScreen({ navigation }: TabScreenProps<"Business">) {
  const theme = useTheme();
  const { mode, setMode } = useThemeMode();
  const business = useBusiness();
  const update = useUpdateBusiness();
  const employees = useEmployees();
  const addEmployee = useAddEmployee();
  const removeEmployee = useRemoveEmployee();
  const { toast, flash } = useToast();
  const [local, setLocal] = useState<Record<string, string>>({});
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");

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

  const commitSeats = () => {
    const v = local.employeeSeats;
    const n = v != null ? parseInt(v, 10) : NaN;
    if (!Number.isNaN(n) && n !== b.employeeSeats) update.mutate({ employeeSeats: n });
  };

  const submitInvite = () => {
    if (!inviteName.trim() || !inviteEmail.trim() || invitePassword.length < 8) {
      return flash("Name, email and an 8+ char password are required");
    }
    addEmployee.mutate(
      { name: inviteName.trim(), email: inviteEmail.trim(), password: invitePassword },
      {
        onSuccess: () => {
          setInviteOpen(false);
          setInviteName("");
          setInviteEmail("");
          setInvitePassword("");
          flash("Employee added");
        },
        onError: (err: any) => flash(err?.response?.data?.error || "Couldn't add employee"),
      }
    );
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
          Appearance
        </Text>
        <SegmentedControl
          value={mode}
          onChange={setMode}
          options={[
            { label: "Light", value: "light" },
            { label: "Dark", value: "dark" },
          ]}
        />

        <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 24, marginBottom: 9 }}>
          <Text
            style={{
              flex: 1,
              fontFamily: theme.fonts.body,
              fontSize: 10,
              letterSpacing: 1.6,
              textTransform: "uppercase",
              color: theme.colors.neutral[700],
            }}
          >
            Team
          </Text>
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.neutral[600] }}>
            {employees.data ? `${employees.data.seatsUsed}/${employees.data.seatLimit} seats` : ""}
          </Text>
        </View>
        <BlueprintBox>
          {(employees.data?.users || []).map((u, i) => (
            <View
              key={u.id}
              style={{ padding: 13, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.colors.divider, flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 13.5, color: theme.colors.text }}>{u.name}</Text>
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.neutral[600], marginTop: 2 }}>{u.email}</Text>
              </View>
              <Tag label={u.role} variant={u.role === "Owner" ? "accent" : "outline"} />
              {u.role === "Employee" && (
                <Button
                  variant="ghost"
                  minHeight={26}
                  style={{ width: 26, paddingHorizontal: 0 }}
                  onPress={() => removeEmployee.mutate(u.id)}
                >
                  <Text style={{ color: theme.colors.neutral[600], fontSize: 14 }}>✕</Text>
                </Button>
              )}
            </View>
          ))}
        </BlueprintBox>
        <Field
          label="Employee seats (limit)"
          value={val("employeeSeats", String(b.employeeSeats))}
          onChangeText={(v) => setLocal((s) => ({ ...s, employeeSeats: v.replace(/[^0-9]/g, "") }))}
          onBlur={commitSeats}
        />
        <Button
          label="+ Add employee"
          variant="secondary"
          minHeight={40}
          style={{ marginTop: 10 }}
          disabled={!!employees.data && employees.data.seatsUsed >= employees.data.seatLimit}
          onPress={() => setInviteOpen(true)}
        />

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
          Safety
        </Text>
        <BlueprintBox
          style={{ padding: 13, flexDirection: "row", alignItems: "center", gap: 10 }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 13.5, color: theme.colors.text }}>JSA / SWMS library</Text>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.neutral[600], marginTop: 2 }}>
              Upload and manage your safety documents
            </Text>
          </View>
          <Button label="Open" variant="secondary" minHeight={38} onPress={() => navigation.navigate("SafetyLibrary")} />
        </BlueprintBox>

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

        <Text
          style={{
            textAlign: "center",
            fontFamily: theme.fonts.body,
            fontSize: 11,
            color: theme.colors.neutral[500],
            marginTop: 22,
          }}
        >
          Tradie Quotes · v{Constants.expoConfig?.version || "1.0.0"}
        </Text>
      </ScrollView>

      <Sheet visible={inviteOpen} onClose={() => setInviteOpen(false)}>
        <Text style={{ fontFamily: theme.fonts.heading, fontSize: 20, color: theme.colors.text }}>Add employee</Text>
        <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.neutral[700], marginTop: 4 }}>
          They'll sign in with this email and password — sees jobs, calendar, clients and their own timesheet, not money or business settings.
        </Text>
        <View style={{ gap: 12, marginTop: 16 }}>
          <Field label="Name" value={inviteName} onChangeText={setInviteName} onBlur={() => {}} />
          <Field label="Email" value={inviteEmail} onChangeText={setInviteEmail} onBlur={() => {}} />
          <Field label="Temporary password" value={invitePassword} onChangeText={setInvitePassword} onBlur={() => {}} />
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 18 }}>
          <Button label="Cancel" variant="secondary" flex minHeight={44} onPress={() => setInviteOpen(false)} />
          <Button label="Add" variant="primary" flex minHeight={44} disabled={addEmployee.isPending} onPress={submitInvite} />
        </View>
      </Sheet>
      <Toast message={toast} />
    </SafeAreaView>
  );
}
