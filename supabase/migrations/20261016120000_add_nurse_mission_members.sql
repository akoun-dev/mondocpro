-- FEATURE-NURSE: affectation d'un groupe d'infirmiers à une mission partagée.
-- La mission reste unique par RDV (nurse_missions.appointmentId UNIQUE) ; cette
-- table porte la liste des infirmiers affectés. Le statut et le compte-rendu
-- sont communs au groupe. Idempotent (IF NOT EXISTS + ON CONFLICT).

CREATE TABLE IF NOT EXISTS "nurse_mission_members" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "isLead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "nurse_mission_members_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "nurse_mission_members_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "nurse_missions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "nurse_mission_members_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "nurse_mission_members_missionId_nurseId_key" ON "nurse_mission_members"("missionId", "nurseId");
CREATE INDEX IF NOT EXISTS "nurse_mission_members_nurseId_idx" ON "nurse_mission_members"("nurseId");

-- Backfill : chaque mission existante devient membre référent d'elle-même.
INSERT INTO "nurse_mission_members" ("id", "missionId", "nurseId", "isLead")
SELECT 'nmm_' || md5(random()::text || clock_timestamp()::text), m."id", m."nurseId", true
FROM "nurse_missions" m
ON CONFLICT ("missionId", "nurseId") DO NOTHING;
