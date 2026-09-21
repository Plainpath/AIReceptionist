-- AlterTable
ALTER TABLE "Job" ADD COLUMN "completedAt" DATETIME;
ALTER TABLE "Job" ADD COLUMN "followUpAt" DATETIME;
ALTER TABLE "Job" ADD COLUMN "followUpSentAt" DATETIME;

-- CreateTable
CREATE TABLE "JobPhoto" (
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
    CONSTRAINT "JobPhoto_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
