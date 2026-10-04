# Build APK Android — Mon doc Pro (Capacitor)

> Task 36 — procédure complète pour produire l'APK depuis ce dépôt.
> Architecture : voir **ADR-008** (WebView distante + push FCM + rappels locaux).

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
| `versionCode` / `versionName` | `1` / `"1.0"` | `android/app/build.gradle` — incrémenter à chaque release |

Icônes et splash : sources dans `assets/` (générées par `scripts/gen-cap-assets.py`
depuis `public/img/logo.png`), régénérer via :

```bash
python3 scripts/gen-cap-assets.py
npx capacitor-assets generate --android --assetPath assets
```

## 4. Notifications push (Firebase Cloud Messaging)

Le canal push est **optionnel au build** mais requis pour la mise en production
(les notifications InApp + rappels locaux marchent sans lui).

1. Console Firebase → « Ajouter un projet » → ex. `mondocpro`.
2. Ajouter une app **Android** avec le package `ci.mondopro.app` (identique au `appId`).
3. Télécharger `google-services.json` → le déposer dans **`android/app/`** (gitigné — ne jamais le commiter).
4. Créer un **compte de service** : Console Google Cloud → IAM & Admin → Comptes de service → Firebase Admin SDK → « Générer une nouvelle clé privée » (JSON).
5. Sur **Vercel** → Settings → Environment Variables (Production + Preview) :
   - `FIREBASE_SERVICE_ACCOUNT_JSON` = le JSON entier du compte de service (valeur sur une ligne),
   - ou les 3 variables décomposées : `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (conserver les `\n` littéraux).
6. Redéployer. Vérifier dans les logs Vercel : plus de message `[push] Firebase non configuré`.

Validation de bout en bout : connexion dans l'APK → accepter la permission notifications →
déclencher un événement métier (recharge, RDV domicile, dispatch) → la push arrive.
Le serveur écrème automatiquement les jetons invalides (`[push] … jetons purgés` dans les logs).

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
| Aucune push reçue | `google-services.json` absent du build, ou FIREBASE_* absentes de Vercel | §4 (les logs affichent `[native] registration FCM` / `[push] Firebase non configuré`) |
| Permission notifications jamais demandée | Android 13+ : demandée à la 1re ouverture après connexion | se déconnecter/reconnecter, ou réinstaller |
| Rappels RDV avec quelques minutes de retard | alarmes inexactes (politique Play, pas de SCHEDULE_EXACT_ALARM) | comportement documenté (ADR-008) — le pipeline serveur 24 h double le rappel |
| `cap sync` échoue | dépendances natives désynchronisées | `bun install` puis `npx cap sync android` |
