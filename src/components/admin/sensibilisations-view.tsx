"use client"

// Vue « Conseils & Sensibilisations » du Médecin Chef — FEATURE-SENSO
// phase 2 (demande PO 2026-10-05 : « le menu pour faire ou publier des
// conseils et sensibilisations »). Rédaction complète : publication d'un
// conseil ou d'une alerte santé, ciblage par zone (vide = toutes les zones),
// édition et suppression — le fil consommé par les patients et les infirmiers
// est alimenté par cette vue (GET /api/sensibilisations côté lecture).
//
// Même langage visuel que le fil patient (pill catégorie, cartes arrondies)
// pour que « publier » prévisualise fidèlement ce que le patient lira.
import { useCallback, useEffect, useMemo, useState } from "react"
import {
    HeartPulse,
    Loader2,
    Megaphone,
    Pencil,
    Plus,
    RefreshCw,
    Trash2,
    TriangleAlert,
} from "lucide-react"

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { hapticLight, hapticSuccess } from "@/lib/native"
import { relativePublishedLabel } from "@/lib/datetime"
import { ZONE_LABELS, ZONES, zodIssuesToFieldErrors } from "@/lib/auth-schemas"
import type { AdminSensibilisationDto } from "@/lib/sensibilisations"
import {
    SENSIBILISATION_BODY_MAX,
    SENSIBILISATION_TITLE_MAX,
    SENSIBILISATION_CATEGORY_LABELS,
    createSensibilisationSchema,
} from "@/lib/sensibilisations-schemas"
import { toast } from "@/hooks/use-toast"

type CategoryFilter = "all" | "ADVICE" | "ALERT"

const FILTERS: { id: CategoryFilter; label: string }[] = [
    { id: "all", label: "Tout" },
    { id: "ADVICE", label: "Conseils" },
    { id: "ALERT", label: "Alertes" },
]

// Formulaire contrôlé du dialog — identique en création et en édition
// (l'édition pré-remplit ; la création repart du neutre à chaque ouverture).
type FormState = {
    title: string
    category: "ADVICE" | "ALERT"
    body: string
    zones: string[]
}

const EMPTY_FORM: FormState = {
    title: "",
    category: "ADVICE",
    body: "",
    zones: [],
}

