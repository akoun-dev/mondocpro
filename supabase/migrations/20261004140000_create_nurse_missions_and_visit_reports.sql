-- FEATURE-NURSE: dispatch de missions et compte-rendu de visite.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MISSION_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MISSION_STATUS_CHANGED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'VISIT_REPORT_SUBMITTED';

CREATE TYPE "MissionStatus" AS ENUM (
    'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
);

CREATE TABLE "nurse_missions" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "status" "MissionStatus" NOT NULL DEFAULT 'ASSIGNED',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "nurse_missions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "nurse_missions_appointmentId_key" UNIQUE ("appointmentId"),
    CONSTRAINT "nurse_missions_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "nurse_missions_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "nurse_missions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "nurse_missions_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "visit_reports" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "observations" TEXT NOT NULL,
    "actionsTaken" TEXT,
    "recommendations" TEXT,
    "vitalSigns" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "visit_reports_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "visit_reports_missionId_key" UNIQUE ("missionId"),
    CONSTRAINT "visit_reports_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "nurse_missions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "visit_reports_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "nurse_missions_nurseId_status_assignedAt_idx" ON "nurse_missions"("nurseId", "status", "assignedAt");
CREATE INDEX "nurse_missions_patientId_assignedAt_idx" ON "nurse_missions"("patientId", "assignedAt");
CREATE INDEX "visit_reports_nurseId_createdAt_idx" ON "visit_reports"("nurseId", "createdAt");
