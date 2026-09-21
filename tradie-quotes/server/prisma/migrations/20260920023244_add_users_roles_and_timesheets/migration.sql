-- CreateTable
CREATE TABLE "TimesheetEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT,
    "clockIn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clockOut" DATETIME,
    "note" TEXT,
    CONSTRAINT "TimesheetEntry_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TimesheetEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TimesheetEntry_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Business" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "accentColor" TEXT NOT NULL DEFAULT '#5980a6',
    "abn" TEXT NOT NULL,
    "licence" TEXT,
    "gstRegistered" BOOLEAN NOT NULL DEFAULT true,
    "bsb" TEXT,
    "accountNumber" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "depositPercent" INTEGER NOT NULL DEFAULT 20,
    "defaultShape" TEXT NOT NULL DEFAULT 'Labour + materials',
    "showLeadSources" BOOLEAN NOT NULL DEFAULT true,
    "nextQuoteSeq" INTEGER NOT NULL DEFAULT 220,
    "nextInvoiceSeq" INTEGER NOT NULL DEFAULT 143,
    "employeeSeats" INTEGER NOT NULL DEFAULT 3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Business" ("abn", "accentColor", "accountNumber", "address", "bsb", "createdAt", "defaultShape", "depositPercent", "gstRegistered", "id", "licence", "name", "nextInvoiceSeq", "nextQuoteSeq", "phone", "showLeadSources") SELECT "abn", "accentColor", "accountNumber", "address", "bsb", "createdAt", "defaultShape", "depositPercent", "gstRegistered", "id", "licence", "name", "nextInvoiceSeq", "nextQuoteSeq", "phone", "showLeadSources" FROM "Business";
DROP TABLE "Business";
ALTER TABLE "new_Business" RENAME TO "Business";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Owner',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_User" ("businessId", "createdAt", "email", "id", "name", "passwordHash") SELECT "businessId", "createdAt", "email", "id", "name", "passwordHash" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
