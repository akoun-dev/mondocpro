"use client"

// Route unique « / » — orchestration des écrans selon l'état d'auth
// (US-AUTH-3, SPEC-AUTH). Sans footer (décision PO 2026-10).
// Design v2 (refonte UI 2026-10) : chargement brandé « Heartbeat médical ».
import Image from "next/image"
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
                        className="flex min-h-[60vh] flex-1 flex-col items-center justify-center px-6"
                        role="status"
                        aria-live="polite"
                    >
                        <div className="relative flex size-28 items-center justify-center">
                            <span
                                className="absolute size-24 rounded-full border border-primary/20 motion-safe:animate-ping motion-reduce:animate-none"
                                aria-hidden="true"
                            />
                            <span
                                className="absolute size-20 rounded-full border border-primary/30 motion-safe:animate-pulse motion-reduce:animate-none"
                                aria-hidden="true"
                            />
                            <div className="relative rounded-full bg-card p-2 shadow-lg ring-1 ring-border/70">
                                <Image
                                    src="/img/Mon doc Pro.jpeg"
                                    alt="Mon doc Pro"
                                    width={64}
                                    height={64}
                                    priority
                                    className="size-16 rounded-full object-cover"
                                />
                            </div>
                        </div>
                        <svg
                            className="mt-6 h-7 w-36 text-primary"
                            viewBox="0 0 144 28"
                            fill="none"
                            aria-hidden="true"
                        >
                            <path
                                d="M2 14h24l6-10 8 20 8-14h18l6-6 8 20 8-10h24"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="heartbeat-line"
                            />
                        </svg>
                        <p className="mt-5 text-sm font-semibold text-foreground">
                            Connexion à votre espace…
                        </p>
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
