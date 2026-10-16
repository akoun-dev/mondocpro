package ci.mondopro.app;

import android.content.Context;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

// Task 38 — Diagnostics natifs de l'APK « Mon doc Pro ».
//
// Contexte incident (2026-10-05) : le plugin @capacitor/push-notifications
// 8.1.3 appelle FirebaseMessaging.getInstance() sans vérifier que Firebase
// est initialisé. Sur un build sans google-services.json,
// FirebaseInitProvider n'enregistre aucune option par défaut et l'appel lève
// une IllegalStateException que le bridge Capacitor re-propage en
// RuntimeException non interceptée → l'app se ferme au moment où
// l'utilisateur accepte la permission notifications.
//
// Ce plugin local permet au code web (src/lib/native.ts) de :
//  1. firebaseAvailable() — vérifier PAR RÉFLEXION que Firebase est
//     réellement initialisé AVANT tout appel au plugin push (réflexion =
//     aucune dépendance de compilation supplémentaire côté app) ;
//  2. lastCrash() / clearLastCrash() — relire le stack trace du dernier
//     crash (écrit par le gestionnaire installé dans MainActivity) pour
//     diagnostiquer les incidents sans accès adb.
@CapacitorPlugin(name = "Diagnostics")
public class DiagnosticsPlugin extends Plugin {

    @PluginMethod
    public void firebaseAvailable(PluginCall call) {
        boolean available = false;
        String reason = "unknown";
        try {
            Class<?> firebaseApp = Class.forName("com.google.firebase.FirebaseApp");
            Context context = getContext();
            Object app = null;
            // FirebaseInitProvider (exécuté au démarrage du process) a déjà
            // initialisé Firebase si google-services.json a été fourni au
            // build → getInstance() renvoie l'instance par défaut.
            try {
                app = firebaseApp.getMethod("getInstance").invoke(null);
            } catch (Throwable ignored) {
                app = null;
            }
            if (app == null) {
                // initializeApp(context) renvoie null (sans lever) quand
                // aucune option par défaut n'est disponible.
                try {
                    app = firebaseApp
                        .getMethod("initializeApp", Context.class)
                        .invoke(null, context);
                } catch (Throwable ignored) {
                    app = null;
                }
            }
            available = app != null;
            reason = available ? "ok" : "no-default-options";
        } catch (ClassNotFoundException e) {
            // firebase-messaging absent du classpath → build sans push.
            reason = "firebase-missing";
        } catch (Throwable t) {
            reason = "error:" + t.getClass().getSimpleName();
        }
        JSObject result = new JSObject();
        result.put("available", available);
        result.put("reason", reason);
        call.resolve(result);
    }

    @PluginMethod
    public void lastCrash(PluginCall call) {
        String trace = readTrace(crashFile());
        JSObject result = new JSObject();
        result.put("crashed", trace != null);
        result.put("trace", trace == null ? "" : trace);
        call.resolve(result);
    }

    @PluginMethod
    public void clearLastCrash(PluginCall call) {
        try {
            File file = crashFile();
            if (file.exists()) {
                file.delete();
            }
        } catch (Throwable ignored) {
            // best-effort — jamais bloquant
        }
        call.resolve();
    }

    private File crashFile() {
        return new File(getContext().getFilesDir(), "last_crash.txt");
    }

    private String readTrace(File file) {
        if (!file.exists()) {
            return null;
        }
        try (BufferedReader reader = new BufferedReader(
            new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8)
        )) {
            StringBuilder builder = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                builder.append(line).append('\n');
            }
            String trace = builder.toString().trim();
            return trace.isEmpty() ? null : trace;
        } catch (Throwable t) {
            return null;
        }
    }
}
