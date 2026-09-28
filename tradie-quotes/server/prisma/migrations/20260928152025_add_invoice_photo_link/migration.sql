-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_JobPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "latitude" REAL,
    "longitude" REAL,
    "takenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceId" TEXT,
    CONSTRAINT "JobPhoto_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JobPhoto_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_JobPhoto" ("businessId", "filename", "id", "jobId", "latitude", "longitude", "mimeType", "sizeBytes", "storedName", "takenAt") SELECT "businessId", "filename", "id", "jobId", "latitude", "longitude", "mimeType", "sizeBytes", "storedName", "takenAt" FROM "JobPhoto";
DROP TABLE "JobPhoto";
ALTER TABLE "new_JobPhoto" RENAME TO "JobPhoto";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
