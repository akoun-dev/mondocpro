"use client";

// Vue Mot de passe oublié — US-AUTH-5 étape 1 (contrat API_CONTRACTS.md)
// Saisie du numéro : le serveur répond toujours OK (anti-énumération) et
// déclenche l'envoi du code si le compte existe. Passe à la vue Reset.
import { useState, type FormEvent } from "react";
import { Loader2, MessageSquareText } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPasswordSchema, zodIssuesToFieldErrors } from "@/lib/auth-schemas";
import { useAuth } from "@/hooks/use-auth";

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

    const parsed = forgotPasswordSchema.safeParse({ phone: phone.trim() });
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
        <Label htmlFor="forgot-phone">Téléphone</Label>
        <Input
          id="forgot-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+225 07 01 02 03 04"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={submitting}
          className="h-11"
          aria-invalid={fieldErrors.phone ? true : undefined}
          aria-describedby={fieldErrors.phone ? "forgot-phone-error" : undefined}
        />
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
