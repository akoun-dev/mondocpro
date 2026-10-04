-- Task 35 — Notifications InApp « complètes » : nouveaux types couvrant le
-- cycle financier (recharges) et le cycle RDV côté Médecin Chef / patient.
-- L'enum est l'autorité (mirror supabase/schema.prisma) ; les valeurs sont
-- ajoutées de manière idempotente (IF NOT EXISTS) — un re-push est sans effet.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RECHARGE_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RECHARGE_CONFIRMED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RECHARGE_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'APPOINTMENT_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'APPOINTMENT_CANCELLED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'APPOINTMENT_COMPLETED';
