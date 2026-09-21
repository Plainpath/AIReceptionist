import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { useClockIn, useClockOut, useJobs, useMe, useOpenTimesheet, useTimesheets } from "../api/hooks";
import { BlueprintBox } from "../components/Blueprint";
import { Button } from "../components/Button";
import { Tag } from "../components/Tag";
import { Toast, useToast } from "../components/Toast";
import type { TabScreenProps } from "../navigation/types";

function formatDuration(ms: number) {
  const mins = Math.floor(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function TimesheetScreen({}: TabScreenProps<"Timesheet">) {
  const theme = useTheme();
  const { toast, flash } = useToast();
  const me = useMe();
  const open = useOpenTimesheet();
  const entries = useTimesheets();
  const jobs = useJobs(new Date(Date.now() - 3 * 86400000).toISOString(), new Date(Date.now() + 7 * 86400000).toISOString());
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>(undefined);

  // re-render every 30s so the running duration ticks visibly
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const isOwner = me.data?.role === "Owner";

  const onClockIn = () => {
    clockIn.mutate(selectedJobId, {
      onSuccess: () => flash("Clocked in"),
      onError: () => flash("Couldn't clock in — check you're not already clocked in"),
    });
  };

  const onClockOut = () => {
    if (!open.data) return;
    clockOut.mutate(open.data.id, { onSuccess: () => flash("Clocked out") });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <Text style={{ fontFamily: theme.fonts.heading, fontWeight: "600", fontSize: 26, color: theme.colors.text }}>Timesheet</Text>

        <BlueprintBox elevation={2} style={{ marginTop: 16, padding: 16 }}>
          {open.isLoading ? (
            <ActivityIndicator />
          ) : open.data ? (
            <>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.accent.accent, fontWeight: "600" }}>
                Clocked in{open.data.job ? ` · ${open.data.job.title}` : ""}
              </Text>
              <Text style={{ fontFamily: theme.fonts.heading, fontSize: 28, color: theme.colors.text, marginTop: 4 }}>
                {formatDuration(Date.now() - new Date(open.data.clockIn).getTime())}
              </Text>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.neutral[600], marginTop: 2 }}>
                since {new Date(open.data.clockIn).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}
              </Text>
              <Button label="Clock out" variant="primary" minHeight={46} style={{ marginTop: 14 }} disabled={clockOut.isPending} onPress={onClockOut} />
            </>
          ) : (
            <>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: theme.colors.neutral[600] }}>
                Not clocked in
              </Text>
              {(jobs.data || []).length > 0 && (
                <>
                  <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.neutral[600], marginTop: 12 }}>
                    Attach to a job (optional)
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 8 }}>
                    <Button label="None" variant={!selectedJobId ? "primary" : "secondary"} minHeight={32} onPress={() => setSelectedJobId(undefined)} />
                    {(jobs.data || []).map((j) => (
                      <Button
                        key={j.id}
                        label={j.title}
                        variant={selectedJobId === j.id ? "primary" : "secondary"}
                        minHeight={32}
                        onPress={() => setSelectedJobId(j.id)}
                      />
                    ))}
                  </ScrollView>
                </>
              )}
              <Button label="Clock in" variant="primary" minHeight={46} style={{ marginTop: 14 }} disabled={clockIn.isPending} onPress={onClockIn} />
            </>
          )}
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
          {isOwner ? "Team entries" : "Your entries"}
        </Text>
        <BlueprintBox>
          {entries.isLoading ? (
            <ActivityIndicator style={{ padding: 20 }} />
          ) : (entries.data || []).length === 0 ? (
            <Text style={{ padding: 20, textAlign: "center", fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.neutral[600] }}>
              No timesheet entries yet.
            </Text>
          ) : (
            entries.data!.map((e, i) => {
              const durationMs = e.clockOut ? new Date(e.clockOut).getTime() - new Date(e.clockIn).getTime() : Date.now() - new Date(e.clockIn).getTime();
              return (
                <View
                  key={e.id}
                  style={{ padding: 13, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.colors.divider, flexDirection: "row", alignItems: "center", gap: 10 }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                      <Text style={{ fontFamily: theme.fonts.heading, fontSize: 14, color: theme.colors.text }}>
                        {new Date(e.clockIn).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
                      </Text>
                      {isOwner && <Tag label={e.user.name} variant="outline" />}
                      {!e.clockOut && <Tag label="Active" variant="accent" />}
                    </View>
                    <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.neutral[600], marginTop: 3 }}>
                      {new Date(e.clockIn).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}
                      {" – "}
                      {e.clockOut ? new Date(e.clockOut).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" }) : "now"}
                      {e.job ? ` · ${e.job.title}` : ""}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: theme.fonts.heading, fontSize: 15, color: theme.colors.text }}>{formatDuration(durationMs)}</Text>
                </View>
              );
            })
          )}
        </BlueprintBox>
      </ScrollView>
      <Toast message={toast} />
    </SafeAreaView>
  );
}
