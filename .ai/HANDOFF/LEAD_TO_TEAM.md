# 🤝 HANDOFF — Tech Lead → Équipe

> **Template de délégation** : rempli par le Tech Lead (ou l'orchestrateur) au lancement de chaque feature (phase 3 du Feature Lifecycle). Chaque agent concerné accuse réception en démarrant sa tâche (`.ai/TEAM_STATUS.md`).

---

## État

**Aucun handoff en cours.**

---

## Template (à dupliquer)

```markdown
# HANDOFF LEAD→TEAM — FEATURE-XXX : [Titre] — [Date]

## 1. Objectif
But de la feature en 2-3 phrases, et critère de succès observable (lien vers .ai/SPECS/FEATURE-XXX.md).

## 2. Contrat API
| Endpoint | Méthode | Entrée (Zod) | Sortie (Zod) | Codes erreur |
|---|---|---|---|---|
| /api/… | GET | … | … | 400/404/500 |

Règles : validation Zod systématique côté serveur ; z-ai-web-dev-sdk jamais appelé depuis le frontend.

## 3. Découpage et assignations
| Agent | Tâche | Fichiers attendus | Statut |
|---|---|---|---|
| 🟢 Back | … | src/app/api/…, prisma/… | ⏳ |
| 🔵 Front | … | src/app/(pages|components)/… | ⏳ |
| 🟣 DevOps/Data | … | prisma/schema.prisma, migrations | ⏳ |

## 4. Dépendances entre tâches
- Front dépend de : contrat API figé (payloads ci-dessus) — mock possible avant livraison Back.
- Data dépend de : validation du schéma par le Tech Lead avant migration.

## 5. Points de vigilance
- Séparation des couches, non-duplication (checklist REVIEWER).
- a11y WCAG 2.1 AA dès la conception UX ; budgets perf de .ai/PERFORMANCE_BUDGET.md.
- Écriture simultanée des tests dans .ai/TEST_PLAN.md (chemin doré).
```
