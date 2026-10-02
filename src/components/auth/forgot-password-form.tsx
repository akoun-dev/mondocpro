"use client";

// Vue Mot de passe oublié — US-AUTH-5 étape 1 (contrat API_CONTRACTS.md)
// Saisie du numéro : le serveur répond toujours OK (anti-énumération) et
// déclenche l'envoi du code si le compte existe. Passe à la vue Reset.
// Indicatif +225 fixe (drapeau CI) comme sur la Connexion : l'utilisateur
// saisit le numéro local, normalisé vers l'international avant envoi.
import { useState, type FormEvent } from "react";
import { Loader2, MessageSquareText } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FlagCI } from "@/components/auth/ci-flag";
import { toInternationalPhone } from "@/lib/phone";
import { forgotPasswordSchema, zodIssuesToFieldErrors } from "@/lib/auth-schemas";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export function ForgotPasswordForm({ onCodeSent }: { onCodeSent: (phone: string) => void }) {
  const { forgotPassword } = useAuth();
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const parsed = forgotPasswordSchema.safeParse({
      phone: toInternationalPhone(phone),
    });
    if (!parsed.success) {
      setFieldErrors(zodIssuesToFieldErrors(parsed.error));
      setFormError(null);
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);

    // Réponse anti-énumération : on navigue vers la vue Reset dans tous les cas —
    // l'utilisateur ne peut pas deviner si le numéro est inscrit.
    const result = await forgotPassword(parsed.data.phone);

    if (result.ok) {
      onCodeSent(parsed.data.phone);
    } else {
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      if (!result.fieldErrors || Object.keys(result.fieldErrors).length === 0) {
        setFormError(result.error);
      }
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {formError && !hasFieldErrors && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
        <MessageSquareText className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <p>
          Saisissez votre numéro de téléphone : un code à 6 chiffres vous sera
          envoyé pour créer un nouveau mot de passe.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label
          htmlFor="forgot-phone"
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Téléphone
        </Label>
        <div
          className={cn(
            "relative flex h-11 items-stretch overflow-hidden rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow]",
            "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
            fieldErrors.phone && "border-destructive focus-within:ring-destructive/30",
          )}
        >
          <span
            className="flex shrink-0 select-none items-center gap-1.5 border-r border-input bg-muted/50 px-3"
            aria-hidden="true"
          >
            <FlagCI />
            <span className="text-sm font-semibold text-foreground">+225</span>
          </span>
          <Input
            id="forgot-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="07 01 02 03 04"
            required
            maxLength={14}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ""))}
            disabled={submitting}
            className="h-full flex-1 rounded-none border-0 pl-3 shadow-none focus-visible:ring-0"
            aria-invalid={fieldErrors.phone ? true : undefined}
            aria-describedby={fieldErrors.phone ? "forgot-phone-error" : undefined}
          />
        </div>
        {fieldErrors.phone && (
          <p id="forgot-phone-error" className="text-sm text-destructive">
            {fieldErrors.phone}
          </p>
        )}
      </div>

      <Button type="submit" className="h-11 w-full" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Envoi du code…
          </>
        ) : (
          "Recevoir le code"
        )}
      </Button>
    </form>
  );
}
