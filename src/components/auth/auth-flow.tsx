"use client";

// Flux d'authentification public — vues DÉDIÉES (pas d'onglets, décision PO 2026-10).
// Machine à états client : login → register → forgot → reset. La route unique "/"
// (contrainte plateforme) reste la seule URL : les vues sont pilotées par état,
// transitions animées sobres AnimatePresence (DESIGN_SYSTEM §4).
//
// Design v4 (nouveau design auth 2026-10) : écran premium centré sur dégradé
// médical plein écran (ADR-002) — logo flottant, carte verre dépoli, motif
// « plus » médical discret, arguments de vente en pastilles de verre (desktop).
// Aucune logique métier modifiée.
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CalendarCheck, MapPin, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export type AuthView = "login" | "register" | "forgot" | "reset";

const VIEW_META: Record<AuthView, { title: string; description: string }> = {
  login: {
    title: "Connexion",
    description: "Accédez à votre espace santé",
  },
  register: {
    title: "Inscription",
    description: "Créez votre compte patient en 3 étapes",
  },
  forgot: {
    title: "Mot de passe oublié",
    description: "Recevez un code à 6 chiffres par SMS",
  },
  reset: {
    title: "Nouveau mot de passe",
    description: "Saisissez le code reçu et choisissez un nouveau mot de passe",
  },
};

// Vue de retour pour le bouton « Retour » de chaque vue.
const PARENT_VIEW: Partial<Record<AuthView, AuthView>> = {
  register: "login",
  forgot: "login",
  reset: "forgot",
};

// Arguments de vente — pastilles de verre sous la carte (desktop ≥ sm).
const BRAND_CHIPS = [
  { icon: CalendarCheck, label: "Rendez-vous simplifiés" },
  { icon: Wallet, label: "Épargne santé Tokens" },
  { icon: MapPin, label: "Soins de proximité" },
];

// Motif « plus » médical en tuile SVG (opacité 4 % — décor discret).
const PLUS_PATTERN_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Crect x='14' y='22' width='20' height='4' rx='2' fill='%23ffffff'/%3E%3Crect x='22' y='14' width='4' height='20' rx='2' fill='%23ffffff'/%3E%3C/svg%3E";

const viewVariants = {
  enter: { x: 40, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -40, opacity: 0 },
};

export function AuthFlow() {
  const [view, setView] = useState<AuthView>("login");
  const [resetPhone, setResetPhone] = useState("");

  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasNavigatedRef = useRef(false);

  // Accessibilité : focus sur le titre de la vue après sa transition (250 ms).
  useEffect(() => {
    if (!hasNavigatedRef.current) return;
    const timer = setTimeout(() => headingRef.current?.focus(), 320);
    return () => clearTimeout(timer);
  }, [view]);

  function goTo(next: AuthView) {
    hasNavigatedRef.current = true;
    setView(next);
  }

  function handleCodeSent(phone: string) {
    setResetPhone(phone);
    goTo("reset");
  }

  const parent = PARENT_VIEW[view];

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-gradient-to-br from-primary via-primary to-primary-dark">
      {/* Décor : orbes lumineux + anneau + motif médical discret (ARIA-hidden) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 size-[28rem] rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 size-[32rem] rounded-full bg-success/20 blur-3xl" />
        <div className="absolute right-[12%] top-[14%] size-64 rounded-full border border-white/10" />
        <div className="absolute bottom-[18%] left-[8%] size-24 rounded-full border border-white/10" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: `url("${PLUS_PATTERN_URL}")` }}
        />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-7 px-4 py-10 sm:py-14">
        <header className="flex animate-in flex-col items-center gap-3 text-center text-primary-foreground fade-in slide-in-from-bottom-2 duration-500">
          <Image
            src="/img/mondocpro.jpeg"
            alt="Logo MondocPro"
            width={80}
            height={80}
            priority
            className="size-20 rounded-full object-cover shadow-lg ring-4 ring-white/25"
          />
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-tight">MondocPro</h1>
            <p className="text-sm text-white/85">Votre santé en main — Abidjan</p>
          </div>
        </header>

        <Card className="w-full max-w-md animate-in rounded-3xl border-white/50 bg-card/95 p-6 shadow-2xl shadow-primary-dark/40 backdrop-blur-xl fade-in slide-in-from-bottom-2 duration-500 sm:p-8">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              variants={viewVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {parent && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => goTo(parent)}
                  className="-ml-2 mb-3 h-9 gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Retour
                </Button>
              )}

              <h2
                ref={headingRef}
                tabIndex={-1}
                className="text-xl font-semibold tracking-tight text-primary-dark focus:outline-none"
              >
                {VIEW_META[view].title}
              </h2>
              <p className="mt-0.5 mb-5 text-sm text-muted-foreground">
                {VIEW_META[view].description}
              </p>

              {view === "login" && (
                <LoginForm
                  onForgotPassword={() => goTo("forgot")}
                  onSwitchToRegister={() => goTo("register")}
                />
              )}

              {view === "register" && <RegisterForm />}

              {view === "forgot" && <ForgotPasswordForm onCodeSent={handleCodeSent} />}

              {view === "reset" && (
                <ResetPasswordForm
                  phone={resetPhone}
                  onBack={() => goTo("forgot")}
                  onReset={() => goTo("login")}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </Card>

        {/* Arguments de vente — pastilles de verre (masquées sur petit écran) */}
        <ul className="hidden flex-wrap items-center justify-center gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-500 sm:flex">
          {BRAND_CHIPS.map((chip) => (
            <li
              key={chip.label}
              className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/20 backdrop-blur"
            >
              <chip.icon className="size-4" aria-hidden="true" />
              {chip.label}
            </li>
          ))}
        </ul>

        <footer className="flex animate-in flex-col items-center gap-2.5 fade-in slide-in-from-bottom-2 duration-500">
          <p className="text-xs text-white/60">
            © {new Date().getFullYear()} MondocPro — Abidjan, Côte d&apos;Ivoire
          </p>
        </footer>
      </div>
    </div>
  );
}
