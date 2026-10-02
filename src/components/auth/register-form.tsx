"use client"

// Formulaire d'inscription multi-étapes — US-AUTH-1 (SPEC-AUTH)
// Parcours guidé en 3 étapes (Identité → Zone → Sécurité) avec animations
// framer-motion sobres (DESIGN_SYSTEM §4) et palette médicale ADR-002.
// Rôle supprimé : PATIENT par défaut (forcé hook + serveur — décision PO 2026-10).
import { useEffect, useRef, useState, type FormEvent, type Ref } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
    ArrowLeft,
    ArrowRight,
    Check,
    ChevronLeft,
    Eye,
    EyeOff,
    Loader2,
    Lock,
    MapPin,
    Pencil,
    Phone,
    Search,
    ShieldCheck,
    ShieldPlus,
    User,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { CguDialog } from "@/components/auth/cgu-dialog"
import { FlagCI } from "@/components/auth/ci-flag"
import {
    ZONE_LABELS,
    registerStepIdentitySchema,
    registerStepSecuritySchema,
    registerStepZoneSchema,
    zodIssuesToFieldErrors,
} from "@/lib/auth-schemas"
import { useAuth, type RegisterPayload } from "@/hooks/use-auth"
import { toast } from "@/hooks/use-toast"
import { formatPhoneDisplay, toInternationalPhone } from "@/lib/phone"
import { cn } from "@/lib/utils"

type ZoneValue = RegisterPayload["zone"]

const STEPS = [
    {
        title: "Identité",
        description: "Renseignez vos coordonnées de contact",
        icon: User,
    },
    {
        title: "Zone",
        description: "Sélectionnez votre zone de résidence",
        icon: MapPin,
    },
    {
        title: "Sécurité",
        description: "Protégez votre compte et vos données médicales",
        icon: ShieldCheck,
    },
] as const

// Quartiers indicatifs par zone (maquette étape 2) + mise en avant Yopougon.
const ZONE_META: Record<
    ZoneValue,
    { quartier: string; recommended?: boolean }
> = {
    YOPOUGON: { quartier: "Abidjan Ouest", recommended: true },
    SONGON: { quartier: "Route Dabou" },
    PK22: { quartier: "Zone industrielle" },
    NDOTRE: { quartier: "Abobo Nord" },
}

const TOTAL_STEPS = STEPS.length

// Champ → étape qui le porte : une erreur API renvoie l'utilisateur à la bonne étape.
const FIELD_STEP: Record<string, number> = {
    fullName: 1,
    phone: 1,
    zone: 2,
    password: 3,
    confirmPassword: 3,
}

