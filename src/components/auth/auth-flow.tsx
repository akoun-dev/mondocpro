"use client";

// Flux d'authentification public — vues DÉDIÉES (pas d'onglets, décision PO 2026-10).
// Machine à états client : login → register → forgot → reset. La route unique "/"
// (contrainte plateforme) reste la seule URL : les vues sont pilotées par état,
// transitions animées sobres AnimatePresence (DESIGN_SYSTEM §4).
//
// Design v2 (refonte UI 2026-10) : écran partagé desktop — panneau de marque
// en dégradé médical (ADR-002) à gauche, formulaire à droite ; bannière
// compacte sur mobile. Aucune logique métier modifiée.
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
import { ZONE_LABELS } from "@/lib/auth-schemas";

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

// Arguments de vente affichés sur le panneau de marque (desktop).
const BRAND_FEATURES = [
  {
    icon: CalendarCheck,
    title: "Rendez-vous simplifiés",
    description: "Consultations au cabinet ou à domicile, en quelques clics.",
  },
  {
    icon: Wallet,
    title: "Épargne santé Tokens",
    description: "Constituez votre épargne santé progressivement et en toute sécurité.",
  },
  {
    icon: MapPin,
    title: "Soins de proximité",
    description: "Des équipes soignantes certifiées, proches de chez vous.",
  },
];

const viewVariants = {
  enter: { x: 40, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -40, opacity: 0 },
};

// Entrée en cascade du panneau de marque (animations sobres, DESIGN_SYSTEM §4).
const panelContainerVariants = {
  center: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const panelItemVariants = {
  enter: { y: 16, opacity: 0 },
  center: { y: 0, opacity: 1, transition: { duration: 0.22, ease: "easeOut" as const } },
};

function BrandPanel() {
  return (
    <aside
      aria-label="Présentation MondocPro"
      className="relative hidden w-[44%] max-w-[560px] flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-primary to-primary-dark p-10 text-primary-foreground lg:flex xl:p-14"
    >
      {/* Cercles décoratifs sobres (aucun texte blanc sur success/warning — ADR-002) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-24 size-80 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-white/[0.07] blur-2xl" />
        <div className="absolute right-16 top-1/3 size-24 rounded-full border border-white/15" />
        <div className="absolute bottom-24 left-10 size-14 rounded-full border border-white/10" />
      </div>

      <motion.div
        variants={panelContainerVariants}
        initial="enter"
        animate="center"
        className="relative flex h-full flex-col justify-between"
      >
        <motion.header variants={panelItemVariants} className="flex items-center gap-3">
          <Image
            src="/img/mondocpro.jpeg"
            alt="Logo MondocPro"
            width={56}
            height={56}
            priority
            className="size-14 rounded-full object-cover ring-2 ring-white/40"
          />
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight">MondocPro</span>
            <span className="text-sm text-white/80">Votre santé en main</span>
          </div>
        </motion.header>

        <div className="flex flex-col gap-8">
          <motion.h2
            variants={panelItemVariants}
            className="max-w-md text-3xl font-bold leading-tight tracking-tight xl:text-4xl"
          >
            La santé de votre famille, entre de bonnes mains.
          </motion.h2>

          <ul className="flex flex-col gap-5">
            {BRAND_FEATURES.map((feature) => (
              <motion.li key={feature.title} variants={panelItemVariants} className="flex items-start gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                  <feature.icon className="size-5" aria-hidden="true" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="font-semibold">{feature.title}</span>
                  <span className="text-sm leading-relaxed text-white/80">{feature.description}</span>
                </span>
              </motion.li>
            ))}
          </ul>
        </div>

        <motion.footer variants={panelItemVariants} className="flex flex-col gap-3">
          <ul aria-label="Zones couvertes" className="flex flex-wrap gap-2">
            {Object.values(ZONE_LABELS).map((zone) => (
              <li
                key={zone}
                className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/20"
              >
                {zone}
              </li>
            ))}
          </ul>
          <p className="text-xs text-white/60">
            © {new Date().getFullYear()} MondocPro — Abidjan, Côte d&apos;Ivoire
          </p>
        </motion.footer>
      </motion.div>
    </aside>
  );
}

function MobileBrandHeader() {
  return (
    <header className="relative overflow-hidden bg-gradient-to-br from-primary to-primary-dark px-4 pb-8 pt-6 text-center text-primary-foreground sm:pt-8 lg:hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -right-16 -top-16 size-48 rounded-full bg-white/10 blur-xl" />
        <div className="absolute -bottom-20 -left-10 size-56 rounded-full bg-white/[0.07] blur-xl" />
      </div>
      <div className="relative flex flex-col items-center gap-2">
        <Image
          src="/img/mondocpro.jpeg"
          alt="Logo MondocPro"
          width={64}
          height={64}
          priority
          className="size-16 rounded-full object-cover ring-2 ring-white/40"
        />
        <h1 className="text-xl font-bold tracking-tight">MondocPro</h1>
        <p className="text-sm text-white/80">Votre santé en main</p>
      </div>
    </header>
  );
}

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
    <div className="flex min-h-screen w-full">
      <BrandPanel />

      <div className="flex min-w-0 flex-1 flex-col bg-gradient-to-b from-secondary/60 via-background to-background">
        <MobileBrandHeader />

        {/* Style app mobile : carte en « feuille » pleine largeur aux coins
            supérieurs arrondis, flottante et centrée dès sm (tablet/desktop). */}
        <section
          aria-label="Authentification MondocPro"
          className="flex w-full flex-1 animate-in flex-col fade-in slide-in-from-bottom-2 duration-500 sm:justify-center sm:px-4 sm:py-10"
        >
          <Card className="relative flex w-full flex-1 flex-col rounded-t-3xl border-x-0 border-b-0 px-5 pb-10 pt-7 shadow-[0_-10px_40px_-12px_rgb(13_71_161/0.18)] sm:mx-auto sm:max-w-md sm:flex-none sm:rounded-xl sm:border sm:px-8 sm:pb-8 sm:shadow-xl sm:shadow-primary/[0.08]">
            <div className="flex flex-1 flex-col sm:flex-none">
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
            </div>

            <p className="mt-8 text-center text-xs text-muted-foreground sm:hidden">
              © {new Date().getFullYear()} MondocPro — Abidjan, Côte d&apos;Ivoire
            </p>
          </Card>
        </section>
      </div>
    </div>
  );
}
