# ADR-010 — Alertes critiques « app fermée » sans Firebase : Background Runner + clés d'appareil + notifications locales enrichies

> Architecture Decision Record. Un ADR = **une** décision structurante, immuable une fois acceptée (si elle change, un nouvel ADR la déprécie).
> **Périmètre** : FEATURE-PUSH / FEATURE-LOCALES — diffusion des notifications quand l'application Android est fermée, et enrichissement des notifications locales.
> **Amende** : ADR-009 (la conséquence négative « aucune notification quand l'app est fermée, hors rappels pré-planifiés » est levée SANS rouvrir le canal FCM).

## Statut
`Accepté` — demande PO explicite du 2026-10-05 : « je veux être notifié app fermée, pour les alertes critiques, ou de notifications locales enrichies et autres ».

## Date
2026-10-05

## Contexte
ADR-009 a figé la stratégie de notifications sans projet Firebase : canal InApp (panneau + badge) + rappels RDV planifiés localement, plugin `@capacitor/push-notifications` conservé mais **dormant** (garde anti-crash `isPushCapable()`). Une conséquence négative était assumée : **aucune notification quand l'app est fermée**, hors rappels pré-planifiés — impossible de réveiller un APK fermé sans FCM ou un transport tiers lourd.

Le PO demande maintenant de lever cette limitation : être notifié **app fermée**, en particulier pour les **alertes critiques**, avec au minimum des **notifications locales enrichies**. Contraintes inchangées : aucun projet Firebase, aucune dépendance Google côté serveur, APK distribué en direct (pas de Play Store).

La voie officielle Capacitor pour exécuter du code « app fermée » est le plugin **`@capacitor/background-runner`** : une tâche **WorkManager** Android (périodicité plancher ~15 min) exécute un fichier JS dédié dans un moteur headless hors WebView, avec un jeu restreint d'API (`fetch`, JSON, un KV persistant `CapacitorKV` adossé à SharedPreferences, et `CapacitorNotifications.schedule` pour les notifications locales). Ce runner est précisément conçu pour le motif « sonder une API puis notifier localement ».

Il manque deux pièces pour l'utiliser : (1) le runner n'a **ni cookie ni WebView** — il faut donc un credential d'appareil pour lire les notifications d'un utilisateur précis ; (2) la criticité et la destination des alertes doivent être décidées **côté serveur** pour que le bundle runner reste un afficheur muet.

## Décision
1. **Clés d'appareil dans la table `device_tokens` (réemploi, ADR-009 §6 anticipait ce service).** `POST /api/native/device-key` (auth **session**) émet une clé de 32 octets CSPRNG, **retournée une seule fois** et stockée **hashée (SHA-256)** — la table passe ainsi au stockage hashé pour TOUTES ses populations (les jetons FCM dormants inclus), même posture que `Session.tokenHash`. Colonne `expiresAt` ajoutée (TTL **180 jours**, écrémage opportuniste à chaque émission). La clé est réutilisée entre deux logouts (persistée dans Preferences côté app) : une émission par appareil et par session de connexion.
2. **Sondage serveur par le runner.** `GET /api/notifications/poll` authentifié par `Authorization: Bearer <clé>` : curseur `?since=` (le runner renvoie `serverTime` comme curseur suivant — horloge de comparaison = horloge serveur, zéro skew), max 20 items, exclusions `APPOINTMENT_REMINDER` (rappels déjà planifiés localement à la réservation — le poll les livrerait en doublon), rattrapage borné à 3 jours (l'historique complet reste dans le panneau InApp). Le curseur n'avance qu'après un tick **réussi** — une panne réseau ne perd aucune alerte.
3. **Classification serveur.** `CRITICAL_NOTIFICATION_TYPES` (lib/notifications.ts) : dispatch à affecter, annulation, mission attribuée, cycle financier des recharges → `critical: true` ; le reste → `updates`. `notificationUrlFor()` est le **miroir serveur** de `notificationDestination()` du dashboard — le tap sur la notification locale ouvre la vue qui permet d'agir. Le bundle runner reçoit ces champs tout calculés : aucune logique métier dupliquée dans l'APK.
4. **Notifications locales enrichies (canaux Android).** Trois canaux créés de façon idempotente dès le boot du shell (lib/native.ts) : `critical` (IMPORTANCE **4** : son, vibration, LED, head-up), `reminders` (importance 4), `updates` (importance 3). Les rappels RDV passent sur `reminders` avec style **big-text** (`largeBody` + `summaryText`). Une notification postée sur un canal inexistant ne s'affiche pas : la création systématique garantit que le runner peut poster dès son premier tick. Permission `SCHEDULE_EXACT_ALARM` ajoutée (Android 12+ : rappels à l'heure exacte, passage du Doze).
5. **Cycle de vie du credential aligné sur la session web.** Provisioning au boot ET à la connexion (event `mondocpro:session-open`, le login étant une navigation SPA) ; au **logout**, `unregisterPush()` révoque la clé (`POST /api/push/unregister { token }`) ET purge le KV natif du runner (dispatchEvent `wipe`) ; un **reset de mot de passe** purge toutes les clés (`invalidateUserSessions`) — l'appareil se reprovisionne à la prochaine connexion. Le runner purge lui-même son KV sur un 401/403.
6. **Fichier runner compilé dans l'APK.** `src/background/custom-background.ts` (TS type-safe, résolveurs obligatoires dans tous les chemins — sinon l'OS tue la tâche) → esbuild IIFE minifié (`bun run build:runner`) → `capacitor-shell/custom-background.js` → `assets/public/`. Config `plugins.BackgroundRunner` : label `ci.mondopro.app.runner`, event `onAppTick`, `repeat: true`, `interval: 15`, `autoStart: true`.

