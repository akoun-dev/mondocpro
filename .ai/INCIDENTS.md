# 🚨 INCIDENTS — Registre des incidents

> **Registre de tous les incidents** (panne, régression en prod, perte de données, faille exploitée, blocage prolongé de l'équipe).
> Un incident = événement non planifié ayant un impact réel ou potentiel sur le service, les données ou la capacité de livraison.

**Légende type :** PANNE · RÉGRESSION · DONNÉES · SÉCURITÉ · ORGANISATION
**Légende impact :** BLOQUANT (service indisponible/perte de données) · MAJEUR (dégradation sensible) · MINEUR (gêne sans coupure)

**Total incidents : 1**

| ID | Date | Type | Description | Impact | Résolution | Leçons apprises |
|---|---|---|---|---|---|---|
| INC-001 | 2026-10-03 | DONNÉES (schéma) | Les objets DDL de la migration `20261003000001_patient_business` (tables `appointments`/`sensibilisations` + enums) ont disparu de Supabase alors que le registre `_prisma_migrations` les déclarait appliquées (exécutées 2026-10-02 19:31 UTC) — survenue vraisemblablement lors de la migration de flotte du pooler aws-1 → aws-0 ; aucune donnée métier perdue (tables vides, comptes utilisateurs intacts) | MAJEUR (API RDV/SENSO inopérantes — détecté par P2021 à l'inspection Task 14) | Entrée de registre supprimée puis `prisma migrate deploy` réappliqué (2026-10-03) ; seed SENSO relancé (6 contenus) ; état vérifié par inspect-db | Toujours vérifier la présence **réelle** des objets après une opération infrastructure Supabase (flotte/restore) — `migrate deploy` « No pending » ne prouve pas que le DDL existe ; sonde DB `/api/health` v2 + `scripts/inspect-schema.ts` pour l'audit périodique |

### Rappel de procédure
1. Créer la ligne INC-XXX **dès la détection**, sans attendre la résolution.
2. Documenter l'impact mesurable (utilisateurs, données, durée).
3. À la clôture : formuler **au moins une leçon** et, si pertinent, une action systémique dans `.ai/LESSONS_LEARNED.md`.
4. Tout incident de type SÉCURITÉ est doublé dans `.ai/SEC_BUGS.md`.
