"use client";

// Vue Connexion dédiée — US-AUTH-2 (SPEC-AUTH)
// Liens vers les vues Inscription et Mot de passe oublié (auth-flow).
// Erreur 401 générique affichée en Alert destructive (anti-énumération).
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";

export function LoginForm({
  onForgotPassword,
  onSwitchToRegister,
}: {
  onForgotPassword?: () => void;
  onSwitchToRegister?: () => void;
}) {
  const { login } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);

    const result = await login(phone.trim(), password);

    if (result.ok) {
      toast({
        title: "Connexion réussie",
        description: "Bienvenue sur MondocPro !",
      });
    } else {
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      // Alert générique seulement si aucune erreur de champ inline
      // (401, 409, réseau… n'ont pas de fieldErrors).
      if (!result.fieldErrors || Object.keys(result.fieldErrors).length === 0) {
        setFormError(result.error);
      }
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate={false}>
      {formError && !hasFieldErrors && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="login-phone">Téléphone</Label>
        <Input
          id="login-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+225 07 01 02 03 04"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={submitting}
          className="h-11"
          aria-invalid={fieldErrors.phone ? true : undefined}
          aria-describedby={fieldErrors.phone ? "login-phone-error" : undefined}
        />
        {fieldErrors.phone && (
          <p id="login-phone-error" className="text-sm text-destructive">
            {fieldErrors.phone}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="login-password">Mot de passe</Label>
        <div className="relative">
          <Input
            id="login-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Votre mot de passe"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            className="h-11 pr-11"
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            aria-pressed={showPassword}
            disabled={submitting}
            className="absolute inset-y-0 right-0 flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
          </button>
        </div>
        {fieldErrors.password && (
          <p id="login-password-error" className="text-sm text-destructive">
            {fieldErrors.password}
          </p>
        )}
      </div>

      <Button type="submit" className="h-11 w-full" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Connexion en cours…
          </>
        ) : (
          "Se connecter"
        )}
      </Button>

      {onForgotPassword && (
        <button
          type="button"
          onClick={onForgotPassword}
          disabled={submitting}
          className="mx-auto flex min-h-11 items-center text-sm font-medium text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          Mot de passe oublié ?
        </button>
      )}

      {onSwitchToRegister && (
        <p className="border-t pt-4 text-center text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <button
            type="button"
            onClick={onSwitchToRegister}
            disabled={submitting}
            className="font-medium text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            Créer un compte
          </button>
        </p>
      )}
    </form>
  );
}
