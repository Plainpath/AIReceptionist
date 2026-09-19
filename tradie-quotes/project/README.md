# Quote & Invoice App — prototype

Interactive design prototype of a quoting and invoicing mobile app for Australian trades, white-labelled here as **Hale Electrical**. Built by PlainPath as an add-on service alongside websites, chat bots and AI secretaries.

## Run it

No build step. Serve the folder and open the file:

```bash
python3 -m http.server 8000
# http://localhost:8000/Tradie%20Quotes.dc.html
```

## What's in here

| Path | What it is |
| --- | --- |
| `Tradie Quotes.dc.html` | The prototype — all screens, logic and styling |
| `support.js` | Runtime that renders the component |
| `ios-frame.jsx` | iPhone device frame |
| `_ds/industry-…/` | "Industry" design system — tokens and component classes |

## Screens

- **Lead inbox** (home) — leads from the site chat bot and AI secretary, with owed / overdue / paid summary and overdue reminder actions.
- **Quote builder** — quote shape chosen per quote (flat price, labour + materials, itemised), drag-up price book, and voice capture that parses a spoken line item into confirmable rows.
- **Client detail** — activity feed blending chat, calls, quotes and payments.
- **PDF preview** — A4 quote/tax invoice with ABN, licence, GST 10%, deposit and bank details; brand colour themes the document.
- **Money** — quotes and invoices with status, plus record full / deposit / part payment.
- **Business setup** — ABN, licence, GST, bank details and connected services.

## Conventions

- Currency AUD, GST 10%, ABN on every document.
- Invoices choose their own payment route: bank transfer on the PDF, or pay-now on the hosted link.
- Theming (brand name, accent colour) reaches the PDF.

## Status

Design prototype, not production code. Data is in-memory fixtures; voice capture is a scripted simulation of speech-to-text.
