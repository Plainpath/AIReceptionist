# Tradie Quotes — Hale Electrical

A full-stack implementation of the quoting & invoicing app designed in `project/Tradie Quotes.dc.html`
(see `chats/chat1.md` for the design brief). Two apps:

- **`server/`** — Node.js + TypeScript + Express + Prisma (SQLite) API: auth, leads, clients, price
  book, quotes, invoices, payments, real PDF generation (`pdfkit`), and hosted accept/pay links for
  clients (no login required) at `/public/quotes/:token` and `/public/invoices/:token`.
- **`mobile/`** — Expo (React Native + TypeScript) app: the six screens from the design (lead inbox,
  quote builder, PDF preview, money, client detail, business setup), themed from the Industry design
  system's tokens, wired to the real API.

## Run the backend

```bash
cd server
npm install
npx prisma migrate dev   # creates prisma/dev.db and applies the schema
npx prisma db seed       # (re)seed Hale Electrical fixture data — also runs automatically after migrate
npm run dev              # http://localhost:4000
```

Demo login: `owner@haleelectrical.com.au` / `password123`

## Run the mobile app

```bash
cd mobile
npm install
npm start                # scan the QR with Expo Go, or press i / a for a simulator
```

The app auto-detects the API host from the Expo dev server's LAN address, so the phone/simulator and
the `server` process need to be reachable from each other (same network, or both local).

**Voice capture** (hold-the-mic → parsed line items) uses `expo-speech-recognition`, a native module
that **Expo Go can't load** — it needs a custom dev client (`npx expo run:ios` / `run:android`, or an
EAS dev build). Outside a dev client the mic button falls back to a "type it instead" input that runs
through the same server-side parser (`server/src/lib/voiceParse.ts`), so the feature is always usable,
just not always by voice.

## What's real vs. simulated

- **Real**: auth, database persistence, quote/invoice numbering, GST/deposit maths, PDF generation,
  drag-the-price-book-card and hold-to-talk interactions, the voice→line-item parser, hosted
  accept/pay links clients can open without the app, payment recording.
- **Simulated**: card payments are recorded (not processed) — there's no Stripe/PayWay key wired up,
  so "Pay now" on the hosted invoice link marks the invoice paid rather than charging a card. Outbound
  SMS/email aren't sent by the server; the app hands off to the device's own share sheet, mail client,
  and clipboard so the tradie sends the real link themselves.

## Verified

- `server`: TypeScript compiles clean; migrated + seeded SQLite; full flow tested end-to-end via curl
  (login → lead → quote → voice-parse → PDF → send → accept via hosted link → convert to invoice →
  record payment → client activity feed).
- `mobile`: TypeScript compiles clean across the whole app; Metro bundles the app for Android with no
  errors (1501 modules). I was not able to tap through the UI on a simulator or device in this
  sandbox (none is attached here) — that's worth doing before you call it done.
