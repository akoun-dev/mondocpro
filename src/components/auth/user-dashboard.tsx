"use client";

// Espace connecté MVP — US-AUTH-3/4 (SPEC-AUTH)
// Profil + carte « à venir » contextualisée par rôle + déconnexion.
import Image from "next/image";
import { Clock, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ZONE_LABELS } from "@/lib/auth-schemas";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import type { AppRole, AppUser } from "@/stores/auth-store";

const ROLE_LABELS: Record<AppRole, string> = {
  PATIENT: "Patient",
  INFIRMIER: "Infirmier",
  ADMIN: "Médecin Chef",
};

// Contrainte a11y (ADR-002) : jamais de texte blanc sur success/warning —
// les foregrounds foncés des tokens sont utilisés tels quels.
const ROLE_BADGE_CLASSES: Record<AppRole, string> = {
  PATIENT: "bg-primary text-primary-foreground",
  INFIRMIER: "bg-success text-success-foreground",
  ADMIN: "bg-warning text-warning-foreground",
};

const ROLE_SPACE: Record<AppRole, { title: string; description: string; features: string[] }> = {
  PATIENT: {
    title: "Espace Patient",
    description: "Prise de rendez-vous et épargne santé Tokens — à venir",
    features: [
      "Prendre rendez-vous au cabinet ou à domicile",
      "Constituer une épargne santé en Tokens",
      "Recevoir des sensibilisations médicales",
    ],
  },
  INFIRMIER: {
    title: "Espace Infirmier",
    description: "Missions et géolocalisation — à venir",
    features: [
      "Recevoir les missions en temps réel",
      "Suivre la géolocalisation des interventions",
      "Rendre compte des visites effectuées",
    ],
  },
  ADMIN: {
    title: "Espace Médecin Chef",
    description: "Supervision et dispatch des équipes — à venir",
    features: [
      "Superviser l'activité des équipes soignantes",
      "Dispatcher les missions entre infirmiers",
      "Consulter les statistiques par zone",
    ],
  },
};

// Formatage lisible : +2250701020304 → +225 07 01 02 03 04 ; 01020304 → 01 02 03 04
function formatPhoneDisplay(phone: string): string {
  const cleaned = phone.replace(/[\s.-]/g, "");
  const hasPlus = cleaned.startsWith("+");
  const digits = hasPlus ? cleaned.slice(1) : cleaned;
  if (!/^\d{8,15}$/.test(digits)) return phone;

  if (hasPlus && digits.length > 10) {
    const countryCode = digits.slice(0, digits.length - 10);
    const local = digits.slice(-10);
    return `+${countryCode} ${local.replace(/(\d{2})(?=\d)/g, "$1 ")}`;
  }
  return `${hasPlus ? "+" : ""}${digits.replace(/(\d{2})(?=\d)/g, "$1 ")}`;
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0].charAt(0);
  const second = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return `${first}${second}`.toUpperCase();
}

function RoleBadge({ role, className }: { role: AppRole; className?: string }) {
  return (
    <Badge className={ROLE_BADGE_CLASSES[role]} aria-label={`Rôle : ${ROLE_LABELS[role]}`}>
      {ROLE_LABELS[role]}
    </Badge>
  );
}

export function UserDashboard() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const space = ROLE_SPACE[user.role];

  async function handleLogout() {
    await logout();
    toast({
      title: "Déconnecté",
      description: "À bientôt sur MondocPro !",
    });
  }

  return (
    <div className="flex w-full animate-in flex-col fade-in slide-in-from-bottom-2 duration-500">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Image
              src="/img/mondocpro.jpeg"
              alt="MondocPro"
              width={40}
              height={40}
              className="size-10 rounded-full object-cover ring-1 ring-primary/30"
            />
            <span className="text-lg font-bold text-primary">MondocPro</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end gap-0.5">
              <span className="max-w-[10rem] truncate text-sm font-medium sm:max-w-none">
                {user.fullName}
              </span>
              <RoleBadge role={user.role} className="hidden sm:inline-flex" />
            </div>
            <Avatar className="size-10">
              <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
                {getInitials(user.fullName)}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      {/* Contenu rendu à l'intérieur du <main> de app/page.tsx (HTML sémantique :
          un seul élément <main> par page). */}
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-8">
        <h1 className="sr-only">Mon espace MondocPro</h1>

        <section aria-label="Mon profil" className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                <span>Mon profil</span>
                <RoleBadge role={user.role} />
              </CardTitle>
              <CardDescription>Vos informations de compte</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm text-muted-foreground">Nom complet</span>
                <span className="font-medium">{user.fullName}</span>
              </div>
              <Separator />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm text-muted-foreground">Téléphone</span>
                <span className="font-medium">{formatPhoneDisplay(user.phone)}</span>
              </div>
              <Separator />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm text-muted-foreground">Zone de résidence</span>
                <span className="font-medium">{ZONE_LABELS[user.zone]}</span>
              </div>
            </CardContent>
          </Card>
        </section>

        <section aria-label={space.title} className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle>{space.title}</CardTitle>
              <CardDescription>{space.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-3">
                {space.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        <Button
          variant="outline"
          onClick={handleLogout}
          disabled={!user}
          className="h-11 w-full text-destructive hover:text-destructive sm:w-auto"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Se déconnecter
        </Button>
      </div>
    </div>
  );
}
