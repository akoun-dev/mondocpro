"use client"

// Vue Connexion dédiée — US-AUTH-2 (SPEC-AUTH)
// Design maquette PO 2026-10 : indicatif +225 fixe, libellés capitales,
// icônes en champ, lien « Mot de passe oublié ? » sur la ligne du libellé,
// case « Se souvenir de moi » (30 jours vs session navigateur).
// Erreur 401 générique affichée en Alert destructive (anti-énumération).
import { useState, type FormEvent } from "react"
import { ArrowRight, Eye, EyeOff, Grid3x3, Loader2, Lock } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FlagCI } from "@/components/auth/ci-flag"
import { toInternationalPhone } from "@/lib/phone"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export function LoginForm({
    onForgotPassword,
    onSwitchToRegister,
}: {
    onForgotPassword?: () => void
    onSwitchToRegister?: () => void
}) {
    const { login } = useAuth()
    const [phone, setPhone] = useState("")
    const [password, setPassword] = useState("")
    const [remember, setRemember] = useState(true)
    const [showPassword, setShowPassword] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    const [formError, setFormError] = useState<string | null>(null)

    const hasFieldErrors = Object.keys(fieldErrors).length > 0

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (submitting) return

        setSubmitting(true)
        setFieldErrors({})
        setFormError(null)

        const result = await login(
            toInternationalPhone(phone),
            password,
            remember
        )

        if (result.ok) {
            toast({
                title: "Connexion réussie",
                description: "Bienvenue sur Mon doc Pro !",
            })
        } else {
            if (result.fieldErrors) setFieldErrors(result.fieldErrors)
            // Alert générique seulement si aucune erreur de champ inline
            // (401, 409, réseau… n'ont pas de fieldErrors).
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
            className="flex flex-col gap-4"
            noValidate={false}
        >
            {formError && !hasFieldErrors && (
                <Alert variant="destructive">
                    <AlertDescription>{formError}</AlertDescription>
                </Alert>
            )}

            <div className="flex flex-col gap-2">
                <Label
                    htmlFor="login-phone"
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                    Numéro de téléphone
                </Label>
                <div
                    className={cn(
                        "relative flex h-11 items-stretch overflow-hidden rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow]",
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
                        id="login-phone"
                        name="phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel-national"
                        placeholder="07 01 02 03 04"
                        required
                        maxLength={14}
                        value={phone}
                        onChange={e =>
                            setPhone(e.target.value.replace(/[^\d\s]/g, ""))
                        }
                        disabled={submitting}
                        className="h-full flex-1 rounded-none border-0 pr-9 pl-3 shadow-none focus-visible:ring-0"
                        aria-invalid={fieldErrors.phone ? true : undefined}
                        aria-describedby={
                            fieldErrors.phone ? "login-phone-error" : undefined
                        }
                    />
                    <Grid3x3
                        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                    />
                </div>
                {fieldErrors.phone && (
                    <p
                        id="login-phone-error"
                        className="text-sm text-destructive"
                    >
                        {fieldErrors.phone}
                    </p>
                )}
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                    <Label
                        htmlFor="login-password"
                        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                        Mot de passe
                    </Label>
                    {onForgotPassword && (
                        <button
                            type="button"
                            onClick={onForgotPassword}
                            disabled={submitting}
                            className="text-sm font-medium text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                        >
                            Mot de passe oublié ?
                        </button>
                    )}
                </div>
                <div className="relative">
                    <Lock
                        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                    />
                    <Input
                        id="login-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="Votre mot de passe"
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        disabled={submitting}
                        className="h-11 pr-11 pl-9"
                        aria-invalid={fieldErrors.password ? true : undefined}
                        aria-describedby={
                            fieldErrors.password
                                ? "login-password-error"
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
                            <EyeOff className="size-4" aria-hidden="true" />
                        ) : (
                            <Eye className="size-4" aria-hidden="true" />
                        )}
                    </button>
                </div>
                {fieldErrors.password && (
                    <p
                        id="login-password-error"
                        className="text-sm text-destructive"
                    >
                        {fieldErrors.password}
                    </p>
                )}
            </div>

            {/* Se souvenir de moi : 30 jours (coché) ou session navigateur (décoché) */}
            <div className="flex items-center gap-2.5">
                <Checkbox
                    id="login-remember"
                    checked={remember}
                    onCheckedChange={v => setRemember(v === true)}
                    disabled={submitting}
                />
                <label
                    htmlFor="login-remember"
                    className="text-sm font-medium text-foreground/80 select-none"
                >
                    Se souvenir de moi
                </label>
            </div>

            <Button type="submit" className="h-11 w-full" disabled={submitting}>
                {submitting ? (
                    <>
                        <Loader2
                            className="size-4 animate-spin"
                            aria-hidden="true"
                        />
                        Connexion en cours…
                    </>
                ) : (
                    <>
                        Se connecter
                        <ArrowRight className="size-4" aria-hidden="true" />
                    </>
                )}
            </Button>

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
    )
}
