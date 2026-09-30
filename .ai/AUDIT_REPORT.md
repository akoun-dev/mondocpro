# 🕵️ AUDIT_REPORT — Index des audits globaux

> **Index central des audits globaux** (qualité + sécurité + conformité). Le détail de chaque audit est stocké dans `.ai/AUDITS/AUDIT-XXX-YYYY-MM-DD.md`.
> **Déclencheurs possibles :** fin de feature, incident majeur, cycle périodique, demande orchestrateur, détection de signaux faibles.

## Index des audits

| ID | Date | Score /100 | Déclencheur | Rapport | Statut |
|---|---|---|---|---|---|
| — | — | **Aucun audit global réalisé** (système initialisé aujourd'hui). Premier audit prévu : après la 1re feature terminée ou sur demande. | — | — | — |

**Seuil de conformité :** score global cible **≥ 60/100** pour toute livraison PROD (cf. `.ai/SYSTEM_COMPLIANCE.md`).

---

## 📡 Signaux faibles surveillés

Seuils d'alerte précoce : dès que l'un de ces signaux est détecté, un audit global est déclenché même sans autre motif.

| Signal | Seuil | Surveillance | Action si déclenché |
|---|---|---|---|
| Mensonges / écarts QA | 3 constatés | Comparaison systématique des résultats QA (`.ai/TEST_PLAN.md`) avec les re-tests du Reviewer | Audit global immédiat + revue du process QA (re-test croisé systématique) |
| PR / revues bloquées | 3 consécutives | Comptage des verdicts BLOCKED/CHANGES_REQUESTED répétés (`.ai/REVIEW_LOG.md`) | Audit global + rétrospective process (causes racines dans `.ai/LESSONS_LEARNED.md`) |
| Vulnérabilités critiques | 3 ouvertes | Comptage SEC-XXX CRITIQUE/HAUTE non corrigées (`.ai/SEC_BUGS.md`) | Audit sécurité d'urgence + gel des livraisons non critiques |
| Chute de vélocité | > 30 % | Comparaison des features livrées par période (`.ai/TEAM_STATUS.md`, standups) | Audit global + analyse de charge/blocages dans le standup et la rétrospective |
