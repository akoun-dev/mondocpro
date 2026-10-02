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

---

## ⚠️ Recommandations actives (suivi obligatoire)

| ID | Date | Recommandation | Criticité | Statut |
|---|---|---|---|---|
| SEC-ADV-002 | 2026-09-30 | **Rotation des secrets Supabase fortement recommandée** : le PO a transmis en clair dans le chat le **mot de passe PostgreSQL** et la clé **service_role** (JWT — contourne le RLS !). Usage appliqué : écrits uniquement dans `.env` (non versionné, vérifié `.gitignore` + `git ls-files`), jamais dans le code ni l'historique. Actions PO : (1) changer le mot de passe DB (Dashboard → Settings → Database), (2) régénérer la clé service_role (Settings → API), (3) révoquer le token GitHub (SEC-ADV-001). Après rotation : mettre à jour `.env` et redémarrer le serveur dev. | Haute (secrets exposés dans un canal de chat) | ⏳ Action PO |
| SEC-ADV-001 | 2026-09-30 | **Rotation du token GitHub conseillée** : le PO a transmis un token d'accès personnel (PAT) en clair dans la conversation. Usage vérifié : one-shot (2 pushes), jamais écrit dans un fichier, ni `.git/config`, ni `.env`, ni le dépôt (audit `git config` + grep `.git/config` : absence confirmée). Le push étant effectué, le token peut être révoqué immédiatement → **révoquer/regénérer sur GitHub (Settings → Developer settings → Tokens)**. Note : le dépôt distant a aussi reçu l'historique antérieur contenant `.env` (chemin SQLite local, sans secret) et `db/custom.db` (0 ligne) via l'auto-commit plateforme b3c635e — contenu bénin, retrait du suivi effectué en 90786c8. | Moyenne (hygiène) | ⏳ Révocation = action PO |

**Politique secrets appliquée (DEV SÉCURITÉ) :** aucun token/secret ne doit figurer dans le code, la config, les registres `.ai/` ou l'historique Git. Usage one-shot en variable de commande uniquement.