// Variants de transition : glissement directionnel + fondu (sobre, 220 ms).
const stepVariants = {
    enter: (direction: 1 | -1) => ({ x: direction * 48, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction: 1 | -1) => ({ x: direction * -48, opacity: 0 }),
}

// Comparaison insensible à la casse et aux accents pour la recherche de zone.
function normalizeText(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
}

export function RegisterForm({
    onBack,
    headingRef,
}: {
    onBack: () => void
    headingRef?: Ref<HTMLHeadingElement>
}) {
    const { register } = useAuth()
    const [step, setStep] = useState(1)
    const [direction, setDirection] = useState<1 | -1>(1)
    const [fullName, setFullName] = useState("")
    const [phone, setPhone] = useState("")
    const [zone, setZone] = useState<ZoneValue | "">("")
    const [zoneQuery, setZoneQuery] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [consent, setConsent] = useState(false)
    const [cguOpen, setCguOpen] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    const [formError, setFormError] = useState<string | null>(null)

    const hasNavigatedRef = useRef(false)

    const hasFieldErrors = Object.keys(fieldErrors).length > 0

    // Recherche de zone : filtre insensible à la casse/accents sur libellé, quartier et clé.
    const zoneQueryNormalized = normalizeText(zoneQuery.trim())
    const visibleZones = (Object.keys(ZONE_LABELS) as ZoneValue[]).filter(z => {
        if (!zoneQueryNormalized) return true
        const haystack = normalizeText(
            `${ZONE_LABELS[z]} ${ZONE_META[z].quartier} ${z}`
        )
        return haystack.includes(zoneQueryNormalized)
    })

    // Robustesse du mot de passe (jauge étape 3) : longueur ≥ 8, chiffre,
    // majuscule ou caractère spécial.
    const pwScore = [
        password.length >= 8,
        /\d/.test(password),
        /[A-Z]/.test(password) || /[^A-Za-z0-9]/.test(password),
    ].filter(Boolean).length
    const pwColor =
        pwScore <= 1
            ? "bg-destructive"
            : pwScore === 2
              ? "bg-warning"
              : "bg-success"

    // Accessibilité : après chaque navigation, le focus arrive sur le titre d'étape.
    // Délai calé sur la fin de la transition (exit 220 ms avant le montage du contenu).
    useEffect(() => {
        if (!hasNavigatedRef.current) return
        const timer = setTimeout(() => headingRef.current?.focus(), 300)
        return () => clearTimeout(timer)
    }, [step])

    function validateStep(current: number): Record<string, string> {
        if (current === 1) {
            const parsed = registerStepIdentitySchema.safeParse({
                fullName: fullName.trim(),
                phone: toInternationalPhone(phone),
            })
            return parsed.success ? {} : zodIssuesToFieldErrors(parsed.error)
        }
        if (current === 2) {
            const parsed = registerStepZoneSchema.safeParse({ zone })
            return parsed.success ? {} : zodIssuesToFieldErrors(parsed.error)
        }
        const parsed = registerStepSecuritySchema.safeParse({
            password,
            confirmPassword,
        })
        const errors = parsed.success
            ? {}
            : zodIssuesToFieldErrors(parsed.error)
        if (!consent) {
            errors.consent =
                "Veuillez accepter les Conditions Générales pour créer votre compte."
        }
        return errors
    }

    function goToStep(target: number) {
        setDirection(target > step ? 1 : -1)
        setStep(target)
    }

    function goNext() {
        const errors = validateStep(step)
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors)
            setFormError(null)
            return
        }
        hasNavigatedRef.current = true
        setFieldErrors({})
        setFormError(null)
        goToStep(step + 1)
    }

    function goBack() {
        hasNavigatedRef.current = true
        setFieldErrors({})
        setFormError(null)
        goToStep(step - 1)
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (submitting) return

        // Les étapes 1 et 2 avancent (la touche Entrée déclenche le submit natif).
        if (step < TOTAL_STEPS) {
            goNext()
            return
        }

        const errors = validateStep(TOTAL_STEPS)
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors)
            setFormError(null)
            return
        }

        setSubmitting(true)
        setFieldErrors({})
        setFormError(null)

        const result = await register({
            fullName: fullName.trim(),
            phone: toInternationalPhone(phone),
            password,
            confirmPassword,
            zone: zone as ZoneValue,
        })

        if (result.ok) {
            toast({
                title: "Compte créé",
                description: "Bienvenue sur Mon doc Pro !",
            })
        } else {
            if (result.fieldErrors) {
                setFieldErrors(result.fieldErrors)
                // Une erreur serveur sur un champ ramène à l'étape concernée.
                const targetStep = Math.min(
                    ...Object.keys(result.fieldErrors)
                        .map(field => FIELD_STEP[field])
                        .filter((s): s is number => typeof s === "number")
                )
                if (Number.isFinite(targetStep) && targetStep !== step) {
                    hasNavigatedRef.current = true
                    goToStep(targetStep)
                }
            }
            if (
                !result.fieldErrors ||
                Object.keys(result.fieldErrors).length === 0
            ) {
                setFormError(result.error)
            }
        }
        setSubmitting(false)
    }

    return (
        <form
            onSubmit={handleSubmit}
            noValidate
            className="flex flex-col gap-5"
        >
            {/* En-tête : Retour + badge contextuel (Accès Patient → Étape finale, maquettes PO) */}
            <div className="flex flex-col gap-1">
                <div className="mb-2 flex items-center justify-between gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onBack}
                        className="-ml-2 h-9 gap-1 text-muted-foreground hover:text-foreground"
                    >
                        <ChevronLeft className="size-4" aria-hidden="true" />
                        Retour
                    </Button>
                    {step < TOTAL_STEPS ? (
                        <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success ring-1 ring-inset ring-success/25">
                            <span
                                className="size-1.5 rounded-full bg-success"
                                aria-hidden="true"
                            />
                            Accès Patient
                        </span>
                    ) : (
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/25">
                            Étape finale
                        </span>
                    )}
                </div>
                <h2
                    ref={headingRef}
                    tabIndex={-1}
                    className="text-2xl font-bold tracking-tight text-foreground focus:outline-none"
                >
                    Inscription
                </h2>
                <p className="text-sm text-muted-foreground">
                    Créez votre compte patient sécurisé en 3 étapes
                </p>
            </div>

            {/* Fil d'étapes — pastilles iconées avec libellés dessous, fil bleu médical
          (design demandé par le PO) ; bleu = atteint, gris = à venir (ADR-002) */}
            <ol
                className="flex w-full items-start"
                aria-label="Étapes de l'inscription"
            >
                {STEPS.map((stepDef, index) => {
                    const stepNumber = index + 1
                    const isDone = stepNumber < step
                    const isCurrent = stepNumber === step
                    const StepIcon = stepDef.icon
                    return (
                        <li
                            key={stepDef.title}
                            className={cn(
                                "flex items-start",
                                index < TOTAL_STEPS - 1 ? "flex-1" : "shrink-0"
                            )}
                            aria-current={isCurrent ? "step" : undefined}
                        >
                            <div className="flex w-9 shrink-0 flex-col items-center gap-1.5">
                                <span
                                    className={cn(
                                        "flex size-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-300",
                                        isDone &&
                                            "border-success bg-success text-success-foreground",
                                        isCurrent &&
                                            "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15",
                                        !isDone &&
                                            !isCurrent &&
                                            "border-input bg-card text-muted-foreground"
                                    )}
                                    aria-hidden="true"
                                >
                                    {isDone ? (
                                        <Check
                                            className="size-4"
                                            strokeWidth={3}
                                        />
                                    ) : (
                                        <StepIcon className="size-4" />
                                    )}
                                </span>
                                <span
                                    className={cn(
                                        "whitespace-nowrap text-xs font-medium",
                                        isCurrent &&
                                            "font-semibold text-primary",
                                        isDone && "text-foreground",
                                        !isDone &&
                                            !isCurrent &&
                                            "text-muted-foreground"
                                    )}
                                >
                                    {stepDef.title}
                                </span>
                            </div>
                            {index < TOTAL_STEPS - 1 && (
                                <span
                                    className="relative mx-1.5 mt-[17px] h-0.5 flex-1 overflow-hidden rounded-full bg-border"
                                    aria-hidden="true"
                                >
                                    <motion.span
                                        className={cn(
                                            "absolute inset-0 origin-left rounded-full",
                                            isDone ? "bg-success" : "bg-primary"
                                        )}
                                        initial={false}
                                        animate={{ scaleX: isDone ? 1 : 0 }}
                                        transition={{
                                            duration: 0.35,
                                            ease: "easeOut",
                                        }}
                                    />
                                </span>
                            )}
                        </li>
                    )
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
                    <div className="flex items-center justify-between gap-3">
                        <h3
                            ref={headingRef}
                            tabIndex={-1}
                            className="text-base font-semibold text-foreground focus:outline-none"
                        >
                            Étape {step} sur {TOTAL_STEPS} —{" "}
                            {STEPS[step - 1].title}
                        </h3>
                        <span
                            className="text-sm font-bold text-primary"
                            aria-hidden="true"
                        >
                            {Math.round((step / TOTAL_STEPS) * 100)}%
                        </span>
                    </div>
                    {step !== 2 && (
                        <p className="-mt-2.5 text-sm text-muted-foreground">
                            {STEPS[step - 1].description}
                        </p>
                    )}

                    {step === 1 && (
                        <>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="register-fullname">
                                    Nom complet
                                    <span
                                        className="text-destructive"
                                        aria-hidden="true"
                                    >
                                        {" "}
                                        *
                                    </span>
                                    <span className="sr-only">
                                        {" "}
                                        (obligatoire)
                                    </span>
                                </Label>
                                <div className="relative">
                                    <User
                                        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                                        aria-hidden="true"
                                    />
                                    <Input
                                        id="register-fullname"
                                        name="fullName"
                                        type="text"
                                        autoComplete="name"
                                        placeholder="Aya Konaté"
                                        maxLength={80}
                                        value={fullName}
                                        onChange={e =>
                                            setFullName(e.target.value)
                                        }
                                        disabled={submitting}
                                        className="h-11 pl-9"
                                        aria-invalid={
                                            fieldErrors.fullName
                                                ? true
                                                : undefined
                                        }
                                        aria-describedby={
                                            fieldErrors.fullName
                                                ? "register-fullname-error"
                                                : undefined
                                        }
                                    />
                                </div>
                                {fieldErrors.fullName && (
                                    <p
                                        id="register-fullname-error"
                                        className="text-sm text-destructive"
                                    >
                                        {fieldErrors.fullName}
                                    </p>
                                )}
                            </div>

                            <div className="flex flex-col gap-2">
                                <Label htmlFor="register-phone">
                                    Numéro de téléphone
                                    <span
                                        className="text-destructive"
                                        aria-hidden="true"
                                    >
                                        {" "}
                                        *
                                    </span>
                                    <span className="sr-only">
                                        {" "}
                                        (obligatoire)
                                    </span>
                                </Label>
                                <div
                                    className={cn(
                                        "flex h-11 items-stretch overflow-hidden rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow]",
                                        "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
                                        fieldErrors.phone &&
                                            "border-destructive focus-within:ring-destructive/30"
                                    )}
                                >
                                    <span
                                        className="flex shrink-0 select-none items-center gap-1.5 border-r border-input bg-muted/50 px-3"
                                        aria-hidden="true"
                                    >
                                        <FlagCI />
                                        <span className="text-sm font-semibold text-foreground">
                                            +225
                                        </span>
                                    </span>
                                    <Input
                                        id="register-phone"
                                        name="phone"
                                        type="tel"
                                        inputMode="tel"
                                        autoComplete="tel-national"
                                        placeholder="07 01 02 03 04"
                                        maxLength={14}
                                        value={phone}
                                        onChange={e =>
                                            setPhone(
                                                e.target.value.replace(
                                                    /[^\d\s]/g,
                                                    ""
                                                )
                                            )
                                        }
                                        disabled={submitting}
                                        className="h-full flex-1 rounded-none border-0 shadow-none focus-visible:ring-0"
                                        aria-invalid={
                                            fieldErrors.phone ? true : undefined
                                        }
                                        aria-describedby={
                                            fieldErrors.phone
                                                ? "register-phone-error"
                                                : "register-phone-hint"
                                        }
                                    />
                                </div>
                                {fieldErrors.phone ? (
                                    <p
                                        id="register-phone-error"
                                        className="text-sm text-destructive"
                                    >
                                        {fieldErrors.phone}
                                    </p>
                                ) : (
                                    <p
                                        id="register-phone-hint"
                                        className="text-xs text-muted-foreground"
                                    >
                                        Un code SMS de validation vous sera
                                        envoyé.
                                    </p>
                                )}
                            </div>
                        </>
                    )}

                    {step === 2 && (
                        <div className="flex flex-col gap-3">
                            {/* Section « Localisation sanitaire » (maquette étape 2) */}
                            <div className="flex flex-col gap-1">
                                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
                                    <ShieldPlus
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                    Localisation sanitaire
                                </p>
                                <h4
                                    id="register-zone-title"
                                    className="text-base font-semibold text-foreground"
                                >
                                    Où résidez-vous à Abidjan&nbsp;?
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                    Pour afficher les médecins de garde,
                                    cliniques et officines partenaires au plus
                                    près de chez vous.
                                </p>
                            </div>

                            {/* Recherche de zone (filtre local, insensible casse/accents) */}
                            <div className="relative">
                                <Search
                                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                                    aria-hidden="true"
                                />
                                <Input
                                    type="text"
                                    value={zoneQuery}
                                    onChange={e => setZoneQuery(e.target.value)}
                                    placeholder="Rechercher une zone, quartier, commune…"
                                    maxLength={60}
                                    disabled={submitting}
                                    className="h-10 pl-9 pr-10"
                                    aria-label="Rechercher une zone, un quartier ou une commune"
                                />
                                <span
                                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground"
                                    aria-hidden="true"
                                >
                                    CI
                                </span>
                            </div>

                            <RadioGroup
                                value={zone}
                                onValueChange={value =>
                                    setZone(value as ZoneValue)
                                }
                                disabled={submitting}
                                className="grid grid-cols-2 gap-3"
                                aria-labelledby="register-zone-title"
                            >
                                {visibleZones.map(z => {
                                    const selected = zone === z
                                    return (
                                        <motion.label
                                            key={z}
                                            htmlFor={`register-zone-${z.toLowerCase()}`}
                                            whileTap={{ scale: 0.97 }}
                                            className={cn(
                                                "relative flex cursor-pointer flex-col gap-2 rounded-xl border p-3 pb-3.5 transition-colors",
                                                selected
                                                    ? "border-primary bg-primary/5"
                                                    : "border-input bg-card hover:bg-muted/60",
                                                "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
                                            )}
                                        >
                                            <RadioGroupItem
                                                value={z}
                                                id={`register-zone-${z.toLowerCase()}`}
                                                className="sr-only"
                                            />
                                            <span
                                                className={cn(
                                                    "flex size-9 items-center justify-center rounded-full transition-colors",
                                                    selected
                                                        ? "bg-primary text-primary-foreground"
                                                        : "bg-muted text-muted-foreground"
                                                )}
                                                aria-hidden="true"
                                            >
                                                <MapPin className="size-4" />
                                            </span>
                                            <span
                                                className={cn(
                                                    "absolute right-3 top-3 flex size-5 items-center justify-center rounded-full border-2 transition-colors",
                                                    selected
                                                        ? "border-primary bg-primary text-primary-foreground"
                                                        : "border-input bg-transparent"
                                                )}
                                                aria-hidden="true"
                                            >
                                                {selected && (
                                                    <Check
                                                        className="size-3"
                                                        strokeWidth={3}
                                                    />
                                                )}
                                            </span>
                                            <span className="flex flex-col gap-0.5">
                                                <span className="text-sm font-semibold text-foreground">
                                                    {ZONE_LABELS[z]}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {ZONE_META[z].quartier}
                                                </span>
                                            </span>
                                            {ZONE_META[z].recommended && (
                                                <span className="self-start rounded-full bg-success px-2 py-0.5 text-[11px] font-semibold text-success-foreground">
                                                    Recommandé
                                                </span>
                                            )}
                                        </motion.label>
                                    )
                                })}
                            </RadioGroup>

                            {visibleZones.length === 0 && (
                                <p className="rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
                                    Aucune zone ne correspond à «{" "}
                                    {zoneQuery.trim()} ».
                                </p>
                            )}

                            {fieldErrors.zone && (
                                <p
                                    id="register-zone-error"
                                    className="text-sm text-destructive"
                                    role="alert"
                                >
                                    {fieldErrors.zone}
                                </p>
                            )}
                        </div>
                    )}

                    {step === 3 && (
                        <>
                            {/* Récapitulatif patient (maquette étape 3) */}
                            <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-bold uppercase tracking-wide text-primary">
                                        Récapitulatif patient
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            hasNavigatedRef.current = true
                                            goToStep(1)
                                        }}
                                        disabled={submitting}
                                        className="flex min-h-8 items-center gap-1 text-sm font-medium text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                                    >
                                        Modifier
                                        <Pencil
                                            className="size-3.5"
                                            aria-hidden="true"
                                        />
                                    </button>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <User
                                        className="size-4 shrink-0 text-primary"
                                        aria-hidden="true"
                                    />
                                    <span className="font-semibold uppercase">
                                        {fullName.trim() || "—"}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <Phone
                                        className="size-4 shrink-0 text-primary"
                                        aria-hidden="true"
                                    />
                                    <span className="font-medium">
                                        {phone.replace(/\D/g, "")
                                            ? formatPhoneDisplay(
                                                  toInternationalPhone(phone)
                                              )
                                            : "—"}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <MapPin
                                        className="size-4 shrink-0 text-primary"
                                        aria-hidden="true"
                                    />
                                    <span className="font-medium">
                                        {zone
                                            ? `${ZONE_LABELS[zone]}, Abidjan`
                                            : "—"}
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <Label htmlFor="register-password">
                                    Mot de passe
                                </Label>
                                <div className="relative">
                                    <Lock
                                        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                                        aria-hidden="true"
                                    />
                                    <Input
                                        id="register-password"
                                        name="password"
                                        type={
                                            showPassword ? "text" : "password"
                                        }
                                        autoComplete="new-password"
                                        placeholder="8 caractères minimum"
                                        maxLength={72}
                                        value={password}
                                        onChange={e =>
                                            setPassword(e.target.value)
                                        }
                                        disabled={submitting}
                                        className="h-11 pl-9 pr-11"
                                        aria-invalid={
                                            fieldErrors.password
                                                ? true
                                                : undefined
                                        }
                                        aria-describedby={
                                            fieldErrors.password
                                                ? "register-password-error"
                                                : undefined
                                        }
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(v => !v)}
                                        aria-label={
                                            showPassword
                                                ? "Masquer le mot de passe"
                                                : "Afficher le mot de passe"
                                        }
                                        aria-pressed={showPassword}
                                        disabled={submitting}
                                        className="absolute inset-y-0 right-0 flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                                    >
                                        {showPassword ? (
                                            <EyeOff
                                                className="size-4"
                                                aria-hidden="true"
                                            />
                                        ) : (
                                            <Eye
                                                className="size-4"
                                                aria-hidden="true"
                                            />
                                        )}
                                    </button>
                                </div>
                                {/* Jauge de robustesse : longueur ≥ 8, chiffre, majuscule/spéciale */}
                                <div
                                    className="flex items-center gap-3"
                                    aria-hidden="true"
                                >
                                    <div className="flex flex-1 gap-1.5">
                                        {[0, 1, 2].map(i => (
                                            <span
                                                key={i}
                                                className={cn(
                                                    "h-1.5 flex-1 rounded-full transition-colors duration-300",
                                                    i < pwScore
                                                        ? pwColor
                                                        : "bg-muted"
                                                )}
                                            />
                                        ))}
                                    </div>
                                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                                        8 car. min, 1 chiffre
                                    </span>
                                </div>
                                {fieldErrors.password && (
                                    <p
                                        id="register-password-error"
                                        className="text-sm text-destructive"
                                    >
                                        {fieldErrors.password}
                                    </p>
                                )}
                            </div>

                            <div className="flex flex-col gap-2">
                                <Label htmlFor="register-confirm">
                                    Confirmer le mot de passe
                                </Label>
                                <div className="relative">
                                    <ShieldCheck
                                        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                                        aria-hidden="true"
                                    />
                                    <Input
                                        id="register-confirm"
                                        name="confirmPassword"
                                        type={showConfirm ? "text" : "password"}
                                        autoComplete="new-password"
                                        placeholder="Ressaisissez votre mot de passe"
                                        value={confirmPassword}
                                        onChange={e =>
                                            setConfirmPassword(e.target.value)
                                        }
                                        disabled={submitting}
                                        className="h-11 pl-9 pr-11"
                                        aria-invalid={
                                            fieldErrors.confirmPassword
                                                ? true
                                                : undefined
                                        }
                                        aria-describedby={
                                            fieldErrors.confirmPassword
                                                ? "register-confirm-error"
                                                : undefined
                                        }
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirm(v => !v)}
                                        aria-label={
                                            showConfirm
                                                ? "Masquer la confirmation"
                                                : "Afficher la confirmation"
                                        }
                                        aria-pressed={showConfirm}
                                        disabled={submitting}
                                        className="absolute inset-y-0 right-0 flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                                    >
                                        {showConfirm ? (
                                            <EyeOff
                                                className="size-4"
                                                aria-hidden="true"
                                            />
                                        ) : (
                                            <Eye
                                                className="size-4"
                                                aria-hidden="true"
                                            />
                                        )}
                                    </button>
                                </div>
                                {fieldErrors.confirmPassword && (
                                    <p
                                        id="register-confirm-error"
                                        className="text-sm text-destructive"
                                    >
                                        {fieldErrors.confirmPassword}
                                    </p>
                                )}
                            </div>

                            {/* Consentement CGU + données de santé (requis — maquette étape 3) */}
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-start gap-2.5">
                                    <Checkbox
                                        id="register-consent"
                                        checked={consent}
                                        onCheckedChange={v => {
                                            setConsent(v === true)
                                            setFieldErrors(prev => {
                                                if (!prev.consent) return prev
                                                const next = { ...prev }
                                                delete next.consent
                                                return next
                                            })
                                        }}
                                        disabled={submitting}
                                        className="mt-0.5"
                                        aria-invalid={
                                            fieldErrors.consent
                                                ? true
                                                : undefined
                                        }
                                        aria-describedby={
                                            fieldErrors.consent
                                                ? "register-consent-error"
                                                : undefined
                                        }
                                    />
                                    <label
                                        htmlFor="register-consent"
                                        className="text-sm leading-snug text-muted-foreground"
                                    >
                                        J&apos;accepte les{" "}
                                        <button
                                            type="button"
                                            onClick={() => setCguOpen(true)}
                                            className="font-medium text-primary underline underline-offset-2 transition-colors hover:text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            Conditions Générales
                                        </button>{" "}
                                        et consens au traitement sécurisé de mes
                                        données de santé.
                                    </label>
                                </div>
                                {fieldErrors.consent && (
                                    <p
                                        id="register-consent-error"
                                        className="text-sm text-destructive"
                                    >
                                        {fieldErrors.consent}
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
                    <Button
                        type="submit"
                        className="h-11 flex-1"
                        disabled={submitting}
                    >
                        {submitting ? (
                            <>
                                <Loader2
                                    className="size-4 animate-spin"
                                    aria-hidden="true"
                                />
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
                    Les comptes Médecin Chef et Infirmier sont créés par
                    l&apos;administration.
                </p>
            )}

            {/* Conditions Générales — Dialog (préserve l'état du wizard) */}
            <CguDialog open={cguOpen} onOpenChange={setCguOpen} />
        </form>
    )
}