export function SensibilisationsAdminView() {
    const [items, setItems] = useState<AdminSensibilisationDto[] | null>(null)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [filter, setFilter] = useState<CategoryFilter>("all")

    // Dialog publication / édition
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState<FormState>(EMPTY_FORM)
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    const [submitting, setSubmitting] = useState(false)

    // Suppression
    const [confirmDelete, setConfirmDelete] =
        useState<AdminSensibilisationDto | null>(null)
    const [deleting, setDeleting] = useState(false)

    const loadAll = useCallback(async () => {
        setLoading(true)
        setLoadError(null)
        try {
            const res = await fetch("/api/admin/sensibilisations")
            if (res.ok) {
                const body = (await res.json()) as {
                    sensibilisations: AdminSensibilisationDto[]
                }
                setItems(body.sensibilisations)
            } else {
                const body = (await res.json().catch(() => ({}))) as {
                    error?: string
                }
                setLoadError(body.error ?? "Réessayez dans un instant.")
            }
        } catch {
            setLoadError(
                "Impossible de contacter le serveur. Vérifiez votre connexion internet puis réessayez."
            )
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void loadAll()
    }, [loadAll])

    const visible = useMemo(() => {
        const list = items ?? []
        if (filter === "all") return list
        return list.filter(item => item.category === filter)
    }, [items, filter])

    const countFor = (id: CategoryFilter): number => {
        const list = items ?? []
        if (id === "all") return list.length
        return list.filter(item => item.category === id).length
    }

    function openCreate() {
        setEditingId(null)
        setForm(EMPTY_FORM)
        setFieldErrors({})
        setDialogOpen(true)
    }

    function openEdit(item: AdminSensibilisationDto) {
        setEditingId(item.id)
        setForm({
            title: item.title,
            category: item.category,
            body: item.body,
            zones: [...item.zones],
        })
        setFieldErrors({})
        setDialogOpen(true)
    }

    function toggleZone(zone: string) {
        setForm(current => ({
            ...current,
            zones: current.zones.includes(zone)
                ? current.zones.filter(z => z !== zone)
                : [...current.zones, zone],
        }))
    }

    async function handleSubmit() {
        // Validation client via le MÊME schéma zod que le serveur — les
        // erreurs apparaissent inline avant tout aller-retour réseau.
        const parsed = createSensibilisationSchema.safeParse({
            title: form.title,
            body: form.body,
            category: form.category,
            zones: form.zones,
        })
        if (!parsed.success) {
            setFieldErrors(zodIssuesToFieldErrors(parsed.error))
            return
        }
        setFieldErrors({})
        setSubmitting(true)
        const isEdit = editingId !== null
        try {
            const res = await fetch(
                isEdit
                    ? `/api/admin/sensibilisations/${editingId}`
                    : "/api/admin/sensibilisations",
                {
                    method: isEdit ? "PATCH" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(parsed.data),
                }
            )
            const body = (await res.json().catch(() => ({}))) as {
                sensibilisation?: AdminSensibilisationDto
                error?: string
                details?: { field: string; message: string }[]
            }
            if (res.ok && body.sensibilisation) {
                const saved = body.sensibilisation
                setItems(current => {
                    const list = current ?? []
                    return isEdit
                        ? list.map(item =>
                              item.id === saved.id ? saved : item
                          )
                        : [saved, ...list]
                })
                setDialogOpen(false)
                void hapticSuccess()
                toast({
                    title: isEdit
                        ? "Sensibilisation mise à jour"
                        : "Sensibilisation publiée",
                    description: `« ${saved.title} » est ${
                        isEdit
                            ? "désormais à jour dans le fil des patients."
                            : "visible dans le fil des patients ciblés."
                    }`,
                })
                return
            }
            if (res.status === 400 && body.details) {
                setFieldErrors(
                    Object.fromEntries(
                        body.details.map(d => [d.field, d.message])
                    )
                )
            }
            toast({
                variant: "destructive",
                title: isEdit
                    ? "Modification impossible"
                    : "Publication impossible",
                description: body.error ?? "Réessayez dans un instant.",
            })
        } catch {
            toast({
                variant: "destructive",
                title: isEdit
                    ? "Modification impossible"
                    : "Publication impossible",
                description:
                    "Impossible de contacter le serveur. Vérifiez votre connexion internet puis réessayez.",
            })
        } finally {
            setSubmitting(false)
        }
    }

    async function handleDelete(item: AdminSensibilisationDto) {
        setDeleting(true)
        try {
            const res = await fetch(
                `/api/admin/sensibilisations/${item.id}`,
                { method: "DELETE" }
            )
            if (res.status === 204) {
                setItems(current =>
                    (current ?? []).filter(entry => entry.id !== item.id)
                )
                void hapticLight()
                toast({
                    title: "Sensibilisation supprimée",
                    description: `« ${item.title} » a été retirée du fil des patients.`,
                })
                return
            }
            const body = (await res.json().catch(() => ({}))) as {
                error?: string
            }
            toast({
                variant: "destructive",
                title: "Suppression impossible",
                description: body.error ?? "Réessayez dans un instant.",
            })
        } catch {
            toast({
                variant: "destructive",
                title: "Suppression impossible",
                description:
                    "Impossible de contacter le serveur. Vérifiez votre connexion internet puis réessayez.",
            })
        } finally {
            setDeleting(false)
            setConfirmDelete(null)
        }
    }

    return (
        <div className="flex flex-col gap-5">
            {/* En-tête d'action — bouton principal à gauche, rafraîchissement
                à droite (même disposition que la vue Infirmiers) */}
            <div className="flex items-center justify-between gap-3">
                <Button
                    type="button"
                    onClick={openCreate}
                    className="h-11 gap-1.5 rounded-xl text-sm font-semibold"
                >
                    <Plus className="size-4" aria-hidden="true" />
                    Nouvelle sensibilisation
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Rafraîchir la liste"
                    disabled={loading}
                    onClick={() => void loadAll()}
                    className="size-11 rounded-xl"
                >
                    <RefreshCw
                        className={`size-4 ${loading ? "animate-spin" : ""}`}
                        aria-hidden="true"
                    />
                </Button>
            </div>

            {/* Onglets segmentés — même composant visuel que le fil patient */}
            <div
                role="group"
                aria-label="Filtrer les sensibilisations"
                className="flex items-center gap-1 rounded-xl bg-muted p-1"
            >
                {FILTERS.map(entry => (
                    <button
                        key={entry.id}
                        type="button"
                        onClick={() => setFilter(entry.id)}
                        aria-pressed={filter === entry.id}
                        className={`min-h-9 flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            filter === entry.id
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {entry.label}
                        {countFor(entry.id) > 0
                            ? ` (${countFor(entry.id)})`
                            : ""}
                    </button>
                ))}
            </div>

            {/* Liste éditoriale */}
            {loading && items === null ? (
                <ul
                    className="grid gap-3"
                    aria-busy="true"
                    aria-label="Chargement des sensibilisations"
                >
                    {[0, 1, 2].map(index => (
                        <li key={index}>
                            <Skeleton
                                className="h-[150px] rounded-2xl"
                                aria-hidden="true"
                            />
                        </li>
                    ))}
                </ul>
            ) : loadError && items === null ? (
                <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
                    <p className="text-sm font-medium">{loadError}</p>
                    <Button
                        variant="outline"
                        onClick={() => void loadAll()}
                        className="mt-4 h-10 gap-2 rounded-xl text-sm font-semibold"
                    >
                        Réessayer
                    </Button>
                </div>
            ) : visible.length > 0 ? (
                <ul className="grid gap-3 xl:grid-cols-2">
                    {visible.map(item => {
                        const isAlert = item.category === "ALERT"
                        const isEdited =
                            item.updatedAt !== item.publishedAt &&
                            new Date(item.updatedAt).getTime() >
                                new Date(item.publishedAt).getTime() + 60_000
                        return (
                            <li
                                key={item.id}
                                className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <span
                                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                            isAlert
                                                ? "bg-destructive/10 text-destructive"
                                                : "bg-success-light text-success-foreground"
                                        }`}
                                    >
                                        {isAlert ? (
                                            <TriangleAlert
                                                className="size-3.5"
                                                aria-hidden="true"
                                            />
                                        ) : (
                                            <HeartPulse
                                                className="size-3.5"
                                                aria-hidden="true"
                                            />
                                        )}
                                        {
                                            SENSIBILISATION_CATEGORY_LABELS[
                                                item.category
                                            ]
                                        }
                                    </span>
                                    <span
                                        className="shrink-0 whitespace-nowrap text-xs text-muted-foreground"
                                        suppressHydrationWarning
                                    >
                                        {relativePublishedLabel(
                                            item.publishedAt
                                        )}
                                        {isEdited ? " · modifiée" : ""}
                                    </span>
                                </div>

                                <p className="mt-3 text-[15px] font-bold leading-snug">
                                    {item.title}
                                </p>
                                <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                                    {item.body}
                                </p>

                                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                                    {item.zones.length === 0 ? (
                                        <Badge
                                            variant="outline"
                                            className="text-xs font-semibold"
                                        >
                                            Toutes les zones
                                        </Badge>
                                    ) : (
                                        item.zones.map(zone => (
                                            <Badge
                                                key={zone}
                                                variant="outline"
                                                className="text-xs font-semibold"
                                            >
                                                {ZONE_LABELS[zone]}
                                            </Badge>
                                        ))
                                    )}
                                </div>

                                <div className="mt-3 flex items-center justify-end gap-1.5 border-t pt-3">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openEdit(item)}
                                        className="h-9 gap-1.5 rounded-lg text-xs font-semibold"
                                    >
                                        <Pencil
                                            className="size-3.5"
                                            aria-hidden="true"
                                        />
                                        Modifier
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setConfirmDelete(item)}
                                        className="h-9 gap-1.5 rounded-lg text-xs font-semibold text-destructive hover:bg-destructive/5 hover:text-destructive"
                                    >
                                        <Trash2
                                            className="size-3.5"
                                            aria-hidden="true"
                                        />
                                        Supprimer
                                    </Button>
                                </div>
                            </li>
                        )
                    })}
                </ul>
            ) : (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-muted/40 p-8 text-center">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Megaphone className="size-6" aria-hidden="true" />
                    </span>
                    <div>
                        <p className="font-bold">
                            {items && items.length > 0
                                ? "Rien dans ce filtre"
                                : "Aucune sensibilisation"}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {items && items.length > 0
                                ? "Changez de filtre pour voir les autres publications."
                                : "Publiez votre premier conseil ou alerte santé — il apparaîtra immédiatement dans le fil des patients."}
                        </p>
                    </div>
                </div>
            )}

            {/* Dialog publication / édition */}
            <Dialog
                open={dialogOpen}
                onOpenChange={open => {
                    if (!open) setDialogOpen(false)
                }}
            >
                <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {editingId
                                ? "Modifier la sensibilisation"
                                : "Nouvelle sensibilisation"}
                        </DialogTitle>
                        <DialogDescription>
                            {editingId
                                ? "Les patients voient la version mise à jour dès l'enregistrement."
                                : "Publiez un conseil ou une alerte santé — visible immédiatement dans le fil des patients ciblés."}
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        onSubmit={event => {
                            event.preventDefault()
                            void handleSubmit()
                        }}
                        className="flex flex-col gap-4"
                    >
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="senso-title">Titre</Label>
                            <Input
                                id="senso-title"
                                value={form.title}
                                onChange={event =>
                                    setForm(current => ({
                                        ...current,
                                        title: event.target.value.slice(
                                            0,
                                            SENSIBILISATION_TITLE_MAX
                                        ),
                                    }))
                                }
                                placeholder="Ex. : Campagne de prévention du paludisme"
                                aria-invalid={fieldErrors.title ? true : undefined}
                                maxLength={SENSIBILISATION_TITLE_MAX}
                                autoFocus
                            />
                            {fieldErrors.title ? (
                                <p className="text-xs font-medium text-destructive">
                                    {fieldErrors.title}
                                </p>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    {SENSIBILISATION_TITLE_MAX -
                                        form.title.length}{" "}
                                    caractères restants
                                </p>
                            )}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label>Catégorie</Label>
                            <div
                                role="group"
                                aria-label="Catégorie de la publication"
                                className="flex items-center gap-1 rounded-xl bg-muted p-1"
                            >
                                {(
                                    ["ADVICE", "ALERT"] as const
                                ).map(category => (
                                    <button
                                        key={category}
                                        type="button"
                                        onClick={() =>
                                            setForm(current => ({
                                                ...current,
                                                category,
                                            }))
                                        }
                                        aria-pressed={
                                            form.category === category
                                        }
                                        className={`min-h-9 flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                            form.category === category
                                                ? category === "ALERT"
                                                    ? "bg-destructive text-destructive-foreground shadow-sm"
                                                    : "bg-primary text-primary-foreground shadow-sm"
                                                : "text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        {category === "ALERT"
                                            ? "Alerte santé"
                                            : "Conseil santé"}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {form.category === "ALERT"
                                    ? "Une alerte est mise en avant en rouge dans le fil — réservez-la aux urences sanitaires."
                                    : "Un conseil apparaît en vert dans le fil santé des patients."}
                            </p>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="senso-body">Contenu</Label>
                            <Textarea
                                id="senso-body"
                                value={form.body}
                                onChange={event =>
                                    setForm(current => ({
                                        ...current,
                                        body: event.target.value.slice(
                                            0,
                                            SENSIBILISATION_BODY_MAX
                                        ),
                                    }))
                                }
                                placeholder="Rédigez le message complet — il est lu à voix haute aux patients qui utilisent l'écoute."
                                rows={7}
                                aria-invalid={fieldErrors.body ? true : undefined}
                                className="rounded-xl"
                            />
                            {fieldErrors.body ? (
                                <p className="text-xs font-medium text-destructive">
                                    {fieldErrors.body}
                                </p>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    {form.body.length} /{" "}
                                    {SENSIBILISATION_BODY_MAX} caractères
                                </p>
                            )}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label>Zones ciblées</Label>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {ZONES.map(zone => (
                                    <label
                                        key={zone}
                                        className="flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted/60"
                                    >
                                        <Checkbox
                                            checked={form.zones.includes(zone)}
                                            onCheckedChange={() =>
                                                toggleZone(zone)
                                            }
                                            aria-label={`Cibler la zone ${ZONE_LABELS[zone]}`}
                                        />
                                        {ZONE_LABELS[zone]}
                                    </label>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Aucune zone cochée = publié pour toutes les
                                zones.
                            </p>
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setDialogOpen(false)}
                                disabled={submitting}
                                className="rounded-xl"
                            >
                                Annuler
                            </Button>
                            <Button
                                type="submit"
                                disabled={submitting}
                                className="gap-1.5 rounded-xl font-semibold"
                            >
                                {submitting ? (
                                    <Loader2
                                        className="size-4 animate-spin"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <Megaphone
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                )}
                                {editingId
                                    ? "Enregistrer"
                                    : "Publier"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Confirmation de suppression — action définitive, jamais
                accidentelle */}
            <AlertDialog
                open={confirmDelete !== null}
                onOpenChange={open => {
                    if (!open) setConfirmDelete(null)
                }}
            >
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Supprimer « {confirmDelete?.title} » ?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            La publication disparaîtra immédiatement du fil des
                            patients et des infirmiers. Cette action est
                            définitive — pour la masquer sans la perdre,
                            modifiez plutôt son ciblage ou son contenu.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>
                            Conserver
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={event => {
                                event.preventDefault()
                                if (confirmDelete)
                                    void handleDelete(confirmDelete)
                            }}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive"
                        >
                            Supprimer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
