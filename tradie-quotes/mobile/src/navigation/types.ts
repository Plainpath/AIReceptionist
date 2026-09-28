import type { NativeStackScreenProps } from "@react-navigation/native-stack";

export type RootStackParamList = {
  Home: undefined;
  Dashboard: undefined;
  Calendar: undefined;
  Money: { tab?: "quotes" | "invoices" } | undefined;
  Clients: undefined;
  Timesheet: undefined;
  Business: undefined;
  QuoteBuilder: { quoteId?: string; leadId?: string; clientId?: string };
  PdfPreview: { quoteId?: string; invoiceId?: string };
  ClientDetail: { clientId: string };
  SafetyLibrary: undefined;
  AccountingSummary: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;
