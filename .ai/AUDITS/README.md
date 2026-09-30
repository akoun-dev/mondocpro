# 📂 AUDITS/ — Rapports d'audit global détaillés

Ce dossier contient les **rapports détaillés des audits globaux** du système.

## Naming

```
AUDIT-XXX-YYYY-MM-DD.md
```

- **AUDIT-XXX** : numéro séquentiel de l'audit (`AUDIT-001`, `AUDIT-002`, … jamais réutilisé).
- **YYYY-MM-DD** : date de réalisation de l'audit (timezone Africa/Abidjan).

Chaque audit est **indexé dans `.ai/AUDIT_REPORT.md`** (ID, date, score /100, déclencheur, lien vers le rapport, statut) et suit le modèle de la section « Modèle d'audit » de `.ai/SECURITY_AUDIT.md`.

## Contenu type d'un rapport

- Périmètre et méthode (revue de code, tests, conformité aux 15 règles de `.ai/SYSTEM_COMPLIANCE.md`)
- Résultats : qualité, sécurité, a11y, perf, tests, dette
- Score global /100 (seuil de livraison PROD : ≥ 60)
- Signaux faibles mis à jour (`.ai/AUDIT_REPORT.md`)
- Plan d'actions correctives

## État actuel

📁 Dossier vide. **Un premier audit (AUDIT-001) sera généré après la première feature terminée** (ou plus tôt sur demande de l'orchestrateur ou déclenchement d'un signal faible).
