package ci.mondopro.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin local « Diagnostics » (Task 38) : expose firebaseAvailable()
        // au code web — la garde anti-crash du canal push FCM — ainsi que la
        // lecture du journal de crash. Doit être enregistré AVANT
        // super.onCreate() pour être attaché au bridge dès le démarrage.
        registerPlugin(DiagnosticsPlugin.class);

        installCrashLogger();

        super.onCreate(savedInstanceState);
    }

    // ——— Journalisation des crashs (Task 38) ———
    //
    // L'équipe n'a pas d'accès adb sur les appareils : chaque exception non
    // gérée est copiée dans files/last_crash.txt AVANT la mort du process,
    // puis le gestionnaire d'origine est invoqué (comportement système
    // inchangé — fermeture de l'app). Le plugin Diagnostics expose ensuite
    // lastCrash()/clearLastCrash() pour lire/purger ce journal via le pont.
    private void installCrashLogger() {
        final Thread.UncaughtExceptionHandler previous =
            Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            try {
                java.io.File file =
                    new java.io.File(getFilesDir(), "last_crash.txt");
                java.io.PrintWriter writer = new java.io.PrintWriter(
                    new java.io.FileWriter(file, false)
                );
                writer.println("thread: " + thread.getName());
                writer.println(android.util.Log.getStackTraceString(throwable));
                writer.close();
            } catch (Throwable ignored) {
                // ne jamais masquer le crash d'origine
            }
            if (previous != null) {
                previous.uncaughtException(thread, throwable);
            }
        });
    }
}
