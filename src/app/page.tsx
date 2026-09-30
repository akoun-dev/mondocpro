'use client'

// Route unique « / » — orchestration des écrans selon l'état d'auth
// (US-AUTH-3, SPEC-AUTH). Le footer commun apparaît dans les 3 états.
import { Loader2 } from "lucide-react";
import { AuthScreen } from "@/components/auth/auth-screen";
import { UserDashboard } from "@/components/auth/user-dashboard";
import { useAuth } from "@/hooks/use-auth";

export default function Home() {
  const { status } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex w-full flex-1 flex-col">
        {status === "loading" && (
          <div
            className="flex flex-1 items-center justify-center py-16"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
            <span className="sr-only">Chargement de votre espace…</span>
          </div>
        )}
        {status === "unauthenticated" && <AuthScreen />}
        {status === "authenticated" && <UserDashboard />}
      </main>

      <footer className="mt-auto border-t bg-muted/50 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-sm text-muted-foreground">
        <p>Yopougon · Songon · PK22 · N&apos;Dotré</p>
        <p>© 2026 MondocPro — Votre santé, à domicile</p>
      </footer>
    </div>
  );
}
