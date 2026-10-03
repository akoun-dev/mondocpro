"use client"

// Gestion des Spécialités — Espace Médecin Chef (demande PO 2026-10-03 :
// « configurable chez le admin »). Catalogue consommé par l'étape 2 du wizard
// patient : ajout, renommage inline, activation/désactivation douce, deletion
// (409 si des RDV y sont rattachés → toast, la désactivation est conseillée).
import { useCallback, useEffect, useState } from "react"
import {
    ArrowLeft,
    Check,
    Loader2,
    Pencil,
    Plus,
    Power,
    Stethoscope,
    Trash2,
    X,
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
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/hooks/use-toast"
import type { SpecialtyDto } from "@/lib/specialties"

type Props = {
    onBack: () => void
}

const NAME_MAX = 80

export function SpecialtiesView({ onBack }: Props) {
    const [specialties, setSpecialties] = useState<SpecialtyDto[] | null>(null)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [newName, setNewName] = useState("")
    const [adding, setAdding] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState("")
    const [busyId, setBusyId] = useState<string | null>(null)
    const [confirmDelete, setConfirmDelete] = useState<SpecialtyDto | null>(
        null
    )

    const loadAll = useCallback(async () => {
        setLoading(true)
        setLoadError(null)
        try {
            const res = await fetch("/api/admin/specialties")
            if (res.ok) {
                const body = (await res.json()) as {
                    specialties: SpecialtyDto[]
                }
                setSpecialties(body.specialties)
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

    async function handleAdd() {
        const name = newName.trim()
        if (name.length < 2) {
            toast({
                variant: "destructive",
                title: "Nom trop court",
                description:
                    "La spécialité doit contenir au moins 2 caractères.",
            })
            return
        }
        setAdding(true)
        try {
            const res = await fetch("/api/admin/specialties", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            })
            const body = (await res.json().catch(() => ({}))) as {
                specialty?: SpecialtyDto
                error?: string
            }
            if (res.status === 201 && body.specialty) {
                toast({
                    title: "Spécialité ajoutée",
                    description: `« ${body.specialty.name} » est proposée aux patients.`,
                })
                setNewName("")
                await loadAll()
                return
            }
            toast({
                variant: "destructive",
                title: "Ajout impossible",
                description: body.error ?? "Réessayez dans un instant.",
            })
        } catch {
            toast({
                variant: "destructive",
                title: "Ajout impossible",
                description:
                    "Impossible de contacter le serveur. Vérifiez votre connexion internet puis réessayez.",
            })
        } finally {
            setAdding(false)
        }
    }

    async function patchSpecialty(
        specialty: SpecialtyDto,
        patch: { name?: string; isActive?: boolean }
    ) {
        setBusyId(specialty.id)
        try {
            const res = await fetch(`/api/admin/specialties/${specialty.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patch),
            })
            const body = (await res.json().catch(() => ({}))) as {
                specialty?: SpecialtyDto
                error?: string
            }
            if (res.ok && body.specialty) {
                setSpecialties(current =>
                    (current ?? []).map(item =>
                        item.id === specialty.id
                            ? (body.specialty as SpecialtyDto)
                            : item
                    )
                )
                if (patch.isActive !== undefined) {
                    toast({
                        title:
                            patch.isActive === false
                                ? "Spécialité désactivée"
                                : "Spécialité activée",
                        description:
                            patch.isActive === false
                                ? `« ${specialty.name} » n'est plus proposée aux patients.`
                                : `« ${specialty.name} » est de nouveau proposée aux patients.`,
                    })
                }
                return true
            }
            toast({
                variant: "destructive",
                title: "Modification impossible",
                description: body.error ?? "Réessayez dans un instant.",
            })
            return false
        } catch {
            toast({
                variant: "destructive",
                title: "Modification impossible",
                description:
                    "Impossible de contacter le serveur. Vérifiez votre connexion internet puis réessayez.",
            })
            return false
        } finally {
            setBusyId(null)
        }
    }

    async function handleDelete(specialty: SpecialtyDto) {
        setBusyId(specialty.id)
        try {
            const res = await fetch(`/api/admin/specialties/${specialty.id}`, {
                method: "DELETE",
            })
            if (res.status === 204) {
                toast({
                    title: "Spécialité supprimée",
                    description: `« ${specialty.name} » a été retirée du catalogue.`,
                })
                setSpecialties(current =>
                    (current ?? []).filter(item => item.id !== specialty.id)
                )
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
            setBusyId(null)
            setConfirmDelete(null)
        }
    }

    return (
        <div className="flex flex-col gap-5">
            {/* En-tête — même gabarit que « Mes rendez-vous » */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-1.5">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onBack}
                        aria-label="Retour à l'accueil"
                        className="size-9 shrink-0 rounded-full"
                    >
                        <ArrowLeft className="size-5" aria-hidden="true" />
                    </Button>
                    <div className="min-w-0">
                        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                            Spécialités
                        </h2>
                        <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                            Catalogue proposé aux patients à la prise de
                            rendez-vous
                        </p>
                    </div>
                </div>
            </div>

            {/* Ajout d'une spécialité */}
            <form
                onSubmit={event => {
                    event.preventDefault()
                    void handleAdd()
                }}
                className="flex gap-2.5"
            >
                <Input
                    value={newName}
                    onChange={event =>
                        setNewName(event.target.value.slice(0, NAME_MAX))
                    }
                    placeholder="Ex. : Dermatologie"
                    aria-label="Nom de la nouvelle spécialité"
                    className="h-11 rounded-xl"
                />
                <Button
                    type="submit"
                    disabled={adding || newName.trim().length < 2}
                    className="h-11 shrink-0 gap-1.5 rounded-xl text-sm font-semibold"
                >
                    {adding ? (
                        <Loader2
                            className="size-4 animate-spin"
                            aria-hidden="true"
                        />
                    ) : (
                        <Plus className="size-4" aria-hidden="true" />
                    )}
                    Ajouter
                </Button>
            </form>

            {/* Liste du catalogue */}
            {loading && specialties === null ? (
                <ul
                    className="grid gap-3"
                    aria-busy="true"
                    aria-label="Chargement des spécialités"
                >
                    {[0, 1, 2].map(index => (
                        <li key={index}>
                            <Skeleton
                                className="h-[64px] rounded-2xl"
                                aria-hidden="true"
                            />
                        </li>
                    ))}
                </ul>
            ) : loadError && specialties === null ? (
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
            ) : specialties && specialties.length > 0 ? (
                <ul className="grid gap-3">
                    {specialties.map(specialty => {
                        const isEditing = editingId === specialty.id
                        const busy = busyId === specialty.id
                        return (
                            <li
                                key={specialty.id}
                                className="rounded-2xl border bg-card p-4 shadow-sm"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                        <Stethoscope
                                            className="size-4.5"
                                            aria-hidden="true"
                                        />
                                    </span>
                                    {isEditing ? (
                                        <form
                                            onSubmit={event => {
                                                event.preventDefault()
                                                void patchSpecialty(specialty, {
                                                    name: editName,
                                                }).then(ok => {
                                                    if (ok) setEditingId(null)
                                                })
                                            }}
                                            className="flex min-w-0 flex-1 items-center gap-2"
                                        >
                                            <Input
                                                autoFocus
                                                value={editName}
                                                onChange={event =>
                                                    setEditName(
                                                        event.target.value.slice(
                                                            0,
                                                            NAME_MAX
                                                        )
                                                    )
                                                }
                                                aria-label={`Nouveau nom pour ${specialty.name}`}
                                                className="h-9 rounded-lg"
                                            />
                                            <Button
                                                type="submit"
                                                size="icon"
                                                disabled={
                                                    busy ||
                                                    editName.trim().length < 2
                                                }
                                                aria-label="Enregistrer le nouveau nom"
                                                className="size-9 shrink-0 rounded-lg"
                                            >
                                                <Check
                                                    className="size-4"
                                                    aria-hidden="true"
                                                />
                                            </Button>
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="ghost"
                                                onClick={() =>
                                                    setEditingId(null)
                                                }
                                                aria-label="Annuler le renommage"
                                                className="size-9 shrink-0 rounded-lg"
                                            >
                                                <X
                                                    className="size-4"
                                                    aria-hidden="true"
                                                />
                                            </Button>
                                        </form>
                                    ) : (
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-bold">
                                                {specialty.name}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Ordre d&apos;affichage :{" "}
                                                {specialty.sortOrder}
                                            </p>
                                        </div>
                                    )}
                                    {!isEditing && (
                                        <Badge
                                            className={
                                                specialty.isActive
                                                    ? "shrink-0 bg-success text-success-foreground"
                                                    : "shrink-0 bg-muted text-muted-foreground"
                                            }
                                            aria-label={
                                                specialty.isActive
                                                    ? "Spécialité active"
                                                    : "Spécialité désactivée"
                                            }
                                        >
                                            {specialty.isActive
                                                ? "Active"
                                                : "Inactive"}
                                        </Badge>
                                    )}
                                </div>

                                {!isEditing && (
                                    <div className="mt-3 flex items-center justify-end gap-1.5 border-t pt-3">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={busy}
                                            onClick={() => {
                                                setEditingId(specialty.id)
                                                setEditName(specialty.name)
                                            }}
                                            className="h-9 gap-1.5 rounded-lg text-xs font-semibold"
                                        >
                                            <Pencil
                                                className="size-3.5"
                                                aria-hidden="true"
                                            />
                                            Renommer
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={busy}
                                            onClick={() =>
                                                void patchSpecialty(specialty, {
                                                    isActive:
                                                        !specialty.isActive,
                                                })
                                            }
                                            className="h-9 gap-1.5 rounded-lg text-xs font-semibold"
                                        >
                                            {busy ? (
                                                <Loader2
                                                    className="size-3.5 animate-spin"
                                                    aria-hidden="true"
                                                />
                                            ) : (
                                                <Power
                                                    className="size-3.5"
                                                    aria-hidden="true"
                                                />
                                            )}
                                            {specialty.isActive
                                                ? "Désactiver"
                                                : "Activer"}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={busy}
                                            onClick={() =>
                                                setConfirmDelete(specialty)
                                            }
                                            className="h-9 gap-1.5 rounded-lg text-xs font-semibold text-destructive hover:bg-destructive/5 hover:text-destructive"
                                        >
                                            <Trash2
                                                className="size-3.5"
                                                aria-hidden="true"
                                            />
                                            Supprimer
                                        </Button>
                                    </div>
                                )}
                            </li>
                        )
                    })}
                </ul>
            ) : (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-muted/40 p-8 text-center">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Stethoscope className="size-6" aria-hidden="true" />
                    </span>
                    <div>
                        <p className="font-bold">Catalogue vide</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Ajoutez les spécialités proposées à vos patients.
                        </p>
                    </div>
                </div>
            )}

            {/* Confirmation de suppression — action définitive, jamais accidentelle */}
            <AlertDialog
                open={confirmDelete !== null}
                onOpenChange={open => {
                    if (!open) setConfirmDelete(null)
                }}
            >
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Supprimer « {confirmDelete?.name} » ?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Si des rendez-vous sont rattachés à cette
                            spécialité, la suppression sera refusée —
                            désactivez-la plutôt pour la masquer aux patients
                            tout en conservant l&apos;historique.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={busyId !== null}>
                            Conserver
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={event => {
                                event.preventDefault()
                                if (confirmDelete)
                                    void handleDelete(confirmDelete)
                            }}
                            disabled={busyId !== null}
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
