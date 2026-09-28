-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InvoiceLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "qty" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "rate" REAL NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVariation" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_InvoiceLine" ("id", "invoiceId", "label", "qty", "rate", "sortOrder", "unit") SELECT "id", "invoiceId", "label", "qty", "rate", "sortOrder", "unit" FROM "InvoiceLine";
DROP TABLE "InvoiceLine";
ALTER TABLE "new_InvoiceLine" RENAME TO "InvoiceLine";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
