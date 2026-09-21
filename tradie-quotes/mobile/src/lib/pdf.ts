import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { API_URL } from "../api/client";
import AsyncStorage from "@react-native-async-storage/async-storage";

async function downloadAndShare(url: string, filename: string, mimeType: string, uti?: string) {
  const token = await AsyncStorage.getItem("tradie-quotes/token");
  const dir = new Directory(Paths.cache, "docs");
  if (!dir.exists) dir.create({ intermediates: true });
  const dest = new File(dir, filename);
  if (dest.exists) dest.delete();

  const file = await File.downloadFileAsync(url, dest, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, UTI: uti });
  }
  return file.uri;
}

export async function shareDocPdf(kind: "quotes" | "invoices", id: string, ref: string) {
  return downloadAndShare(`${API_URL}/${kind}/${id}/pdf`, `${ref}.pdf`, "application/pdf", "com.adobe.pdf");
}

export async function shareAccountingCsv(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  return downloadAndShare(
    `${API_URL}/accounting/export.csv${qs ? `?${qs}` : ""}`,
    "paid-invoices.csv",
    "text/csv",
    "public.comma-separated-values-text"
  );
}
