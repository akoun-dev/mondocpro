"use client";

// Formulaire d'inscription multi-étapes — US-AUTH-1 (SPEC-AUTH)
// Parcours guidé en 3 étapes (Identité → Zone → Sécurité) avec animations
// framer-motion sobres (DESIGN_SYSTEM §4) et palette médicale ADR-002.
// Rôle supprimé : PATIENT par défaut (forcé hook + serveur — décision PO 2026-10).
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  MapPin,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ZONE_LABELS,
  registerStepIdentitySchema,
  registerStepSecuritySchema,
  registerStepZoneSchema,
  zodIssuesToFieldErrors,
} from "@/lib/auth-schemas";
import { useAuth, type RegisterPayload } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type ZoneValue = RegisterPayload["zone"];

const STEPS = [
  { title: "Identité", description: "Qui êtes-vous ?", icon: User },
  { title: "Zone", description: "Où résidez-vous ?", icon: MapPin },
  { title: "Sécurité", description: "Protégez votre compte", icon: ShieldCheck },
] as const;

const TOTAL_STEPS = STEPS.length;

// Champ → étape qui le porte : une erreur API renvoie l'utilisateur à la bonne étape.
const FIELD_STEP: Record<string, number> = {
  fullName: 1,
  phone: 1,
  zone: 2,
  password: 3,
  confirmPassword: 3,
};

