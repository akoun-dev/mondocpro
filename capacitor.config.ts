import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Configuration Capacitor — Mon doc Pro (ADR-007, Task 36)
 *
 * Stratégie WebView distante : l'APK embarque un WebView pointant vers
 * l'app Next.js déployée (API routes + SSR + cookies de session vivent côté
 * serveur). Le pont natif Capacitor est injecté automatiquement dans le
 * WebView, ce qui rend les plugins (@capacitor/*) disponibles à la web-app.
 *
 * - webDir "mobile" : pages d'amorçage statiques uniquement (splash offline /
 *   écran d'erreur réseau) — la logique métier reste sur le serveur.
 * - server.url : cible production ; allowNavigation garde la navigation dans
 *   le WebView (sinon les liens s'ouvrent dans le navigateur système).
 * - androidScheme https : cohérent avec les cookies SameSite=None; Secure
 *   posés par src/lib/auth.ts en production.
 */
const config: CapacitorConfig = {
  appId: "com.mondocpro.app",
  appName: "Mon doc Pro",
  webDir: "mobile",
  server: {
    url: "https://mondocpro.vercel.app",
    allowNavigation: ["mondocpro.vercel.app"],
    // Page locale (dans mobile/) affichée si le serveur est injoignable
    errorPath: "offline.html",
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2500,
      launchAutoHide: true,
      backgroundColor: "#0F766E",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0F766E",
      overlaysWebView: false,
    },
    Keyboard: {
      resize: "body",
      style: "DARK",
    },
    LocalNotifications: {
      iconColor: "#0F766E",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
