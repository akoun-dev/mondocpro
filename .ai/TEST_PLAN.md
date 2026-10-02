# 🧪 TEST_PLAN — Stratégie et journal de tests

## Stratégie de test

1. **E2E manuel systématique via agent-browser** : chaque feature est validée par un parcours réel dans le navigateur (headless) — le **chemin doré** (parcours nominal complet) de la feature, du point d'entrée jusqu'au résultat attendu.
2. **Vérification `dev.log`** : le serveur de développement doit démarrer sans erreur ; les requêtes exercées par le scénario ne doivent produire ni stack trace ni warning nouveau.
3. **Lint** : `bun run lint` à 0 erreur / 0 warning (pré-requis, cf. `COMMIT_LOG.md`).
4. **Revue QA** : l'agent QA (Agent 2) re-teste indépendamment le scénario, compare l'attendu au résultat constaté, et consigne tout écart dans `.ai/BUGS.md` (routage selon `WORKFLOWS.md`).
5. **Anti-régression** : à chaque évolution touchant une feature existante, son chemin doré est rejoué (cf. `REGRESSIONS.md`).

> Règle d'or : **aucune feature n'est validée sans résultat E2E consigné ci-dessous** (Résultat = PASS/FAIL + précision en cas de FAIL).

## Journal des tests

| FEATURE-XXX  | Scénario                          | Étapes                                                                                | Attendu                                                                         | Résultat | Date       | Testeur                         |
| ------------ | --------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------- | ---------- | ------------------------------- |
| FEATURE-AUTH | Contrats API (curl, 9 cas)        | register 201/409/400 · login 200/401 · me 200/401 · logout 200 · login admin seed 200 | Réponses conformes à API_CONTRACTS.md (enveloppe standard, pas de passwordHash) | PASS     | 2026-09-30 | QA (curl)                       |
| FEATURE-AUTH | Cookie de session                 | POST login → jar curl                                                                 | `Mon doc Pro_session` HttpOnly, SameSite=Lax                                    | PASS     | 2026-09-30 | QA (curl)                       |
| FEATURE-AUTH | Chemin doré — inscription patient | Formulaire (zone Songon, rôle Patient) → soumission                                   | 201 → session ouverte → dashboard avec badge « Patient »                        | PASS     | 2026-09-30 | agent-browser (frontend + QA)   |
| FEATURE-AUTH | Session persistante               | Reload après connexion                                                                | GET /api/auth/me 200 → dashboard conservé (pas de flash formulaire)             | PASS     | 2026-09-30 | agent-browser                   |
| FEATURE-AUTH | Déconnexion                       | Clic « Se déconnecter »                                                               | Session détruite en DB + cookie → retour écran auth, me → 401                   | PASS     | 2026-09-30 | agent-browser                   |
| FEATURE-AUTH | Erreurs UX                        | Mauvais mot de passe · numéro doublon · téléphone invalide                            | 401 Alert générique · 409 inline · 400 erreur inline par champ                  | PASS     | 2026-09-30 | agent-browser                   |
| FEATURE-AUTH | Responsive + a11y + perf          | Viewport 375px · footer · cibles tactiles · console                                   | Formulaire visible, footer visible, boutons ≥ 44px, 0 erreur console            | PASS     | 2026-09-30 | agent-browser (QA indépendante) |

### Modèle de ligne

- **Scénario** : « Chemin doré FEATURE-001 — [nom] »
- **Étapes** : 1) ouvrir `/route` → 2) action utilisateur → 3) vérifier affichage/état/endpoint
- **Attendu** : comportement observable précis (contenu, statut HTTP, état UI)
- **Résultat** : PASS ✅ / FAIL ❌ (+ lien BUG-XXX ou REG-XXX)
