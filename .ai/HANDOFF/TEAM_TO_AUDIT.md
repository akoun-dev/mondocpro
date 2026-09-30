# 🤝 HANDOFF — Équipe → Audit

> **Template** : rempli par l'orchestrateur/l'équipe pour commander un audit global ou ciblé (fin de cycle, signal faible atteint, demande explicite).

---

## État

**Aucun.**

---

## Template (à dupliquer)

```markdown
# HANDOFF TEAM→AUDIT — AUDIT-XXX : [Titre] — [Date]

## 1. Contexte de la demande
- Déclencheur : fin de feature / incident / signal faible (préciser lequel, cf. .ai/AUDIT_REPORT.md) / demande orchestrateur
- Cycle concerné : features livrées depuis le dernier audit

## 2. Périmètre d'audit
- Code : fichiers/dossiers/endpoints
- Registres à vérifier : BUGS, SEC_BUGS, A11Y_BUGS, PERF_ISSUES, REVIEW_LOG, COMMIT_LOG…
- Conformité : 15 règles de .ai/SYSTEM_COMPLIANCE.md

## 3. Focus d'audit demandé (priorités)
- Ex. : sécurité des nouvelles routes API, qualité des migrations Prisma, conformité a11y des nouveaux écrans, dette DET-XXX ancienne

## 4. Attendus du rapport
- Score global /100 (seuil PROD ≥ 60), verdicts par catégorie
- Rapport détaillé : .ai/AUDITS/AUDIT-XXX-YYYY-MM-DD.md + index mis à jour dans .ai/AUDIT_REPORT.md
- Constats routés : vulnérabilités → SEC_BUGS.md, non-conformités → A11Y_BUGS.md, lenteurs → PERF_ISSUES.md, bugs → BUGS.md, dette → DEBT_REPORT.md

## 5. Contraintes
- Aucune modification de code par l'auditeur (constat only — les corrections passent par l'équipe)
```
