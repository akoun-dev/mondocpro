"use client"

// Route unique « / » — orchestration des écrans selon l'état d'auth
// (US-AUTH-3, SPEC-AUTH). Sans footer (décision PO 2026-10).
// Design v2 (refonte UI 2026-10) : chargement brandé (logo + spinner).
import Image from "next/image"
import { Loader2 } from "lucide-react"
import { AuthFlow } from "@/components/auth/auth-flow"
import { UserDashboard } from "@/components/auth/user-dashboard"
import { useAuth } from "@/hooks/use-auth"

export default function Home() {
    const { status } = useAuth()

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <main className="flex w-full flex-1 flex-col">
                {status === "loading" && (
                    <div
                        className="flex flex-1 flex-col items-center justify-center gap-4 py-16"
                        role="status"
                        aria-live="polite"
                    >
                        <Image
                            src="/img/Mon doc Pro.jpeg"
                            alt="Mon doc Pro"
                            width={56}
                            height={56}
                            priority
                            className="size-14 animate-pulse rounded-full object-cover ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
                        />
                        <Loader2
                            className="size-6 animate-spin text-primary"
                            aria-hidden="true"
                        />
                        <span className="sr-only">
                            Chargement de votre espace…
                        </span>
                    </div>
                )}
                {status === "unauthenticated" && <AuthFlow />}
                {status === "authenticated" && <UserDashboard />}
            </main>
        </div>
    )
}
