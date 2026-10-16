"use client";

// Dialogs d'édition du profil — partagés par les vues NURSE (Task 34) et
// ADMIN (Task 35). Extrait de nurse-profile-view.tsx sans changement de
// rendu : même langage visuel, une seule source pour le PATCH /api/auth/profile
// (Zod updateProfileSchema, erreurs serveur details[] → inline champ à champ,
// mise à jour du store auth via useAuthStore).
// Chaque dialog est autonome : brouillon réinitialisé depuis `user` à
// l'ouverture, sauvegarde PATCH, toasts, fermeture — la vue appelante ne
// gère que l'ouverture.
import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useAuthStore, type AppUser } from "@/stores/auth-store";
import {
  updateProfileSchema,
  zodIssuesToFieldErrors,
  ZONES,
  ZONE_LABELS,
} from "@/lib/auth-schemas";

async function patchProfile(
  body: Record<string, unknown>,
): Promise<{ ok: true; user: AppUser } | { ok: false; error?: string; details?: Array<{ field: string; message: string }> }> {
  try {
    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = (await res.json()) as { user: AppUser };
      return { ok: true, user: data.user };
    }
    const payload = (await res.json().catch(() => ({}))) as {
      error?: string;
      details?: Array<{ field: string; message: string }>;
    };
    return { ok: false, error: payload.error, details: payload.details };
  } catch {
    return {
      ok: false,
      error:
        "Impossible de contacter le serveur. Vérifiez votre connexion internet puis réessayez.",
    };
  }
}

function detailsToErrors(
  details: Array<{ field: string; message: string }> | undefined,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const detail of details ?? []) {
    if (detail?.field && detail?.message && !(detail.field in errors)) {
      errors[detail.field] = detail.message;
    }
  }
  return errors;
}

type DialogShellProps = {
  children: ReactNode;
  description: string;
  saving: boolean;
  onCancel: () => void;
  title: string;
};

function DialogShell({ children, description, saving, onCancel, title }: DialogShellProps) {
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      {children}
    </DialogContent>
  );
}

// Édition nom complet + date de naissance (« AAAA-MM-JJ », effaçable).
export function ProfileIdentityDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AppUser;
}) {
  const setUser = useAuthStore((s) => s.setUser);
  const [fullName, setFullName] = useState(user.fullName);
  const [birthDate, setBirthDate] = useState(user.birthDate?.slice(0, 10) ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Brouillon réinitialisé à chaque ouverture — pattern React « ajustement
  // de state pendant le rendu » (pas d'effet : zéro rendu en cascade, la
  // réinitialisation est atomique avec le changement de `open`).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setFullName(user.fullName);
      setBirthDate(user.birthDate?.slice(0, 10) ?? "");
      setFieldErrors({});
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = updateProfileSchema.safeParse({
      fullName: fullName.trim(),
      birthDate: birthDate === "" ? null : birthDate,
    });
    if (!parsed.success) {
      setFieldErrors(zodIssuesToFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    setSaving(true);
    const result = await patchProfile(parsed.data);
    setSaving(false);
    if (result.ok) {
      setUser(result.user);
      toast({
        title: "Profil mis à jour",
        description: "Vos informations ont bien été enregistrées.",
      });
      onOpenChange(false);
      return;
    }
    setFieldErrors(detailsToErrors(result.details));
    toast({
      variant: "destructive",
      title: "Modification impossible",
      description: result.error ?? "Veuillez corriger les champs signalés puis réessayez.",
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogShell
        title="Modifier mes informations"
        description="Ces informations complètent votre dossier Mon doc Pro."
        saving={saving}
        onCancel={() => onOpenChange(false)}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-fullName">Nom complet</Label>
            <Input
              id="profile-fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              aria-invalid={fieldErrors.fullName ? true : undefined}
              maxLength={80}
              required
            />
            {fieldErrors.fullName && (
              <p className="text-xs font-medium text-destructive" role="alert">
                {fieldErrors.fullName}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-birthDate">Date de naissance</Label>
            <Input
              id="profile-birthDate"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              aria-invalid={fieldErrors.birthDate ? true : undefined}
            />
            {fieldErrors.birthDate ? (
              <p className="text-xs font-medium text-destructive" role="alert">
                {fieldErrors.birthDate}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Laissez vide si vous préférez ne pas la renseigner.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogShell>
    </Dialog>
  );
}

// Édition du secteur (zone) — liste fermée identique à l'inscription.
// Copie personnalisable : le patient parle de « secteur d'habitation »,
// l'infirmier de « secteur d'intervention » (missions affectées).
export function ProfileZoneDialog({
  open,
  onOpenChange,
  user,
  description = "Sélectionnez votre secteur d'habitation dans la liste.",
  fieldLabel = "Secteur",
  successTitle = "Secteur mis à jour",
  successDescription = (zone) => `Votre secteur est désormais ${ZONE_LABELS[zone]}.`,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AppUser;
  description?: string;
  fieldLabel?: string;
  successTitle?: string;
  successDescription?: (zone: AppUser["zone"]) => string;
}) {
  const setUser = useAuthStore((s) => s.setUser);
  const [zoneDraft, setZoneDraft] = useState<AppUser["zone"]>(user.zone);
  const [error, setError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  // Même pattern que ProfileIdentityDialog : réinitialisation au changement
  // de `open`, pendant le rendu.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setZoneDraft(user.zone);
      setError(undefined);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = updateProfileSchema.safeParse({ zone: zoneDraft });
    if (!parsed.success) {
      setError(zodIssuesToFieldErrors(parsed.error).zone ?? "Zone invalide");
      return;
    }
    setError(undefined);
    setSaving(true);
    const result = await patchProfile(parsed.data);
    setSaving(false);
    if (result.ok) {
      setUser(result.user);
      toast({
        title: successTitle,
        description: successDescription(result.user.zone),
      });
      onOpenChange(false);
      return;
    }
    setError(result.error ?? "Veuillez réessayer.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogShell
        title="Modifier mon secteur"
        description={description}
        saving={saving}
        onCancel={() => onOpenChange(false)}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-zone">{fieldLabel}</Label>
            <Select value={zoneDraft} onValueChange={(v) => setZoneDraft(v as AppUser["zone"])}>
              <SelectTrigger id="profile-zone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ZONES.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {ZONE_LABELS[zone]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error ? (
              <p className="text-xs font-medium text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogShell>
    </Dialog>
  );
}
