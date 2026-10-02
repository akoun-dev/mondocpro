"use client";

// Vue Réinitialisation du mot de passe — US-AUTH-5 étape 2 (contrat API_CONTRACTS.md)
// Code à 6 chiffres + nouveau mot de passe. Erreur 400 générique (anti-énumération) ;
// après succès : toast + retour à la vue Connexion.
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordSchema, zodIssuesToFieldErrors } from "@/lib/auth-schemas";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { formatPhoneDisplay } from "@/lib/utils";

export function ResetPasswordForm({
  phone,
  onBack,
  onReset,
}: {
  phone: string;
  onBack: () => void;
  onReset: () => void;
}) {
  const { resetPassword } = useAuth();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const parsed = resetPasswordSchema.safeParse({
      phone,
      code: code.trim(),
      password,
      confirmPassword,
    });
    if (!parsed.success) {
      setFieldErrors(zodIssuesToFieldErrors(parsed.error));
      setFormError(null);
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);

    const result = await resetPassword(parsed.data);

    if (result.ok) {
      toast({
        title: "Mot de passe réinitialisé",
        description: "Connectez-vous avec votre nouveau mot de passe.",
      });
      onReset();
      return;
    }

    if (result.fieldErrors) setFieldErrors(result.fieldErrors);
    if (!result.fieldErrors || Object.keys(result.fieldErrors).length === 0) {
      setFormError(result.error);
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {formError && !hasFieldErrors && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <p>
          Un code à 6 chiffres a été envoyé au{" "}
          <span className="font-medium text-foreground">
            {formatPhoneDisplay(phone)}
          </span>{" "}
          — si ce numéro est inscrit. Il est valable 15 minutes.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="reset-code">Code reçu par SMS</Label>
        <Input
          id="reset-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="••••••"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, ""))}
          disabled={submitting}
          className="h-12 text-center text-lg font-semibold tracking-[0.5em]"
          aria-invalid={fieldErrors.code ? true : undefined}
          aria-describedby={fieldErrors.code ? "reset-code-error" : undefined}
        />
        {fieldErrors.code && (
          <p id="reset-code-error" className="text-sm text-destructive">
            {fieldErrors.code}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="reset-password">Nouveau mot de passe</Label>
        <div className="relative">
          <Input
            id="reset-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="8 caractères minimum"
            maxLength={72}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            className="h-11 pr-11"
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={fieldErrors.password ? "reset-password-error" : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            aria-pressed={showPassword}
            disabled={submitting}
            className="absolute inset-y-0 right-0 flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {fieldErrors.password && (
          <p id="reset-password-error" className="text-sm text-destructive">
            {fieldErrors.password}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="reset-confirm">Confirmer le nouveau mot de passe</Label>
        <div className="relative">
          <Input
            id="reset-confirm"
            name="confirmPassword"
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Ressaisissez votre mot de passe"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={submitting}
            className="h-11 pr-11"
            aria-invalid={fieldErrors.confirmPassword ? true : undefined}
            aria-describedby={fieldErrors.confirmPassword ? "reset-confirm-error" : undefined}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? "Masquer la confirmation" : "Afficher la confirmation"}
            aria-pressed={showConfirm}
            disabled={submitting}
            className="absolute inset-y-0 right-0 flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {showConfirm ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {fieldErrors.confirmPassword && (
          <p id="reset-confirm-error" className="text-sm text-destructive">
            {fieldErrors.confirmPassword}
          </p>
        )}
      </div>

      <Button type="submit" className="h-11 w-full" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Réinitialisation…
          </>
        ) : (
          "Réinitialiser le mot de passe"
        )}
      </Button>

      <button
        type="button"
        onClick={onBack}
        disabled={submitting}
        className="mx-auto flex min-h-11 items-center text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        Numéro incorrect ou code non reçu ? Modifier le numéro
      </button>
    </form>
  );
}