## Conséquences
**Positives :**
- **Alertes critiques livrées app fermée** (~15 min de latence maximale, WorkManager), sans Firebase, sans compte tiers, sans secret supplémentaire : la sonde parle à notre propre API avec un credential révocable.
- Notifications **enrichies** partout : canaux de criticité (son/vibration/LED différenciés), big-text déplié, deep-link vers l'outil d'action, alarmes exactes.
- Clés hashées + TTL + purge logout/reset : la fuite de la base ne compromet aucun accès, un appareil perdu s'éteint au plus tard à 180 jours (ou immédiatement au reset du mot de passe).
- Anti-doublons structurels : id de notification locale = hash stable de l'id serveur ; curseur strictement croissant ; exclusions de types.

**Négatives / risques assumés :**
- **Latence** : ce n'est pas du push temps réel — jusqu'à ~15 min (plancher WorkManager) et soumis aux optimisations batterie des constructeurs (cf. dontkillmyapp.com ; les vieilles versions APK sans runner ne gagnent rien, de façon sûre).
- **Android uniquement** (iOS exige BGTaskScheduler + modes background dédiés — hors périmètre de l'APK actuel, à traiter dans un futur ADR si une app iOS voit le jour).
- La clé vit dans SharedPreferences natives du runner et dans Preferences du WebView : théoriquement extractible d'un appareil rooté — posture identique à tout credential applicatif mobile.
- Une tâche périodique consomme un peu de batterie/data (sonde HTTP minuscule, 1 requête/15 min au plus).

## Alternatives écartées
- **Réactiver FCM** (temps réel garanti) : rejeté — le PO refuse le projet Firebase (ADR-009) ; ADR-010 doit vivre sous cette contrainte.
- **WebSocket / foreground service persistant** : rejeté — service permanent (batterie, notification persistante, politique Play) disproportionné, et mort de toute façon quand l'OS tue le process.
- **UnifiedPush/ntfy (distributeur tiers)** : rejeté — exige l'installation d'un app distributeur supplémentaire sur le téléphone du patient : inacceptable en santé.
- **Réutiliser `/api/push/register` pour porter la clé** : rejeté pour l'émission (le client générerait un secret côté JS) — l'émission CSPRNG reste serveur ; en revanche la **révocation** réemploie `/api/push/unregister` (même table, même hash lookup, zéro route de plus).
- **Auth par token de session dupliqué dans le KV** : rejeté — les sessions web sont 30 jours max et liées au cookie ; la clé d'appareil a son propre TTL et son propre cycle de vie.

## Références
- `src/background/custom-background.ts` — le runner (provision / onAppTick / wipe).
- `src/lib/push.ts` — émission/vérification/révocation hashées (`issueDeviceKey`, `findUserByDeviceKey`, TTL 180 j).
- `src/app/api/native/device-key/route.ts`, `src/app/api/notifications/poll/route.ts` — les deux contrats.
- `src/lib/notifications.ts` — `CRITICAL_NOTIFICATION_TYPES`, `notificationUrlFor()`.
- `src/lib/native.ts` — canaux, `provisionNotificationSync()`, `unregisterPush()`, rappels big-text.
- `supabase/migrations/20261005220000_add_device_tokens_expires_at.sql` — colonne `expiresAt`.
- ADR-007 (WebView distante — le runner sonde le même serveur que l'app), ADR-008 (architecture APK/push), ADR-009 (sans Firebase — garde anti-crash inchangée).
- `.ai/API_CONTRACTS.md` — les deux nouveaux contrats ; `.ai/APK_BUILD.md` §4 — build v1.0.2.
