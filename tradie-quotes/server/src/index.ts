import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth";
import { businessRouter } from "./routes/business";
import { priceBookRouter } from "./routes/priceBook";
import { clientsRouter } from "./routes/clients";
import { leadsRouter } from "./routes/leads";
import { quotesRouter } from "./routes/quotes";
import { invoicesRouter } from "./routes/invoices";
import { publicRouter } from "./routes/public";
import { safetyDocsRouter } from "./routes/safetyDocs";
import { jobsRouter } from "./routes/jobs";
import { jobPhotosRouter } from "./routes/jobPhotos";
import { startFollowUpScheduler } from "./lib/followUps";
import { accountingRouter } from "./routes/accounting";
import { timesheetsRouter } from "./routes/timesheets";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRouter);
app.use("/business", businessRouter);
app.use("/price-book", priceBookRouter);
app.use("/clients", clientsRouter);
app.use("/leads", leadsRouter);
app.use("/quotes", quotesRouter);
app.use("/invoices", invoicesRouter);
app.use("/public", publicRouter);
app.use("/safety-docs", safetyDocsRouter);
app.use("/jobs", jobsRouter);
app.use("/jobs/:jobId/photos", jobPhotosRouter);
app.use("/accounting", accountingRouter);
app.use("/timesheets", timesheetsRouter);

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => console.log(`tradie-quotes-server listening on :${port}`));
startFollowUpScheduler();
