"use client";

// Primitives présentationnelles du profil — partagées par la vue profil
// PATIENT (maquette PO 2026-10-03) et la vue profil NURSE (Task 34).
// Extraites de profile-view.tsx (Task 22/23) sans changement de rendu :
// même langage visuel, un seul endroit à faire évoluer (DESIGN_SYSTEM).
import type * as React from "react";
import { CircleCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";

export const SOON = {
  title: "Bientôt disponible",
};

export function soonToast(what: string) {
  toast({
    title: SOON.title,
    description: `${what} arrive dans une prochaine version de Mon doc Pro.`,
  });
}

// Ligne d'information : icône en pastille, libellé + valeur, action à droite.
export function InfoRow({
  icon: Icon,
  label,
  value,
  valueMuted,
  accessory,
  onClick,
  actionLabel,
}: {
  icon: typeof CircleCheck;
  label: string;
  value: React.ReactNode;
  valueMuted?: boolean;
  accessory: React.ReactNode;
  onClick?: () => void;
  actionLabel?: string;
}) {
  const inner = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-4.5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span
          className={`mt-0.5 flex items-center gap-1.5 truncate text-sm font-semibold ${valueMuted ? "font-medium text-muted-foreground" : ""}`}
        >
          {value}
        </span>
      </span>
      {accessory}
    </>
  );
  if (!onClick) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-4">
        {inner}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={actionLabel ?? label}
      className="flex w-full items-center gap-3 rounded-xl bg-muted/60 p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {inner}
    </button>
  );
}

// Ligne de préférence : interrupteur fonctionnel — la valeur vient du user
// (store auth) et le basculement est persisté via PATCH /api/auth/profile
// (maj optimiste côté vue appelante, revert + toast si l'appel échoue).
export function PreferenceRow({
  icon: Icon,
  title,
  description,
  switchLabel,
  checked,
  disabled,
  onCheckedChange,
}: {
  icon: typeof CircleCheck;
  title: string;
  description: string;
  switchLabel: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-4.5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
          {description}
        </span>
      </span>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-label={switchLabel}
      />
    </div>
  );
}

// Titre de section du profil (miroir du style patient : 15 px bold tracking).
export function ProfileSectionTitle({
  id,
  children,
  action,
}: {
  id: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <h3 id={id} className="text-[15px] font-bold tracking-tight">
        {children}
      </h3>
      {action}
    </div>
  );
}
