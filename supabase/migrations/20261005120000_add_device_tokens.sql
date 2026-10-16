-- Task 36 — FEATURE-PUSH : jetons FCM des appareils natifs (Capacitor Android).
-- Un appareil = une ligne, identifiée par son token FCM (unique). Le token est
-- réattribué si l'utilisateur se reconnecte avec un autre compte sur le même
-- appareil (upsert côté API). lastSeenAt trace l'activité de l'appareil.
CREATE TABLE "device_tokens" (
    "id"           TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "token"        VARCHAR(4096) NOT NULL,
    "platform"     VARCHAR(20) NOT NULL,
    "deviceName"   VARCHAR(120),
    "appVersion"   VARCHAR(40),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- Un même token ne peut être enregistré que pour un seul utilisateur à la
-- fois (upsert = réattribution) — évite les poussées à l'ancien compte.
CREATE UNIQUE INDEX "device_tokens_token_key" ON "device_tokens"("token");
CREATE INDEX "device_tokens_userId_idx" ON "device_tokens"("userId");

ALTER TABLE "device_tokens"
  ADD CONSTRAINT "device_tokens_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
