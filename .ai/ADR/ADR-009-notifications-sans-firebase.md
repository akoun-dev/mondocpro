# ADR-009 — Notifications sans projet Firebase : canaux primaires InApp + locaux, canal push distant dormant

> Architecture Decision Record. Un ADR = **une** décision structurante, immuable une fois acceptée (si elle change, un nouvel ADR la déprécie).
> **Périmètre** : FEATURE-PUSH / FEATURE-LOCALES — stratégie de notifications du produit (web, APK Capacitor).
> **Déprécie partiellement** : ADR-008 (le canal push FCM y était décrit comme activable — il devient dormant par décision produit).

## Statut
`Accepté` — décision PO explicite du 2026-10-05 : « je ne veux pas de firebase », précisée par « Je veux @capacitor/push-notifications, @capacitor/local-notifications mais sans firebase ».

## Date
2026-10-05

## Contexte
Depuis la Task 36, le produit comporte un double canal de notification : InApp (table `notifications`, panneau + badge, cf. Task 35) et push FCM (firebase-admin côté serveur, `@capacitor/push-notifications` côté APK). Le canal push exigeait du PO la création d'un **projet Firebase** (console Google, `google-services.json` côté build, `FIREBASE_SERVICE_ACCOUNT_JSON` côté Vercel) — jamais réalisée. Sans elle, l'APK v2 fonctionne (garde anti-crash Task 38) mais le canal push reste mort tout en suggérant, dans les docs et les logs, une « action PO en attente ».

Le PO a tranché : **pas de Firebase**. Contrainte technique à intégrer telle quelle : sur Android, le plugin officiel `@capacitor/push-notifications` transporte les push **uniquement via Firebase Cloud Messaging** — ses bibliothèques Firebase sont embarquées par le plugin lui-même et il n'existe pas de variante « sans FCM ». En revanche :

- **Bibliothèques Firebase ≠ projet Firebase** : le plugin embarque les SDK sans exiger compte, console, `google-services.json` ni variable d'environnement — tant qu'on n'appelle pas `register()`.
- La **permission Android `POST_NOTIFICATIONS`** (13+) est une permission OS unique, partagée par `@capacitor/local-notifications` et `@capacitor/push-notifications` : la demander via le plugin **local** suffit aux rappels de RDV et reste utile sans aucune config.
- Les notifications **InApp** (panneau, badge, routage de clic Task 35) vivent entièrement côté serveur/web : elles n'ont jamais dépendu de Firebase.

## Décision
1. **Canaux primaires = InApp + notifications locales.** Chaque mutation métier notifie dans la transaction (invariant existant Task 35) ; les rappels RDV H-24/H-1 sont planifiés localement sur l'appareil (`@capacitor/local-notifications`) ; le tap sur une notification locale navigue vers la bonne vue (listener enregistré au boot du shell — corrige un bug latent : il n'était auparavant enregistré que si Firebase était configuré).
2. **Le plugin `@capacitor/push-notifications` reste dans le projet** (souhait PO) : il est conservé dans `package.json` et l'APK, avec ses bibliothèques Firebase embarquées — sans projet Firebase, sans compte Google, sans `google-services.json`.
3. **Le canal push distant est DORMANT.** La garde `isPushCapable()` (Task 38, réflexion `Diagnostics.firebaseAvailable()`) ne l'active que si Firebase est réellement initialisé dans le process — jamais le cas aujourd'hui. Conséquences : pas de `register()`, pas de jeton envoyé au serveur, pas d'appel réseau inutile, **aucun crash possible** (le bug Task 38 reste structurellement écarté).
4. **La permission notifications est demandée via `LocalNotifications`** (même permission OS) au démarrage de session — la demande reste utile sans Firebase (rappels + mise en avant InApp) et ne dépend plus du canal distant.
5. **firebase-admin est supprimé du serveur**, ainsi que tout le code d'envoi (`sendPushToUsers`, `sendPushToAdmins`, `pushUrlFor`, chargement `FIREBASE_*`). Aucune dépendance Google côté serveur, aucune clé de service à protéger, aucun secret de plus sur Vercel.
6. **Les routes `/api/push/register` et `/api/push/unregister` et la table `device_tokens` sont conservées** : carnet d'adresses sain (upsert/révocation/idempotence testés 9/9 en Task 36), prêt à servir tout futur transport, sans coût (le client dormant n'y écrit plus).

## Conséquences
**Positives :**
- **Zéro configuration PO** : plus aucune « action en attente » liée à Firebase — le produit est complet en notifications (InApp + rappels) dès le déploiement.
- Surface d'attaque et secrets réduits : plus de SDK Google serveur, plus de clé de compte de service à protéger sur Vercel.
- APK inchangé (v1.0.1 / versionCode 2 toujours d'actualité) : tout le correctif vit dans le bundle web servi par Vercel — les APK v1 **et** v2 en bénéficient sans réinstallation.
- `bun install` plus léger (firebase-admin + transitive @firebase/* retirés).

**Négatives / risques assumés :**
- **Aucune notification quand l'app est fermée**, hors rappels pré-planifiés : impossible de réveiller un APK fermé sans FCM (ou un transport tiers lourd). Accepté : l'utilisateur ouvre l'app → badge + panneau à jour ; les rappels RDV planifiés à la réservation passent quand même.
- Si un jour le push distant devient nécessaire : configurer le projet Firebase (APK_BUILD.md §4 historique), puis rétablir l'envoi serveur (git revert du commit ADR-009 + `FIREBASE_SERVICE_ACCOUNT_JSON`) — aucun changement à prévoir côté client.

## Alternatives écartées
- **Supprimer aussi le plugin push** (purge totale) : rejeté — le PO veut les plugins officiels documentés (`capacitorjs.com/docs/apis/push-notifications`) ; leur coût est nul tant que le canal est gardé.
- **Push sans FCM** (WebSocket foreground service, UnifiedPush/ntfy…) : chaque option exige un service persistant (batterie, politique Play) ou l'installation d'un distributeur tiers — disproportionné pour l'APK actuel.
- **Garder firebase-admin env-gated** (statu quo Task 38) : rejeté — dépendance + secret dormants sans valeur tant que le PO refuse le projet Firebase.

## Références
- `src/lib/native.ts` — garde `isPushCapable()`, permission via `LocalNotifications`, `initLocalNotificationTap()`.
- `src/lib/push.ts` — registre de jetons (envoi supprimé) ; `src/app/api/push/*` — contrats conservés.
- ADR-008 (architecture Capacitor « WebView distante »), ADR-006 (passerelle SMS — toujours ouverte), Task 35 (notifications InApp), Task 38 (garde anti-crash).
- `.ai/APK_BUILD.md` §4 — état du canal distant et chemin de ré-activation éventuel.
