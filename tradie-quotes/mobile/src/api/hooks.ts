import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import {
  ActivityEvent,
  Business,
  Client,
  ClientDetail,
  Invoice,
  Lead,
  ParsedVoiceLine,
  PriceBookItem,
  Quote,
  QuoteShape,
} from "./types";

// ---- Business ----
export function useBusiness() {
  return useQuery({ queryKey: ["business"], queryFn: async () => (await api.get<Business>("/business")).data });
}

export function useUpdateBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Business>) => (await api.patch<Business>("/business", patch)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["business"] }),
  });
}

// ---- Price book ----
export function usePriceBook() {
  return useQuery({
    queryKey: ["price-book"],
    queryFn: async () => (await api.get<PriceBookItem[]>("/price-book")).data,
  });
}

// ---- Clients ----
export function useClients() {
  return useQuery({ queryKey: ["clients"], queryFn: async () => (await api.get<Client[]>("/clients")).data });
}

export function useClient(id: string | null) {
  return useQuery({
    queryKey: ["clients", id],
    queryFn: async () => (await api.get<ClientDetail>(`/clients/${id}`)).data,
    enabled: !!id,
  });
}

// ---- Leads ----
export function useLeads() {
  return useQuery({ queryKey: ["leads"], queryFn: async () => (await api.get<Lead[]>("/leads")).data });
}

export function useDismissLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/leads/${id}/dismiss`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

// ---- Quotes ----
export function useQuotes() {
  return useQuery({ queryKey: ["quotes"], queryFn: async () => (await api.get<Quote[]>("/quotes")).data });
}

export function useQuote(id: string | null) {
  return useQuery({
    queryKey: ["quotes", id],
    queryFn: async () => (await api.get<Quote>(`/quotes/${id}`)).data,
    enabled: !!id,
  });
}

function invalidateQuote(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: ["quotes", id] });
  qc.invalidateQueries({ queryKey: ["quotes"] });
  qc.invalidateQueries({ queryKey: ["leads"] });
}

export function useCreateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { leadId?: string; clientId?: string; shape?: QuoteShape; lines?: any[] }) =>
      (await api.post<Quote>("/quotes", body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export function useSetQuoteShape(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (shape: QuoteShape) => (await api.patch<Quote>(`/quotes/${quoteId}`, { shape })).data,
    onSuccess: () => invalidateQuote(qc, quoteId),
  });
}

export function useAddLine(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (line: { label: string; qty: number; unit: string; rate: number }) =>
      (await api.post(`/quotes/${quoteId}/lines`, line)).data,
    onSuccess: () => invalidateQuote(qc, quoteId),
  });
}

export function useAddLinesBulk(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lines: { label: string; qty: number; unit: string; rate: number }[]) =>
      (await api.post(`/quotes/${quoteId}/lines/bulk`, { lines })).data,
    onSuccess: () => invalidateQuote(qc, quoteId),
  });
}

export function useRemoveLine(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lineId: string) => (await api.delete(`/quotes/${quoteId}/lines/${lineId}`)).data,
    onSuccess: () => invalidateQuote(qc, quoteId),
  });
}

export function useVoiceParse(quoteId: string) {
  return useMutation({
    mutationFn: async (transcript: string) =>
      (await api.post<{ transcript: string; parsed: ParsedVoiceLine[] }>(`/quotes/${quoteId}/voice-parse`, {
        transcript,
      })).data,
  });
}

export function useSendQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (quoteId: string) => (await api.post<Quote>(`/quotes/${quoteId}/send`)).data,
    onSuccess: (_d, quoteId) => invalidateQuote(qc, quoteId),
  });
}

export function useAcceptQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (quoteId: string) => (await api.post<Quote>(`/quotes/${quoteId}/accept`)).data,
    onSuccess: (_d, quoteId) => invalidateQuote(qc, quoteId),
  });
}

export function useConvertToInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (quoteId: string) => (await api.post<Invoice>(`/quotes/${quoteId}/convert-to-invoice`)).data,
    onSuccess: (_d, quoteId) => {
      invalidateQuote(qc, quoteId);
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

// ---- Invoices ----
export function useInvoices() {
  return useQuery({ queryKey: ["invoices"], queryFn: async () => (await api.get<Invoice[]>("/invoices")).data });
}

export function useInvoice(id: string | null) {
  return useQuery({
    queryKey: ["invoices", id],
    queryFn: async () => (await api.get<Invoice>(`/invoices/${id}`)).data,
    enabled: !!id,
  });
}

export function useSendInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => (await api.post<Invoice>(`/invoices/${invoiceId}/send`)).data,
    onSuccess: (_d, invoiceId) => {
      qc.invalidateQueries({ queryKey: ["invoices", invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useRecordPayment(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { amount: number; method: string; note?: string }) =>
      (await api.post(`/invoices/${invoiceId}/payments`, body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices", invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}
