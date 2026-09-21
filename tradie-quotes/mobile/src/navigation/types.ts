import type { CompositeScreenProps } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";

export type RootStackParamList = {
  Tabs: undefined;
  QuoteBuilder: { quoteId?: string; leadId?: string; clientId?: string };
  PdfPreview: { quoteId?: string; invoiceId?: string };
  ClientDetail: { clientId: string };
  SafetyLibrary: undefined;
  AccountingSummary: undefined;
};

export type TabsParamList = {
  Dashboard: undefined;
  Calendar: undefined;
  Money: { tab?: "quotes" | "invoices" } | undefined;
  Clients: undefined;
  Timesheet: undefined;
  Business: undefined;
};

export type TabScreenProps<T extends keyof TabsParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabsParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;
