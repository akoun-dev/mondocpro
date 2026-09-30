# 🛡️ SECURITY_AUDIT — Rapport d'audit sécurité

> **Document vivant.** Chaque audit (initial, post-feature, périodique) est ajouté en tête de ce fichier ou référencé depuis `.ai/AUDIT_REPORT.md` vers `.ai/AUDITS/AUDIT-XXX-YYYY-MM-DD.md`.
> **Lien utile :** registre des vulnérabilités détaillées → `.ai/SEC_BUGS.md`.

---

## 🔎 Modèle d'audit (à dupliquer pour chaque nouvel audit)

```markdown
## AUDIT-XXX — [Titre] — [Date]

### 1. Périmètre
- Fichiers/routes/modèles concernés
- Features couvertes (FEATURE-XXX)

### 2. Méthode
- Revue de code manuelle (agents Security + Audit)
- Analyse des dépendances (bun audit / npm audit)
- Tests de pénétration ciblés si endpoints exposés
- Vérification conformité RGPD si données personnelles

### 3. Résultats par catégorie
| Catégorie | Verdict | Constats | Criticité |
|---|---|---|---|
| Authentification / Autorisation | — | — | — |
| Validation des entrées (Zod) | — | — | — |
| Injection (SQL/NoSQL/commande) | — | — | — |
| XSS | — | — | — |
| CSRF | — | — | — |
| Secrets & configuration | — | — | — |
| Dépendances | — | — | — |
| RGPD (données personnelles) | — | — | — |

### 4. Vulnérabilités relevées
→ Consignées dans `.ai/SEC_BUGS.md` (SEC-XXX) + handoff `.ai/HANDOFF/SECURITY_TO_TEAM.md`.

### 5. Conclusion & recommandations
- Score /100 : …
- Actions correctives et échéances.
```

---

## ÉTAT ACTUEL

**Audit initial scaffold (2026-09-30) :** aucune surface d'attaque métier. Dépendances standard. Aucune vulnérabilité CRITIQUE/HAUTE identifiée à ce stade. Prochain audit : après la première feature.

**Détails :**
- Périmètre : scaffold vierge — `src/app/page.tsx` (page statique), `src/app/api/route.ts` (GET "Hello world", sans entrée utilisateur), modèles Prisma scaffold `User`/`Post` non exposés.
- Surface d'attaque : 1 endpoint GET sans paramètre, aucune authentification requise, aucune donnée personnelle traitée.
- Secrets : `.env` local avec `DATABASE_URL` SQLite (aucun secret réseau).
- Prochain audit planifié : dès la première feature livrée (audit AUDIT-001), puis à chaque feature touchant API/auth/données.
