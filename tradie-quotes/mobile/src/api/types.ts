export type Business = {
  id: string;
  name: string;
  accentColor: string;
  abn: string;
  licence: string | null;
  gstRegistered: boolean;
  bsb: string | null;
  accountNumber: string | null;
  address: string | null;
  phone: string | null;
  depositPercent: number;
  defaultShape: QuoteShape;
  showLeadSources: boolean;
  employeeSeats: number;
  services: ConnectedService[];
};

export type ConnectedService = { id: string; name: string; note: string | null; state: string };

export type Client = {
  id: string;
  name: string;
  address: string | null;
  origin: string;
};

export type ClientDetail = Client & {
  outstanding: number;
  lifetime: number;
  activity: ActivityEvent[];
};

export type ActivityEvent = {
  id: string;
  kind: string;
  text: string;
  occurredAt: string;
  amount: number | null;
  quote?: { ref: string } | null;
  invoice?: { ref: string } | null;
};

export type Lead = {
  id: string;
  source: string;
  snippet: string;
  status: string;
  receivedAt: string;
  client: Client;
};

export type PriceBookItem = { id: string; label: string; rate: number; unit: string };

export type QuoteShape = "Flat price" | "Labour + materials" | "Itemised";

export type Line = { id: string; label: string; qty: number; unit: string; rate: number };

export type Totals = { sub: number; gst: number; total: number; deposit: number; balance: number };

export type Quote = {
  id: string;
  ref: string;
  shape: QuoteShape;
  status: "Draft" | "Sent" | "Accepted" | "Declined" | "Invoiced";
  viewedCount: number;
  shareToken: string | null;
  createdAt: string;
  sentAt: string | null;
  client: Client;
  lines: Line[];
  totals: Totals;
  invoice?: { id: string; ref: string } | null;
};

export type Invoice = {
  id: string;
  ref: string;
  status: "Awaiting payment" | "Part paid" | "Paid" | "Overdue";
  createdAt: string;
  dueDate: string | null;
  shareToken: string | null;
  client: Client;
  lines: Line[];
  payments: { id: string; amount: number; method: string; paidAt: string }[];
  paid: number;
  totals: Totals;
  quote?: { ref: string } | null;
};

export type Role = "Owner" | "Employee";

export type Me = { id: string; email: string; name: string; role: Role; businessId: string };

export type Employee = { id: string; email: string; name: string; role: Role; createdAt: string };

export type EmployeesResponse = { seatsUsed: number; seatLimit: number; users: Employee[] };

export type TimesheetEntry = {
  id: string;
  userId: string;
  user: { id: string; name: string };
  jobId: string | null;
  job: { id: string; title: string } | null;
  clockIn: string;
  clockOut: string | null;
  note: string | null;
};

export type PaidInvoiceRow = {
  id: string;
  ref: string;
  client: Client;
  paidAt: string;
  exGst: number;
  gst: number;
  total: number;
};

export type AccountingSummary = {
  from: string | null;
  to: string | null;
  count: number;
  totals: { exGst: number; gst: number; total: number };
  invoices: PaidInvoiceRow[];
};

export type Job = {
  id: string;
  clientId: string;
  quoteId: string | null;
  title: string;
  assignedTo: string | null;
  notes: string | null;
  status: "Scheduled" | "In progress" | "Completed" | "Cancelled";
  scheduledStart: string;
  scheduledEnd: string;
  rescheduledAt: string | null;
  client: Client;
  quote?: { ref: string } | null;
};

export type JobPhoto = {
  id: string;
  jobId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  latitude: number | null;
  longitude: number | null;
  takenAt: string;
};

export type SafetyDocument = {
  id: string;
  title: string;
  category: "JSA" | "SWMS" | "Other";
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
};

export type ParsedVoiceLine = {
  label: string;
  qty: number;
  unit: string;
  rate: number;
  confidence: "High" | "Check";
  detail: string;
};
