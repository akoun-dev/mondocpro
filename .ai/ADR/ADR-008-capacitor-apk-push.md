# ADR-008 — Application Android via Capacitor (WebView distante) et canal push FCM

> Architecture Decision Record. Un ADR = **une** décision structurante, immuable une fois acceptée (si elle change, un nouvel ADR la déprécie).
> **Périmètre** : FEATURE-MOBILE (Task 36) — distribution APK, plugins natifs, notifications push et rappels locaux de RDV.

## Statut
`Accepté` — l'identifiant d'application (`ci.mondopro.app`) et la configuration Firebase restent à confirmer par le PO avant toute publication Play Store (voir `.ai/APK_BUILD.md`).

## Date
2026-10-05

## Contexte
Le produit est une application web Next.js (App Router) dont TOUTE la logique vit côté serveur : API routes authentifiées par cookie de session, transactions Prisma sur PostgreSQL (Supabase), SSR des vues. Le PO souhaite distribuer un **APK Android** aux patients et infirmiers, avec un comportement « app mobile » : notifications **push** (RDV, missions, recharges), **rappels locaux** de rendez-vous, retour haptique, splash, gestion du réseau.

Contraintes structurantes :
- Un export statique Next.js est **impossible** : les API routes et le SSR sont au cœur de l'app (auth par cookie HttpOnly, garde-fous serveur, transactions sérialisables).
- Maintenir un second code source natif (Kotlin) ou React Native dupliquerait l'ensemble des écrans et de la logique métier — inacceptable pour une équipe de 1.
- Le code de session repose sur des cookies `SameSite=None; Secure; Partitioned` en production (déjà conformes WebView).
- La passerelle SMS reste un stub (ADR-006 ouverte) : le rappel RDV a besoin d'un canal réel à court terme.

## Décision
Nous adoptons **Capacitor 8** pour embarquer l'app web dans un WebView Android :
1. **WebView distante (server.url)** : l'APK charge `https://mondocpro.vercel.app` — un seul code source, l'app web embarque `@capacitor/core` + les plugins JS ; le pont natif (`window.Capacitor`) est injecté par le WebView. Le shell embarqué (`capacitor-shell/`) n'apparaît que si le serveur est injoignable.
2. **Plugins retenus** (tous no-op dans le navigateur, un seul bundle) : `push-notifications`, `local-notifications`, `splash-screen`, `status-bar`, `app` (bouton retour), `haptics`, `network` (bandeau hors-ligne), `preferences` (jeton FCM local), `device` (métadonnées d'enregistrement), `keyboard`, `toast`, `share`, `browser`. Camera/Geolocation sont **exclus** faute de cas d'usage actuel (ajout trivial le jour venu).
3. **Double canal notification** : toute notification InApp (Task 24/35) est accompagnée d'une **push FCM jumelle** envoyée APRES le commit de la transaction métier (fire-and-forget, jamais bloquante, `data.url` = lien profond par rôle). Le serveur persiste les jetons dans `device_tokens` (upsert par jeton — un appareil suit le dernier compte connecté).
4. **Rappels locaux de RDV** : à la réservation, l'appareil planifie H-24 et H-1 (`@capacitor/local-notifications`, `allowWhileIdle`, ids dérivés de l'id RDV) — fonctionne sans Firebase et sans réseau ; annulés à l'annulation du RDV. Le pipeline serveur 24 h (Task 24) reste l'autorité et pousse lui aussi.
5. **Firebase optionnel au build** : le plugin google-services n'est appliqué que si `android/app/google-services.json` existe (gitigné). Sans lui, l'APK compile et tout fonctionne sauf le canal push (les InApp + rappels locaux restent opérationnels).
6. **Liens profonds** : `data.url` = `/?tab=<onglet>` validé par rôle au montage du dashboard (aucun onglet hors rôle).

## Alternatives considérées
| Alternative | Raison du rejet |
|---|---|
| Export statique Next.js + WebView local | API routes/SSR indisponibles — refonte complète de l'auth et des gardes serveur |
| React Native / Flutter | Second code source à maintenir ; ROI négatif au stade MVP |
| PWA seule (TWA) | Pas de push FCM natif fiable sur Android WebView sans Capacitor, pas de rappels locaux programmés, UX splash/statut approximative |
| PWA + service worker | Le service worker ne survit pas au WebView Capacitor et n'apporte ni FCM ni alarmes exactes |

## Conséquences
**Positives :**
- Un seul code source web/native ; les fonctionnalités futures (Conseils, Tokens…) arrivent dans l'APK sans build natif — seuls les plugins nouveaux exigent un `cap sync`.
- Le canal push réduit le délai de réaction métier (dispatch infirmier, validation de recharge) sans dépendre de la passerelle SMS (ADR-006 toujours ouverte).
- `device_tokens` porte le `lastSeenAt` : base saine pour une future purge d'entretien.
- Firebase absent ⇒ dégradation gracieuse (jamais d'échec de build ni de route métier).

**Négatives / risques assumés :**
- L'APK exige le réseau : le shell embarqué affiche un état explicite hors-ligne, mais l'app n'a pas de mode avion fonctionnel.
- Le bouton retour Android remonte l'historique, pas les dialogs Radix (limitation MVP documentée) — les modales se ferment par leur bouton.
- Rappels locaux **inexact** (pas de `SCHEDULE_EXACT_ALARM`, politique Play) : dérive possible de quelques minutes.
- La charge serveur (SSR complet dans le WebView) dépend de la disponibilité de Vercel/Supabase.

## Références
- `.ai/APK_BUILD.md` — procédure complète de build (prérequis JDK 21/Android Studio, Firebase, signature).
- `.ai/API_CONTRACTS.md` — contrats `POST /api/push/register` et `POST /api/push/unregister`.
- `src/lib/native.ts` (pont unique), `src/lib/push.ts` (serveur), `capacitor.config.ts`.
- ADR-003 (Supabase PostgreSQL), ADR-006 (passerelle SMS — le push est un canal complémentaire), ADR-007 (cycle Tokens — notifications recharge).
