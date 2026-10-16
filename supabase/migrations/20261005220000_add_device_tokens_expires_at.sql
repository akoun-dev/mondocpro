-- Task 40 / ADR-010 — Clés de sondage du Background Runner.
-- La table device_tokens (créée en Task 36 pour les jetons FCM) porte
-- désormais des CLÉS D'AUTHENTIFICATION d'appareil : le Background Runner
-- les présente en Bearer pour lire /api/notifications/poll. Ajout d'une
-- expiration (null = jeton FCM historique sans TTL) — une clé perdue
-- cesse d'être valide au bout de 180 jours même sans déconnexion.
ALTER TABLE "device_tokens" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
