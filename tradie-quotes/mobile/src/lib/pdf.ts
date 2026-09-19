import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { API_URL } from "../api/client";
import AsyncStorage from "@react-native-async-storage/async-storage";

export async function shareDocPdf(kind: "quotes" | "invoices", id: string, ref: string) {
  const token = await AsyncStorage.getItem("tradie-quotes/token");
  const dir = new Directory(Paths.cache, "docs");
  if (!dir.exists) dir.create({ intermediates: true });
  const dest = new File(dir, `${ref}.pdf`);
  if (dest.exists) dest.delete();

  const file = await File.downloadFileAsync(`${API_URL}/${kind}/${id}/pdf`, dest, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
  }
  return file.uri;
}
