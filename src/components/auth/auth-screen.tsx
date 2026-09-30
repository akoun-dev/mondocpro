"use client";

// Écran public d'authentification — Phase 0 wireframe (SPEC-AUTH §5)
// Brand centré + Tabs Connexion / Inscription.
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";

export function AuthScreen() {
  return (
    <section
      aria-label="Authentification MondocPro"
      className="mx-auto flex w-full max-w-md animate-in fade-in slide-in-from-bottom-2 flex-col items-center gap-6 px-4 py-8 duration-500 sm:py-12"
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
        <p className="text-muted-foreground">Votre santé, à domicile</p>
      </header>

      <Card className="w-full p-6">
        <Tabs defaultValue="login">
          <TabsList className="grid h-11 w-full grid-cols-2">
            <TabsTrigger value="login">Connexion</TabsTrigger>
            <TabsTrigger value="register">Inscription</TabsTrigger>
          </TabsList>
          <TabsContent value="login" className="pt-4">
            <LoginForm />
          </TabsContent>
          <TabsContent value="register" className="pt-4">
            <RegisterForm />
          </TabsContent>
        </Tabs>
      </Card>
    </section>
  );
}
