"use client";

// Dialog de changement de mot de passe — FEATURE-NURSE-PROFIL (Task 34).
// Réutilisable pour tout rôle (le contrat POST /api/auth/change-password est
// agnostique) : preuve de possession par le mot de passe ACTUEL, règles de
// robustesse identiques à l'inscription (Zod partagé, source unique), retour
// champ à champ des erreurs serveur (details[]).
// À la différence du flux « mot de passe oublié » (code SMS — US-AUTH-5, en
// attente ADR-006), l'utilisateur est connecté : aucun canal externe requis.
import { useState } from "react";
import { Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
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
import { toast } from "@/hooks/use-toast";
import { changePasswordSchema, zodIssuesToFieldErrors } from "@/lib/auth-schemas";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Appelé après un changement réussi (ex. proposer de se déconnecter).
  onSuccess?: () => void;
};

// Champ mot de passe avec bascule afficher/masquer (accessibilité : bouton
// explicite, aria-label dynamique, autocomplete adapté).
function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  error,
  hint,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  error?: string;
  hint?: string;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          className="pr-10"
          maxLength={72}
          required={required}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Masquer ${label.toLowerCase()}` : `Afficher ${label.toLowerCase()}`}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {error ? (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {hint && !error ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function PasswordChangeDialog({ open, onOpenChange, onSuccess }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setCurrentPassword("");
    setPassword("");
    setConfirmPassword("");
    setFieldErrors({});
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      // Annulation : aucune trace du brouillon (mots de passe effacés).
      resetForm();
    }
    onOpenChange(next);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    // Même schéma Zod que le serveur (source unique des règles).
    const parsed = changePasswordSchema.safeParse({
      currentPassword,
      password,
      confirmPassword,
    });
    if (!parsed.success) {
      setFieldErrors(zodIssuesToFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (res.ok) {
        resetForm();
        onOpenChange(false);
        toast({
          title: "Mot de passe modifié",
          description:
            "Votre nouveau mot de passe est actif. Vos autres sessions ont été déconnectées.",
        });
        onSuccess?.();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        details?: Array<{ field: string; message: string }>;
      };
      const errors: Record<string, string> = {};
      for (const detail of body.details ?? []) {
        if (detail?.field && detail?.message && !(detail.field in errors)) {
          errors[detail.field] = detail.message;
        }
      }
      setFieldErrors(errors);
      toast({
        variant: "destructive",
        title: "Modification impossible",
        description:
          body.error ?? "Veuillez corriger les champs signalés puis réessayez.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Modification impossible",
        description:
          "Impossible de contacter le serveur. Vérifiez votre connexion internet puis réessayez.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LockKeyhole
              className="size-4.5 text-primary"
              aria-hidden="true"
            />
            Modifier mon mot de passe
          </DialogTitle>
          <DialogDescription>
            Pour votre sécurité, confirmez votre mot de passe actuel puis
            choisissez-en un nouveau. Vos autres sessions seront déconnectées.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-4"
        >
          <PasswordField
            id="password-current"
            label="Mot de passe actuel"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
            error={fieldErrors.currentPassword}
            required
          />
          <PasswordField
            id="password-new"
            label="Nouveau mot de passe"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            error={fieldErrors.password}
            hint="8 caractères minimum."
            required
          />
          <PasswordField
            id="password-confirm"
            label="Confirmer le nouveau mot de passe"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            error={fieldErrors.confirmPassword}
            required
          />
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Modification…
                </>
              ) : (
                "Modifier le mot de passe"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
