import React, { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Linking, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useTheme } from "../theme/ThemeProvider";
import {
  useClients,
  useCreateJob,
  useJobPhotos,
  useJobs,
  useNotifyArrival,
  useRescheduleJob,
  useUpdateJobStatus,
  useUploadJobPhoto,
} from "../api/hooks";
import { API_URL } from "../api/client";
import { BlueprintBox } from "../components/Blueprint";
import { Button } from "../components/Button";
import { JobCard } from "../components/JobCard";
import { Sheet } from "../components/Sheet";
import { Tag } from "../components/Tag";
import { Toast, useToast } from "../components/Toast";
import type { TabScreenProps } from "../navigation/types";
import type { Job } from "../api/types";

const STATUSES: Job["status"][] = ["Scheduled", "In progress", "Completed", "Cancelled"];

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday start
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() + diff);
  return s;
}

export function CalendarScreen({}: TabScreenProps<"Calendar">) {
  const theme = useTheme();
  const { toast, flash } = useToast();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY_MS)), [weekStart]);
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS);

  const jobs = useJobs(weekStart.toISOString(), weekEnd.toISOString());
  const reschedule = useRescheduleJob();
  const clients = useClients();
  const createJob = useCreateJob();
  const updateStatus = useUpdateJobStatus();
  const notifyArrival = useNotifyArrival();

  const [detailsJob, setDetailsJob] = useState<Job | null>(null);
  const photos = useJobPhotos(detailsJob?.id || null);
  const uploadPhoto = useUploadJobPhoto(detailsJob?.id || "");

  const addPhoto = async () => {
    if (!detailsJob) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return flash("Photo library permission needed");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    let latitude: number | undefined;
    let longitude: number | undefined;
    try {
      const locPerm = await Location.requestForegroundPermissionsAsync();
      if (locPerm.granted) {
        const pos = await Location.getCurrentPositionAsync({});
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      }
    } catch {
      // Location optional — photo still uploads without it.
    }

    try {
      await uploadPhoto.mutateAsync({
        uri: asset.uri,
        name: asset.fileName || `job-photo-${Date.now()}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
        latitude,
        longitude,
      });
      flash(latitude != null ? "Photo added with location" : "Photo added");
    } catch {
      flash("Photo upload failed");
    }
  };

  const [createOpen, setCreateOpen] = useState(false);
  const [createDay, setCreateDay] = useState<Date | null>(null);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [startHour, setStartHour] = useState(9);

  const dayRects = useRef<{ x: number; y: number; width: number; height: number }[]>(days.map(() => ({ x: 0, y: 0, width: 0, height: 0 })));
  const dayRefs = useRef<(View | null)[]>([]);
  const [activeDay, setActiveDay] = useState<number | null>(null);

  const measureAll = () => {
    dayRefs.current.forEach((ref, i) => {
      ref?.measureInWindow((x, y, width, height) => {
        dayRects.current[i] = { x, y, width, height };
      });
    });
  };

  const dayIndexAt = (x: number, y: number) => {
    for (let i = 0; i < dayRects.current.length; i++) {
      const r = dayRects.current[i];
      if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) return i;
    }
    return -1;
  };

  const onCardMove = (x: number, y: number) => setActiveDay(dayIndexAt(x, y) >= 0 ? dayIndexAt(x, y) : null);

  const onCardDrop = (job: Job, x: number, y: number) => {
    setActiveDay(null);
    const targetDay = dayIndexAt(x, y);
    if (targetDay < 0) return;
    const oldStart = new Date(job.scheduledStart);
    const oldEnd = new Date(job.scheduledEnd);
    const durationMs = oldEnd.getTime() - oldStart.getTime();
    const newStart = new Date(days[targetDay]);
    newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0);
    if (newStart.toDateString() === oldStart.toDateString()) return;
    const newEnd = new Date(newStart.getTime() + durationMs);
    reschedule.mutate(
      { id: job.id, scheduledStart: newStart.toISOString(), scheduledEnd: newEnd.toISOString() },
      { onSuccess: () => flash(`${job.title} moved to ${days[targetDay].toLocaleDateString("en-AU", { weekday: "long" })}`) }
    );
  };

  const jobsByDay = (day: Date) =>
    (jobs.data || [])
      .filter((j) => new Date(j.scheduledStart).toDateString() === day.toDateString())
      .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());

  const openCreate = (day: Date) => {
    setCreateDay(day);
    setTitle("");
    setClientId(clients.data?.[0]?.id || null);
    setStartHour(9);
    setCreateOpen(true);
  };

  const submitCreate = () => {
    if (!createDay || !clientId || !title.trim()) return flash("Add a title and pick a client first");
    const start = new Date(createDay);
    start.setHours(startHour, 0, 0, 0);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    createJob.mutate(
      { clientId, title: title.trim(), scheduledStart: start.toISOString(), scheduledEnd: end.toISOString() },
      { onSuccess: () => { setCreateOpen(false); flash("Job scheduled"); } }
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={["top", "left", "right"]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, flexDirection: "row", alignItems: "center" }}>
        <Text style={{ fontFamily: theme.fonts.heading, fontWeight: "600", fontSize: 26, color: theme.colors.text, flex: 1 }}>Calendar</Text>
        <Button label="‹" variant="secondary" minHeight={36} style={{ width: 36, paddingHorizontal: 0 }} onPress={() => setWeekStart(new Date(weekStart.getTime() - 7 * DAY_MS))} />
        <View style={{ width: 8 }} />
        <Button label="›" variant="secondary" minHeight={36} style={{ width: 36, paddingHorizontal: 0 }} onPress={() => setWeekStart(new Date(weekStart.getTime() + 7 * DAY_MS))} />
      </View>
      <Text style={{ paddingHorizontal: 16, marginTop: 4, fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.neutral[600] }}>
        {weekStart.toLocaleDateString("en-AU", { day: "numeric", month: "short" })} – {new Date(weekEnd.getTime() - DAY_MS).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
        {"  ·  drag a job onto another day to reschedule"}
      </Text>

      {jobs.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} onLayout={measureAll}>
          {days.map((day, i) => {
            const isToday = day.toDateString() === new Date().toDateString();
            const dayJobs = jobsByDay(day);
            return (
              <View
                key={i}
                ref={(r) => {
                  dayRefs.current[i] = r;
                }}
                onLayout={measureAll}
                collapsable={false}
              >
                <BlueprintBox
                  elevation={activeDay === i ? 3 : 1}
                  style={{
                    padding: 10,
                    borderWidth: activeDay === i ? 2 : 0,
                    borderColor: theme.colors.accent.accent,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                    <Text style={{ fontFamily: theme.fonts.heading, fontSize: 13, color: isToday ? theme.colors.accent.accent : theme.colors.text }}>
                      {day.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
                    </Text>
                    {isToday && <Text style={{ fontFamily: theme.fonts.body, fontSize: 10, color: theme.colors.accent.accent, marginLeft: 6 }}>· today</Text>}
                    <View style={{ flex: 1 }} />
                    <Button label="+ Job" variant="ghost" minHeight={26} style={{ paddingHorizontal: 4 }} onPress={() => openCreate(day)} />
                  </View>
                  {dayJobs.length === 0 && (
                    <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.neutral[500], paddingVertical: 6 }}>No jobs</Text>
                  )}
                  {dayJobs.map((job) => (
                    <JobCard key={job.id} job={job} onMove={onCardMove} onDrop={onCardDrop} onOpenDetails={setDetailsJob} />
                  ))}
                </BlueprintBox>
              </View>
            );
          })}
        </ScrollView>
      )}

      <Sheet visible={createOpen} onClose={() => setCreateOpen(false)}>
        <Text style={{ fontFamily: theme.fonts.heading, fontSize: 20, color: theme.colors.text }}>
          New job · {createDay?.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short" })}
        </Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Job title"
          placeholderTextColor={theme.colors.neutral[500]}
          style={{
            marginTop: 14,
            minHeight: 42,
            borderWidth: 1,
            borderColor: theme.colors.divider,
            backgroundColor: theme.colors.surface,
            paddingHorizontal: 12,
            fontFamily: theme.fonts.body,
            fontSize: 14,
            color: theme.colors.text,
          }}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 10 }}>
          {["Switchboard upgrade", "Safety switch install", "Follow-up visit", "Site inspection"].map((t) => (
            <Button key={t} label={t} variant={title === t ? "primary" : "secondary"} minHeight={34} onPress={() => setTitle(t)} />
          ))}
        </ScrollView>

        <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: theme.colors.neutral[600], marginTop: 16 }}>
          Client
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 8 }}>
          {(clients.data || []).map((c) => (
            <Button key={c.id} label={c.name} variant={clientId === c.id ? "primary" : "secondary"} minHeight={34} onPress={() => setClientId(c.id)} />
          ))}
        </ScrollView>

        <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: theme.colors.neutral[600], marginTop: 16 }}>
          Start time
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 8 }}>
          {[7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((h) => (
            <Button
              key={h}
              label={`${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`}
              variant={startHour === h ? "primary" : "secondary"}
              minHeight={34}
              onPress={() => setStartHour(h)}
            />
          ))}
        </ScrollView>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 20 }}>
          <Button label="Cancel" variant="secondary" flex minHeight={44} onPress={() => setCreateOpen(false)} />
          <Button label="Schedule" variant="primary" flex minHeight={44} disabled={createJob.isPending} onPress={submitCreate} />
        </View>
      </Sheet>

      <Sheet visible={!!detailsJob} onClose={() => setDetailsJob(null)}>
        {detailsJob && (
          <ScrollView style={{ maxHeight: 480 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontFamily: theme.fonts.heading, fontSize: 20, color: theme.colors.text, flex: 1 }}>{detailsJob.title}</Text>
              <Tag label={detailsJob.status} variant="accent" />
            </View>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.neutral[700], marginTop: 4 }}>
              {detailsJob.client.name} · {new Date(detailsJob.scheduledStart).toLocaleString("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
            </Text>

            <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: theme.colors.neutral[600], marginTop: 16 }}>
              Status
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {STATUSES.map((s) => (
                <Button
                  key={s}
                  label={s}
                  variant={detailsJob.status === s ? "primary" : "secondary"}
                  minHeight={34}
                  onPress={() => {
                    updateStatus.mutate({ id: detailsJob.id, status: s });
                    setDetailsJob({ ...detailsJob, status: s });
                  }}
                />
              ))}
            </View>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
              <Button
                label="Directions"
                variant="secondary"
                flex
                minHeight={40}
                onPress={() =>
                  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(detailsJob.client.address || "")}`)
                }
              />
              <Button
                label="On my way"
                variant="secondary"
                flex
                minHeight={40}
                disabled={notifyArrival.isPending}
                onPress={() =>
                  notifyArrival.mutate(detailsJob.id, {
                    onSuccess: (r) => flash(r.sent ? "Arrival window emailed" : "Arrival window logged (no email on file)"),
                  })
                }
              />
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 20 }}>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: theme.colors.neutral[600], flex: 1 }}>
                Photos
              </Text>
              <Button label="+ Add photo" variant="ghost" minHeight={26} style={{ paddingHorizontal: 4 }} disabled={uploadPhoto.isPending} onPress={addPhoto} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 8 }}>
              {(photos.data || []).length === 0 && (
                <Text style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.neutral[500] }}>No photos yet</Text>
              )}
              {(photos.data || []).map((p) => (
                <View key={p.id} style={{ width: 84 }}>
                  <Image source={{ uri: `${API_URL}/jobs/${detailsJob.id}/photos/${p.id}/file` }} style={{ width: 84, height: 84, borderRadius: theme.radius.sm, backgroundColor: theme.colors.neutral[200] }} />
                  <Text style={{ fontFamily: theme.fonts.body, fontSize: 9.5, color: theme.colors.neutral[600], marginTop: 3 }} numberOfLines={2}>
                    {new Date(p.takenAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                    {p.latitude != null ? ` · ${p.latitude.toFixed(3)},${p.longitude!.toFixed(3)}` : ""}
                  </Text>
                </View>
              ))}
            </ScrollView>

            <Button label="Close" variant="ghost" minHeight={40} style={{ marginTop: 18, borderWidth: 0 }} onPress={() => setDetailsJob(null)} />
          </ScrollView>
        )}
      </Sheet>
      <Toast message={toast} />
    </SafeAreaView>
  );
}
