# Build APK Android — Mon doc Pro (Capacitor)

> Task 36 — procédure complète pour produire l'APK depuis ce dépôt.
> Architecture : voir **ADR-008** (WebView distante + push FCM + rappels locaux),
> **ADR-009** (notifications sans Firebase), **ADR-010** (alertes « app fermée »
> via Background Runner + clés d'appareil).
> Historique des versions : **v1.0.0** (Task 36) → **v1.0.1** (versionCode 2,
> garde Diagnostics Task 38) → **v1.0.2** (versionCode 3, Task 40 : Background
> Runner + canaux enrichis + SCHEDULE_EXACT_ALARM) → **v1.0.3** (versionCode 4,
> Task 41 : garde réseau du runner via `CapacitorDevice.getNetworkStatus` —
> docs /apis/network — + état réseau initial du bandeau hors-ligne via
> `Network.getStatus()`). Keystore debug **versionné**
> `android/keys/debug.keystore` (SHA-256 `050993fe…`) → installation par-dessus
> les versions antérieures SANS désinstallation.

## 1. Prérequis (une seule fois)

| Outil | Version | Rôle |
|---|---|---|
| Node.js ou Bun | ≥ 20 / ≥ 1.2 | dépendances web |
| **JDK 21** | Temurin/Adoptium | compilation Gradle |
| **Android Studio** | Ladybug+ | SDK Android 36, émulateur, signature |
| Compte **Firebase** | gratuit | projet + `google-services.json` (push uniquement) |

Variables d'environnement (Android Studio les propose automatiquement) :
`ANDROID_HOME=~/Android/Sdk`, `JAVA_HOME=<jdk-21>`.

## 2. Build debug (test sur appareil)

```bash
bun install                      # postinstall = prisma generate
bun run build:runner             # compile src/background/custom-background.ts
                                 # → capacitor-shell/custom-background.js (APK ≥ v1.0.2,
                                 #    OBLIGATOIRE avant cap sync — ADR-010)
npx cap sync android             # copie capacitor-shell/ + met à jour les deps natives
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

L'APK charge **https://mondocpro.vercel.app** (server.url de `capacitor.config.ts`).
Les identifiants de connexion sont ceux de l'app web — aucune donnée locale.

### Tester contre un serveur local (émulateur/LAN)

```bash
CAPACITOR_SERVER_URL=http://10.0.2.2:3000 npx cap sync android   # émulateur
CAPACITOR_SERVER_URL=http://192.168.x.x:3000 npx cap sync android # appareil (même Wi-Fi)
# cleartext HTTP n'est autorisé QUE pour ces builds (config refusée en prod)
```

⚠️ Les cookies de session en dev non-HTTPS peuvent être refusés par le WebView :
privilégier la prod (HTTPS) pour tester les flux authentifiés, ou `adb reverse tcp:3000 tcp:3000`.

## 3. Identifiants de l'app (à VALIDER avant publication)

| Champ | Valeur actuelle | Note |
|---|---|---|
| `appId` (package) | `ci.mondopro.app` | **immuable** après publication Play Store |
| `appName` | `Mon doc Pro` | affiché sous l'icône |
| `versionCode` / `versionName` | `4` / `"1.0.3"` | `android/app/build.gradle` — incrémenter à chaque release |

Icônes et splash : sources dans `assets/` (générées par `scripts/gen-cap-assets.py`
depuis `public/img/logo.png`), régénérer via :

```bash
python3 scripts/gen-cap-assets.py
npx capacitor-assets generate --android --assetPath assets
```

## 4. Notifications — canaux actifs (ADR-009 + ADR-010 : AUCUN projet Firebase)

**Décision PO (2026-10-05) : pas de Firebase.** Les canaux de notification
actifs sont :

- **InApp** — panneau notifications + badge, créés DANS les transactions
  métier (Task 35) : recharges, RDV domicile, missions, rappel 24 h.
- **Notifications locales** (`@capacitor/local-notifications`) — rappels RDV
  H-24/H-1 planifiés sur l'appareil à la réservation (canal `reminders`,
  importance HIGH, style big-text) ; le tap navigue vers la vue Rendez-vous
  (`initLocalNotificationTap`, enregistré au boot du shell).
- **Alertes « app fermée » (ADR-010, APK ≥ v1.0.2)** — le **Background
  Runner** (`@capacitor/background-runner`, tâche WorkManager ~15 min) sonde
  `GET /api/notifications/poll` avec la **clé d'appareil** émise par
  `POST /api/native/device-key` (provisionnée à la connexion) et déclenche
  des notifications locales sur les canaux `critical` (importance 4 : son,
  vibration, LED) ou `updates` (importance 3). Latence ≤ ~15 min, Android
  uniquement, soumise aux optimisations batterie des constructeurs.
  Clé **hashée** en base (TTL 180 j), révoquée au logout et au reset de mot
  de passe, purge du KV natif du runner (event `wipe`).

Le plugin **`@capacitor/push-notifications` reste embarqué** dans l'APK (il
porte ses bibliothèques Firebase — aucun projet, compte ou
`google-services.json` requis) mais le **canal push distant est DORMANT** :

> **Garde anti-crash (Task 38 / ADR-009)** — `src/lib/native.ts` interroge le
> plugin natif local **Diagnostics** (`DiagnosticsPlugin.java`) avant toute
> activation du canal : sans Firebase initialisé, `register()` n'est jamais
> appelé — aucun dialogue push, aucun crash. La **permission notifications**
> (Android 13+) est demandée via `LocalNotifications` (même permission OS) au
> démarrage de session — utile sans Firebase (rappels + InApp).
> **Un APK sans `google-services.json` n'affiche jamais le dialogue push** ;
> `Diagnostics.lastCrash()` renvoie le stack trace du dernier plantage
> (`files/last_crash.txt`, écrit par `MainActivity`) — utile sans adb.

Le serveur ne contient plus `firebase-admin` ni aucun code d'envoi FCM
(`src/lib/push.ts` = registre de jetons seulement). Les routes
`/api/push/register` et `/api/push/unregister` restent saines (401/400/200)
mais ne sont plus appelées en pratique (client dormant).

**Ré-activation éventuelle du push distant** (si la décision change un jour) :
1. Projet Firebase + `google-services.json` dans `android/app/` (gitigné).
2. `FIREBASE_SERVICE_ACCOUNT_JSON` sur Vercel (Production + Preview).
3. `git revert` du commit « ADR-009 » (rétablit l'envoi `src/lib/push.ts` +
   les jumeaux push dans les services métier), puis rebuild APK + cap sync.

## 5. Build release (signé)

```bash
# Keystore de signature (à créer UNE fois, à conserver précieusement)
keytool -genkey -v -keystore mondocpro-release.keystore -alias mondocpro \
  -keyalg RSA -keysize 2048 -validity 10000

# android/keystore.properties (gitigné)
#   storeFile=../mondocpro-release.keystore
#   storePassword=***
#   keyAlias=mondocpro
#   keyPassword=***

cd android && ./gradlew assembleRelease   # APK signé
# ou : ./gradlew bundleRelease            # .aab pour le Play Store
# → android/app/build/outputs/apk/release/
```

## 6. Dépannage

| Symptôme | Cause probable | Correctif |
|---|---|---|
| Splash figé sur « Chargement » | serveur injoignable (avion, DNS) | le shell bascule sur le message hors-ligne ; vérifier https://mondocpro.vercel.app/api/health |
| Aucune push reçue | **Comportement attendu** : canal push distant DORMANT sans projet Firebase (ADR-009) — notifications InApp + rappels locaux + sondage app fermée (ADR-010) actifs | §4 (ré-activation : projet Firebase + revert ADR-009) |
| Pas d'alerte « app fermée » | APK < v1.0.2 (pas de runner), ou optimisations batterie constructeur, ou clé jamais provisionnée (se connecter une fois) | installer v1.0.2+ ; exclure l'app de l'optimisation batterie (dontkillmyapp.com) ; vérifier `adb logcat | grep BackgroundRunner` |
| Notification locale qui ne s'affiche pas | canal Android inexistant au moment du post (les canaux sont créés au boot du shell — APK ≥ v1.0.2 uniquement) | ouvrir l'app une fois (création des canaux), puis re-provisionner |
| L'app se ferme à l'acceptation des notifications | APK v1 sans `google-services.json` : crash `IllegalStateException: Default FirebaseApp is not initialized` via le bridge | Installer un APK ≥ v2 (garde `Diagnostics.firebaseAvailable()`) ; depuis le correctif web ADR-009, le canal push distant n'est plus jamais activé sans Firebase |
| Permission notifications jamais demandée | Android 13+ : demandée à la 1re ouverture après connexion **via LocalNotifications** (rappels RDV) — indépendante de Firebase depuis ADR-009 | se déconnecter/reconnecter, ou réinstaller ; vérifier les permissions système de l'app |
| Rappels RDV avec quelques minutes de retard | alarmes inexactes | **corrigé v1.0.2** : `SCHEDULE_EXACT_ALARM` ajouté (Android 12+) — sur Android ≤ 11 le comportement reste à ±quelques minutes |
| `cap sync` échoue | dépendances natives désynchronisées | `bun install` puis `npx cap sync android` |
