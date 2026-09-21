import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import {
  AccountingSummary,
  ActivityEvent,
  Business,
  Client,
  ClientDetail,
  Employee,
  EmployeesResponse,
  Invoice,
  Job,
  JobPhoto,
  Lead,
  Me,
  ParsedVoiceLine,
  PriceBookItem,
  Quote,
  QuoteShape,
  SafetyDocument,
  TimesheetEntry,
} from "./types";

// ---- Auth / team ----
export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: async () => (await api.get<Me>("/auth/me")).data });
}

export function useEmployees() {
  return useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await api.get<EmployeesResponse>("/auth/employees")).data,
  });
}

export function useAddEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; email: string; password: string }) =>
      (await api.post<Employee>("/auth/employees", body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useRemoveEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/auth/employees/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

// ---- Timesheets ----
export function useTimesheets(from?: string, to?: string) {
  return useQuery({
    queryKey: ["timesheets", from, to],
    queryFn: async () => (await api.get<TimesheetEntry[]>("/timesheets", { params: { from, to } })).data,
  });
}

export function useOpenTimesheet() {
  return useQuery({
    queryKey: ["timesheets", "open"],
    queryFn: async () => (await api.get<TimesheetEntry | null>("/timesheets/open")).data,
    refetchInterval: 30000,
  });
}

export function useClockIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId?: string) => (await api.post<TimesheetEntry>("/timesheets/clock-in", { jobId })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timesheets"] });
    },
  });
}

export function useClockOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<TimesheetEntry>(`/timesheets/${id}/clock-out`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timesheets"] });
    },
  });
}

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

export function useUpdateLine(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ lineId, ...patch }: { lineId: string; qty?: number; label?: string; unit?: string; rate?: number }) =>
      (await api.patch(`/quotes/${quoteId}/lines/${lineId}`, patch)).data,
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

// ---- Accounting / BAS ----
export function useAccountingSummary(from?: string, to?: string) {
  return useQuery({
    queryKey: ["accounting-summary", from, to],
    queryFn: async () => (await api.get<AccountingSummary>("/accounting/summary", { params: { from, to } })).data,
  });
}

// ---- Jobs / calendar ----
export function useJobs(fromISO: string, toISO: string) {
  return useQuery({
    queryKey: ["jobs", fromISO, toISO],
    queryFn: async () => (await api.get<Job[]>("/jobs", { params: { from: fromISO, to: toISO } })).data,
  });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { clientId: string; title: string; scheduledStart: string; scheduledEnd: string; notes?: string }) =>
      (await api.post<Job>("/jobs", body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useRescheduleJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, scheduledStart, scheduledEnd }: { id: string; scheduledStart: string; scheduledEnd: string }) =>
      (await api.patch<Job>(`/jobs/${id}`, { scheduledStart, scheduledEnd })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useDeleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/jobs/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useUpdateJobStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Job["status"] }) =>
      (await api.patch<Job>(`/jobs/${id}`, { status })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useNotifyArrival() {
  return useMutation({
    mutationFn: async (jobId: string) =>
      (await api.post<{ sent: boolean; windowStart: string; windowEnd: string }>(`/jobs/${jobId}/notify-arrival`)).data,
  });
}

// ---- Job photos ----
export function useJobPhotos(jobId: string | null) {
  return useQuery({
    queryKey: ["job-photos", jobId],
    queryFn: async () => (await api.get<JobPhoto[]>(`/jobs/${jobId}/photos`)).data,
    enabled: !!jobId,
  });
}

export function useUploadJobPhoto(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { uri: string; name: string; mimeType: string; latitude?: number; longitude?: number }) => {
      const form = new FormData();
      form.append("file", { uri: input.uri, name: input.name, type: input.mimeType } as any);
      if (input.latitude != null) form.append("latitude", String(input.latitude));
      if (input.longitude != null) form.append("longitude", String(input.longitude));
      return (
        await api.post<JobPhoto>(`/jobs/${jobId}/photos`, form, { headers: { "Content-Type": "multipart/form-data" } })
      ).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job-photos", jobId] }),
  });
}

// ---- Safety documents (JSA / SWMS) ----
export function useSafetyDocs() {
  return useQuery({
    queryKey: ["safety-docs"],
    queryFn: async () => (await api.get<SafetyDocument[]>("/safety-docs")).data,
  });
}

export function useUploadSafetyDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { uri: string; name: string; mimeType: string; title: string; category: string }) => {
      const form = new FormData();
      form.append("file", { uri: input.uri, name: input.name, type: input.mimeType } as any);
      form.append("title", input.title);
      form.append("category", input.category);
      return (
        await api.post<SafetyDocument>("/safety-docs", form, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      ).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["safety-docs"] }),
  });
}

export function useDeleteSafetyDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/safety-docs/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["safety-docs"] }),
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
