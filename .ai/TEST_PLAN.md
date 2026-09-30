# 🧪 TEST_PLAN — Stratégie et journal de tests

## Stratégie de test

1. **E2E manuel systématique via agent-browser** : chaque feature est validée par un parcours réel dans le navigateur (headless) — le **chemin doré** (parcours nominal complet) de la feature, du point d'entrée jusqu'au résultat attendu.
2. **Vérification `dev.log`** : le serveur de développement doit démarrer sans erreur ; les requêtes exercées par le scénario ne doivent produire ni stack trace ni warning nouveau.
3. **Lint** : `bun run lint` à 0 erreur / 0 warning (pré-requis, cf. `COMMIT_LOG.md`).
4. **Revue QA** : l'agent QA (Agent 2) re-teste indépendamment le scénario, compare l'attendu au résultat constaté, et consigne tout écart dans `.ai/BUGS.md` (routage selon `WORKFLOWS.md`).
5. **Anti-régression** : à chaque évolution touchant une feature existante, son chemin doré est rejoué (cf. `REGRESSIONS.md`).

> Règle d'or : **aucune feature n'est validée sans résultat E2E consigné ci-dessous** (Résultat = PASS/FAIL + précision en cas de FAIL).

## Journal des tests

| FEATURE-XXX | Scénario | Étapes | Attendu | Résultat | Date | Testeur |
|---|---|---|---|---|---|---|
| _—_ | _Aucun test enregistré (aucune feature implémentée)_ | _—_ | _—_ | _—_ | _—_ | _—_ |

### Modèle de ligne
- **Scénario** : « Chemin doré FEATURE-001 — [nom] »
- **Étapes** : 1) ouvrir `/route` → 2) action utilisateur → 3) vérifier affichage/état/endpoint
- **Attendu** : comportement observable précis (contenu, statut HTTP, état UI)
- **Résultat** : PASS ✅ / FAIL ❌ (+ lien BUG-XXX ou REG-XXX)