// Variants de transition : glissement directionnel + fondu (sobre, 220 ms).
const stepVariants = {
  enter: (direction: 1 | -1) => ({ x: direction * 48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: 1 | -1) => ({ x: direction * -48, opacity: 0 }),
};

function formatPhoneLight(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  const digits = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
  if (!/^\d{8,15}$/.test(digits)) return phone;
  const prefix = cleaned.startsWith("+") ? "+" : "";
  return `${prefix}${digits.replace(/(\d{2})(?=\d)/g, "$1 ")}`;
}

export function RegisterForm() {
  const { register } = useAuth();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [zone, setZone] = useState<ZoneValue | "">("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasNavigatedRef = useRef(false);

  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  // Accessibilité : après chaque navigation, le focus arrive sur le titre d'étape.
  // Délai calé sur la fin de la transition (exit 220 ms avant le montage du contenu).
  useEffect(() => {
    if (!hasNavigatedRef.current) return;
    const timer = setTimeout(() => headingRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, [step]);

  function validateStep(current: number): Record<string, string> {
    if (current === 1) {
      const parsed = registerStepIdentitySchema.safeParse({
        fullName: fullName.trim(),
        phone: phone.trim(),
      });
      return parsed.success ? {} : zodIssuesToFieldErrors(parsed.error);
    }
    if (current === 2) {
      const parsed = registerStepZoneSchema.safeParse({ zone });
      return parsed.success ? {} : zodIssuesToFieldErrors(parsed.error);
    }
    const parsed = registerStepSecuritySchema.safeParse({ password, confirmPassword });
    return parsed.success ? {} : zodIssuesToFieldErrors(parsed.error);
  }

  function goToStep(target: number) {
    setDirection(target > step ? 1 : -1);
    setStep(target);
  }

  function goNext() {
    const errors = validateStep(step);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError(null);
      return;
    }
    hasNavigatedRef.current = true;
    setFieldErrors({});
    setFormError(null);
    goToStep(step + 1);
  }

  function goBack() {
    hasNavigatedRef.current = true;
    setFieldErrors({});
    setFormError(null);
    goToStep(step - 1);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    // Les étapes 1 et 2 avancent (la touche Entrée déclenche le submit natif).
    if (step < TOTAL_STEPS) {
      goNext();
      return;
    }

    const errors = validateStep(TOTAL_STEPS);
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
      zone: zone as ZoneValue,
    });

    if (result.ok) {
      toast({
        title: "Compte créé",
        description: "Bienvenue sur MondocPro !",
      });
    } else {
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
        // Une erreur serveur sur un champ ramène à l'étape concernée.
        const targetStep = Math.min(
          ...Object.keys(result.fieldErrors)
            .map((field) => FIELD_STEP[field])
            .filter((s): s is number => typeof s === "number"),
        );
        if (Number.isFinite(targetStep) && targetStep !== step) {
          hasNavigatedRef.current = true;
          goToStep(targetStep);
        }
      }
      if (!result.fieldErrors || Object.keys(result.fieldErrors).length === 0) {
        setFormError(result.error);
      }
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {/* Fil d'étapes — bleu médical (courant) / vert santé (terminé), ADR-002 */}
      <ol className="flex w-full items-center gap-2" aria-label="Étapes de l'inscription">
        {STEPS.map((stepDef, index) => {
          const stepNumber = index + 1;
          const isDone = stepNumber < step;
          const isCurrent = stepNumber === step;
          const StepIcon = stepDef.icon;
          return (
            <li
              key={stepDef.title}
              className="flex flex-1 items-center gap-2 last:flex-none"
              aria-current={isCurrent ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-300",
                  isDone && "border-success bg-success text-success-foreground",
                  isCurrent && "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15",
                  !isDone && !isCurrent && "border-input bg-muted text-muted-foreground",
                )}
                aria-hidden="true"
              >
                {isDone ? (
                  <Check className="size-4" strokeWidth={3} />
                ) : (
                  <StepIcon className="size-4" />
                )}
              </span>
              <span
                className={cn(
                  "hidden shrink-0 text-sm font-medium sm:inline",
                  isCurrent ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {stepDef.title}
              </span>
              {index < TOTAL_STEPS - 1 && (
                <span
                  className="relative h-0.5 flex-1 overflow-hidden rounded-full bg-border"
                  aria-hidden="true"
                >
                  <motion.span
                    className="absolute inset-0 origin-left rounded-full bg-success"
                    initial={false}
                    animate={{ scaleX: isDone ? 1 : 0 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                  />
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {formError && !hasFieldErrors && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.div
          key={step}
          custom={direction}
          variants={stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="flex flex-col gap-4"
        >
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="text-lg font-semibold text-primary-dark focus:outline-none"
          >
            Étape {step} sur {TOTAL_STEPS} — {STEPS[step - 1].title}
          </h3>
          <p className="-mt-3 text-sm text-muted-foreground">{STEPS[step - 1].description}</p>

          {step === 1 && (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="register-fullname">Nom complet</Label>
                <Input
                  id="register-fullname"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  placeholder="Ex. Aya Konaté"
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
            </>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-2">
              <Label id="register-zone-label">Zone de résidence</Label>
              <RadioGroup
                value={zone}
                onValueChange={(value) => setZone(value as ZoneValue)}
                disabled={submitting}
                className="grid grid-cols-2 gap-3"
                aria-labelledby="register-zone-label"
              >
                {(Object.keys(ZONE_LABELS) as ZoneValue[]).map((z) => (
                  <motion.label
                    key={z}
                    htmlFor={`register-zone-${z.toLowerCase()}`}
                    whileTap={{ scale: 0.97 }}
                    className={cn(
                      "flex min-h-16 cursor-pointer flex-col items-start gap-2 rounded-lg border p-3 transition-colors",
                      zone === z
                        ? "border-primary bg-accent"
                        : "border-input hover:bg-muted/60",
                      "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                    )}
                  >
                    <RadioGroupItem
                      value={z}
                      id={`register-zone-${z.toLowerCase()}`}
                      className="sr-only"
                    />
                    <MapPin
                      className={cn(
                        "size-5",
                        zone === z ? "text-primary" : "text-muted-foreground",
                      )}
                      aria-hidden="true"
                    />
                    <span className="text-sm font-medium">{ZONE_LABELS[z]}</span>
                  </motion.label>
                ))}
              </RadioGroup>
              {fieldErrors.zone && (
                <p id="register-zone-error" className="text-sm text-destructive" role="alert">
                  {fieldErrors.zone}
                </p>
              )}
            </div>
          )}

          {step === 3 && (
            <>
              <div className="flex flex-col gap-2 rounded-lg bg-muted p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Récapitulatif
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <User className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="font-medium">{fullName.trim() || "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="font-medium">{formatPhoneLight(phone) || "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="font-medium">{zone ? ZONE_LABELS[zone] : "—"}</span>
                </div>
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
                    maxLength={72}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    className="h-11 pr-11"
                    aria-invalid={fieldErrors.password ? true : undefined}
                    aria-describedby={
                      fieldErrors.password ? "register-password-error" : undefined
                    }
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
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={submitting}
                    className="h-11 pr-11"
                    aria-invalid={fieldErrors.confirmPassword ? true : undefined}
                    aria-describedby={
                      fieldErrors.confirmPassword ? "register-confirm-error" : undefined
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={
                      showConfirm ? "Masquer la confirmation" : "Afficher la confirmation"
                    }
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
                  <p id="register-confirm-error" className="text-sm text-destructive">
                    {fieldErrors.confirmPassword}
                  </p>
                )}
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Actions : primaire à droite sur desktop, pleine largeur empilée sur mobile */}
      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        {step < TOTAL_STEPS ? (
          <Button type="submit" className="h-11 flex-1">
            Continuer
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button type="submit" className="h-11 flex-1" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Création du compte…
              </>
            ) : (
              <>
                Créer mon compte
                <Check className="size-4" aria-hidden="true" />
              </>
            )}
          </Button>
        )}
        {step > 1 && (
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={submitting}
            className="h-11 sm:w-32"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Retour
          </Button>
        )}
      </div>

      {step === TOTAL_STEPS && (
        <p className="text-center text-xs text-muted-foreground">
          Les comptes Médecin Chef et Infirmier sont créés par l&apos;administration.
        </p>
      )}
    </form>
  );
}
