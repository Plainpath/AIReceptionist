import React, { useState } from "react";
import { ActivityIndicator, Linking, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { useTheme } from "../theme/ThemeProvider";
import { useDeleteSafetyDoc, useSafetyDocs, useUploadSafetyDoc } from "../api/hooks";
import { API_URL } from "../api/client";
import { BlueprintBox } from "../components/Blueprint";
import { Button } from "../components/Button";
import { Tag } from "../components/Tag";
import { Sheet } from "../components/Sheet";
import { Toast, useToast } from "../components/Toast";
import type { RootScreenProps } from "../navigation/types";
import type { SafetyDocument } from "../api/types";

const CATEGORIES: SafetyDocument["category"][] = ["JSA", "SWMS", "Other"];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SafetyLibraryScreen({ navigation }: RootScreenProps<"SafetyLibrary">) {
  const theme = useTheme();
  const docs = useSafetyDocs();
  const upload = useUploadSafetyDoc();
  const remove = useDeleteSafetyDoc();
  const { toast, flash } = useToast();
  const [picked, setPicked] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [category, setCategory] = useState<SafetyDocument["category"]>("JSA");

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    });
    if (result.canceled || !result.assets?.[0]) return;
    setPicked(result.assets[0]);
    setCategory("JSA");
  };

  const confirmUpload = async () => {
    if (!picked) return;
    try {
      await upload.mutateAsync({
        uri: picked.uri,
        name: picked.name,
        mimeType: picked.mimeType || "application/octet-stream",
        title: picked.name,
        category,
      });
      flash(`${picked.name} uploaded`);
      setPicked(null);
    } catch {
      flash("Upload failed — check the file type and try again");
    }
  };

  const openDoc = (doc: SafetyDocument) => Linking.openURL(`${API_URL}/safety-docs/${doc.id}/file`);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Button label="‹ Back" variant="secondary" minHeight={36} onPress={() => navigation.goBack()} />
        <Text style={{ fontFamily: theme.fonts.heading, fontSize: 18, color: theme.colors.text, flex: 1 }}>Safety library</Text>
        <Button label="Upload" variant="primary" minHeight={36} onPress={pickFile} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        {docs.isLoading && <ActivityIndicator style={{ marginTop: 24 }} />}
        {!docs.isLoading && (docs.data || []).length === 0 && (
          <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.neutral[600], textAlign: "center", marginTop: 30 }}>
            No JSAs or SWMS uploaded yet. Tap Upload to add your first one.
          </Text>
        )}
        {(docs.data || []).map((doc) => (
          <BlueprintBox key={doc.id} style={{ padding: 13, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <Text style={{ fontFamily: theme.fonts.heading, fontSize: 14.5, color: theme.colors.text }} numberOfLines={1}>
                  {doc.title}
                </Text>
                <Tag label={doc.category} variant="accent" />
              </View>
              <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.neutral[600], marginTop: 3 }}>
                {formatSize(doc.sizeBytes)} · {new Date(doc.uploadedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
              </Text>
            </View>
            <Button label="Open" variant="secondary" minHeight={36} onPress={() => openDoc(doc)} />
            <Button
              variant="ghost"
              minHeight={36}
              style={{ width: 36, paddingHorizontal: 0 }}
              onPress={() => remove.mutate(doc.id)}
            >
              <Text style={{ color: theme.colors.neutral[600], fontSize: 15 }}>✕</Text>
            </Button>
          </BlueprintBox>
        ))}
      </ScrollView>

      <Sheet visible={!!picked} onClose={() => setPicked(null)}>
        {picked && (
          <>
            <Text style={{ fontFamily: theme.fonts.heading, fontSize: 20, color: theme.colors.text }}>Upload document</Text>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.neutral[700], marginTop: 4 }} numberOfLines={1}>
              {picked.name}
            </Text>
            <Text style={{ fontFamily: theme.fonts.body, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: theme.colors.neutral[600], marginTop: 16 }}>
              Category
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              {CATEGORIES.map((c) => (
                <Button
                  key={c}
                  label={c}
                  variant={category === c ? "primary" : "secondary"}
                  minHeight={38}
                  onPress={() => setCategory(c)}
                />
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 18 }}>
              <Button label="Cancel" variant="secondary" flex minHeight={44} onPress={() => setPicked(null)} />
              <Button label="Upload" variant="primary" flex minHeight={44} disabled={upload.isPending} onPress={confirmUpload} />
            </View>
          </>
        )}
      </Sheet>
      <Toast message={toast} />
    </SafeAreaView>
  );
}
