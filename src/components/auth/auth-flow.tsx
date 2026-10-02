"use client";

// Flux d'authentification public — vues DÉDIÉES (pas d'onglets, décision PO 2026-10).
// Machine à états client : login → register → forgot → reset. La route unique "/"
// (contrainte plateforme) reste la seule URL : les vues sont pilotées par état,
// transitions animées sobres AnimatePresence (DESIGN_SYSTEM §4).
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
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
    <section
      aria-label="Authentification MondocPro"
      className="mx-auto flex w-full max-w-md animate-in flex-col items-center gap-6 fade-in px-4 py-8 slide-in-from-bottom-2 duration-500 sm:py-12"
    >
      <header className="flex flex-col items-center gap-2 text-center">
        <Image
          src="/img/mondocpro.jpeg"
          alt="MondocPro"
          width={96}
          height={96}
          priority
          className="size-24 rounded-full object-cover ring-2 ring-primary ring-offset-2 ring-offset-background"
        />
        <h1 className="text-2xl font-bold text-primary">MondocPro</h1>
        <p className="text-muted-foreground">Votre santé en main</p>
      </header>

      <Card className="w-full p-6">
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
              className="text-xl font-semibold text-primary-dark focus:outline-none"
            >
              {VIEW_META[view].title}
            </h2>
            <p className="mt-0.5 mb-4 text-sm text-muted-foreground">
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
    </section>
  );
}
