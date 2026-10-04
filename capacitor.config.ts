import type { CapacitorConfig } from "@capacitor/cli";

// Task 36 — Configuration Capacitor de l'application Android « Mon doc Pro ».
//
// Architecture « WebView distante » (ADR-007) : le WebView Android charge
// l'application Next.js DÉPLOYÉE (https://mondocpro.vercel.app) — les API
// routes, le SSR et les cookies de session restent côté serveur, sans
// double maintenance. Le pont natif (window.Capacitor) est injecté par le
// WebView dans les pages chargées depuis server.url ; les plugins JS
// (@capacitor/*) sont bundlés dans l'app web et se connectent automatiquement
// au pont quand ils détectent la plateforme native (Capacitor.isNativePlatform()).
// Dans un navigateur classique, tout cela reste inerte — un seul code source.
//
// Pour pointer le WebView vers un serveur de développement local
// (émulateur ou appareil sur le même réseau) :
//   CAPACITOR_SERVER_URL=http://192.168.1.42:3000 npx cap sync android
// (cleartext HTTP n'est alors autorisé que pour ce build de dev — jamais en prod).
const serverUrl =
  process.env.CAPACITOR_SERVER_URL ?? "https://mondocpro.vercel.app";
const isLocalDev = Boolean(process.env.CAPACITOR_SERVER_URL);

const config: CapacitorConfig = {
  // Identifiant d'application (package Android) — NE PEUT PAS être changé
  // après la première publication. À valider par le PO avant toute mise en
  // ligne sur le Play Store (voir .ai/APK_BUILD.md §1).
  appId: "ci.mondopro.app",
  appName: "Mon doc Pro",
  // Shell de secours embarqué (affiché si le serveur distant est injoignable)
  // — voir capacitor-shell/index.html.
  webDir: "capacitor-shell",
  server: {
    url: serverUrl,
    cleartext: isLocalDev,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: isLocalDev,
  },
  plugins: {
    SplashScreen: {
      // Le splash natif est masqué par NativeBootstrap (src/lib/native.ts)
      // une fois l'app web chargée — pas de flash blanc, pas de splash figé.
      launchShowDuration: 2000,
      launchAutoHide: false,
      backgroundColor: "#1565c0",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      // Fond clair, icônes sombres — cohérent avec le thème light de l'app.
      style: "LIGHT",
      backgroundColor: "#ffffff",
      overlaysWebView: false,
    },
    Keyboard: {
      // Les formulaires (login, RDV, recharge) ne sont jamais recouverts.
      resize: "body",
      style: "DEFAULT",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    LocalNotifications: {
      smallIcon: "ic_launcher",
      iconColor: "#1565c0",
    },
  },
};

export default config;
