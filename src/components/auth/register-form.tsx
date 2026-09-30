"use client";

// Formulaire d'inscription — US-AUTH-1 (SPEC-AUTH)
// Rôles Patient / Infirmier uniquement — ADMIN jamais proposé (ADR-004 §5).
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2, Stethoscope, User } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ZONE_LABELS } from "@/lib/auth-schemas";
import { useAuth, type RegisterPayload } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type RegisterRole = RegisterPayload["role"];

const ROLE_OPTIONS: Array<{
  value: RegisterRole;
  label: string;
  description: string;
}> = [
  { value: "PATIENT", label: "Patient", description: "Je prends rendez-vous" },
  { value: "INFIRMIER", label: "Infirmier", description: "J'effectue les missions" },
];

export function RegisterForm() {
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [zone, setZone] = useState<RegisterPayload["zone"] | "">("");
  const [role, setRole] = useState<RegisterRole | "">("");
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

    // Contrôles locaux pour les champs non natifs (Select + cards radio).
    const errors: Record<string, string> = {};
    if (!zone) errors.zone = "Veuillez choisir votre zone";
    if (!role) errors.role = "Veuillez choisir votre rôle";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError(null);
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);

    const result = await register({
      fullName: fullName.trim(),
      phone: phone.trim(),
      password,
      confirmPassword,
      role: role as RegisterRole,
      zone: zone as RegisterPayload["zone"],
    });

    if (result.ok) {
      toast({
        title: "Compte créé",
        description: "Bienvenue sur MondocPro !",
      });
    } else {
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      if (!result.fieldErrors || Object.keys(result.fieldErrors).length === 0) {
        setFormError(result.error);
      }
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {formError && !hasFieldErrors && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="register-fullname">Nom complet</Label>
        <Input
          id="register-fullname"
          name="fullName"
          type="text"
          autoComplete="name"
          placeholder="Ex. Aya Konaté"
          required
          minLength={2}
          maxLength={80}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={submitting}
          className="h-11"
          aria-invalid={fieldErrors.fullName ? true : undefined}
          aria-describedby={fieldErrors.fullName ? "register-fullname-error" : undefined}
        />
        {fieldErrors.fullName && (
          <p id="register-fullname-error" className="text-sm text-destructive">
            {fieldErrors.fullName}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="register-phone">Téléphone</Label>
        <Input
          id="register-phone"
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
          aria-describedby={fieldErrors.phone ? "register-phone-error" : undefined}
        />
        {fieldErrors.phone && (
          <p id="register-phone-error" className="text-sm text-destructive">
            {fieldErrors.phone}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="register-zone">Zone de résidence</Label>
        <Select
          value={zone}
          onValueChange={(value) => setZone(value as RegisterPayload["zone"])}
          disabled={submitting}
        >
          <SelectTrigger
            id="register-zone"
            className="h-11 w-full"
            aria-invalid={fieldErrors.zone ? true : undefined}
            aria-describedby={fieldErrors.zone ? "register-zone-error" : undefined}
          >
            <SelectValue placeholder="Choisir votre zone" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ZONE_LABELS) as Array<keyof typeof ZONE_LABELS>).map((z) => (
              <SelectItem key={z} value={z}>
                {ZONE_LABELS[z]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fieldErrors.zone && (
          <p id="register-zone-error" className="text-sm text-destructive">
            {fieldErrors.zone}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="register-role-patient">Rôle du compte</Label>
        <RadioGroup
          value={role}
          onValueChange={(value) => setRole(value as RegisterRole)}
          disabled={submitting}
          className="grid gap-3 sm:grid-cols-2"
          aria-label="Rôle du compte"
        >
          {ROLE_OPTIONS.map((option) => (
            <label
              key={option.value}
              htmlFor={`register-role-${option.value.toLowerCase()}`}
              className={cn(
                "flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                role === option.value
                  ? "border-primary bg-accent"
                  : "border-input hover:bg-muted/60",
                "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
              )}
            >
              <RadioGroupItem
                value={option.value}
                id={`register-role-${option.value.toLowerCase()}`}
                className="mt-0.5"
              />
              <span className="flex flex-col gap-0.5">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {option.value === "PATIENT" ? (
                    <User className="size-4 text-primary" aria-hidden="true" />
                  ) : (
                    <Stethoscope className="size-4 text-primary" aria-hidden="true" />
                  )}
                  {option.label}
                </span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
        {fieldErrors.role && (
          <p className="text-sm text-destructive" role="alert">
            {fieldErrors.role}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="register-password">Mot de passe</Label>
        <div className="relative">
          <Input
            id="register-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="8 caractères minimum"
            required
            minLength={8}
            maxLength={72}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            className="h-11 pr-11"
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={fieldErrors.password ? "register-password-error" : undefined}
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
          <p id="register-password-error" className="text-sm text-destructive">
            {fieldErrors.password}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="register-confirm">Confirmer le mot de passe</Label>
        <div className="relative">
          <Input
            id="register-confirm"
            name="confirmPassword"
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Ressaisissez votre mot de passe"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={submitting}
            className="h-11 pr-11"
            aria-invalid={fieldErrors.confirmPassword ? true : undefined}
            aria-describedby={fieldErrors.confirmPassword ? "register-confirm-error" : undefined}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? "Masquer la confirmation" : "Afficher la confirmation"}
            aria-pressed={showConfirm}
            disabled={submitting}
            className="absolute inset-y-0 right-0 flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {showConfirm ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
          </button>
        </div>
        {fieldErrors.confirmPassword && (
          <p id="register-confirm-error" className="text-sm text-destructive">
            {fieldErrors.confirmPassword}
          </p>
        )}
      </div>

      <Button type="submit" className="h-11 w-full" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Création du compte…
          </>
        ) : (
          "Créer mon compte"
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Les comptes Médecin Chef sont créés par l&apos;administration.
      </p>
    </form>
  );
}
