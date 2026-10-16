"use client"

// Gestion des Spécialités — Espace Médecin Chef — Task UI-SPECIALTIES-2C
// (redesign maquette PO 2026-10, vue « Spécialités »). Catalogue consommé par
// l'étape 2 du wizard patient :
//   1. Cartes de synthèse (Total / Actives / Inactives) CLIQUABLES — elles
//      appliquent le filtre d'état correspondant (aria-pressed, pattern
//      Missions) ;
//   2. Encart d'ajout (label uppercase + input pill + bouton « Ajouter ») —
//      validation 2–80 caractères et toasts conservées ;
//   3. Recherche CLIENT pillée (titre de spécialité, insensible à la casse,
//      bouton d'effacement — pattern Patients) ;
//   4. Chips d'état avec compteurs + Select de tri (Ordre d'affichage =
//      sortOrder croissant par défaut / Nom (A-Z) = localeCompare) ;
//   5. Cartes spécialité : grip DÉCORATIF (aucune API de réordonnancement —
//      pas de drag & drop), pastille ronde teintée déterministe + stéthoscope,
//      badge Active/Inactive, Switch d'activation (remplace fonctionnellement
//      le bouton Désactiver/Activer, conservé lui aussi), « Ordre
//      d'affichage : N », actions Renommer (inline) / Désactiver-Activer /
//      Supprimer (AlertDialog de confirmation — 409 si des RDV rattachés).
// Le compteur « soignants » de la maquette n'est PAS affiché : aucune donnée
// de rattachement soignant↔spécialité n'existe en base (ne pas inventer).
// Contrats inchangés : GET /api/admin/specialties, POST (201),
// PATCH /:id (name | isActive), DELETE /:id (204).
import { useCallback, useEffect, useMemo, useState } from "react"
import {
    ArrowDownUp,
    Check,
    CircleCheck,
    GripVertical,
    Loader2,
    Pause,
    Pencil,
    Plus,
    Power,
    Rows3,
    Search,
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/hooks/use-toast"
import type { SpecialtyDto } from "@/lib/specialties"

const NAME_MAX = 80

type StatusFilter = "all" | "active" | "inactive"
type SortMode = "sortOrder" | "name"

const STATUS_FILTERS = [
    { id: "all", label: "Toutes" },
    { id: "active", label: "Actives" },
    { id: "inactive", label: "Inactives" },
] as const

// Pastille ronde colorée déterministe (même palette que Patients/Missions) :
// le hash du nom choisit la teinte, l'icône stéthoscope blanche rappelle le
// domaine médical.
const AVATAR_CLASSES = [
    "bg-amber-500",
    "bg-rose-500",
    "bg-teal-500",
    "bg-violet-500",
    "bg-emerald-600",
    "bg-orange-500",
    "bg-fuchsia-500",
    "bg-cyan-600",
]

function avatarClass(seed: string): string {
    let hash = 0
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
    return AVATAR_CLASSES[Math.abs(hash) % AVATAR_CLASSES.length]
}

export function SpecialtiesView() {
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
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
    const [sortMode, setSortMode] = useState<SortMode>("sortOrder")

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

    // Compteurs de synthèse (sur la liste chargée, hors recherche/filtres —
    // les cartes et chips ne bougent pas quand on cherche, pattern Patients).
    const stats = useMemo(() => {
        const list = specialties ?? []
        const activeCount = list.filter(item => item.isActive).length
        return {
            total: list.length,
            activeCount,
            inactiveCount: list.length - activeCount,
        }
    }, [specialties])

    // Filtre CLIENT (recherche + état) puis tri local (sortOrder croissant
    // par défaut, ou alphabétique) — aucun paramètre serveur supplémentaire.
    const visibleSpecialties = useMemo(() => {
        const query = search.trim().toLowerCase()
        return (specialties ?? [])
            .filter(specialty =>
                statusFilter === "all"
                    ? true
                    : statusFilter === "active"
                      ? specialty.isActive
                      : !specialty.isActive
            )
            .filter(
                specialty =>
                    query === "" ||
                    specialty.name.toLowerCase().includes(query)
            )
            .sort((a, b) =>
                sortMode === "name"
                    ? a.name.localeCompare(b.name, "fr")
                    : a.sortOrder - b.sortOrder
            )
    }, [specialties, search, statusFilter, sortMode])

    return (
        <div className="flex flex-col gap-4">
            {/* ——— Cartes de synthèse (maquette) — cliquables = filtre d'état ——— */}
            {loading && specialties === null ? (
                <div
                    className="grid grid-cols-3 gap-2"
                    aria-busy="true"
                    aria-label="Chargement des spécialités"
                >
                    <Skeleton
                        className="h-[62px] rounded-2xl"
                        aria-hidden="true"
                    />
                    <Skeleton
                        className="h-[62px] rounded-2xl"
                        aria-hidden="true"
                    />
                </div>
            ) : (
                specialties !== null && (
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={() => setStatusFilter("all")}
                            aria-pressed={statusFilter === "all"}
                            className={`flex min-w-0 flex-col items-start gap-0.5 rounded-2xl border p-2.5 text-left transition-colors ${
                                statusFilter === "all"
                                    ? "border-primary bg-primary/20"
                                    : "border-primary/30 bg-primary/10 hover:bg-primary/15"
                            }`}
                        >
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-primary">
                                <Rows3
                                    className="size-3"
                                    aria-hidden="true"
                                />
                                Total
                            </span>
                            <span className="text-sm font-extrabold text-primary">
                                {stats.total}
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                setStatusFilter(
                                    statusFilter === "active"
                                        ? "all"
                                        : "active"
                                )
                            }
                            aria-pressed={statusFilter === "active"}
                            className={`flex min-w-0 flex-col items-start gap-0.5 rounded-2xl border p-2.5 text-left transition-colors ${
                                statusFilter === "active"
                                    ? "border-success bg-success/20"
                                    : "border-success/30 bg-success/10 hover:bg-success/15"
                            }`}
                        >
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-success-foreground dark:text-success">
                                <CircleCheck
                                    className="size-3"
                                    aria-hidden="true"
                                />
                                Actives
                            </span>
                            <span className="text-sm font-extrabold text-success-foreground dark:text-success">
                                {stats.activeCount}
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                setStatusFilter(
                                    statusFilter === "inactive"
                                        ? "all"
                                        : "inactive"
                                )
                            }
                            aria-pressed={statusFilter === "inactive"}
                            className={`flex min-w-0 flex-col items-start gap-0.5 rounded-2xl border p-2.5 text-left transition-colors ${
                                statusFilter === "inactive"
                                    ? "border-border bg-muted"
                                    : "border-border bg-muted/40 hover:bg-muted/70"
                            }`}
                        >
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                                <Pause
                                    className="size-3"
                                    aria-hidden="true"
                                />
                                Inactives
                            </span>
                            <span className="text-sm font-extrabold text-muted-foreground">
                                {stats.inactiveCount}
                            </span>
                        </button>
                    </div>
                )
            )}

            {/* ——— Encart d'ajout (maquette) ——— */}
            <section
                aria-label="Ajouter une spécialité"
                className="flex flex-col gap-2"
            >
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    Ajouter une spécialité au catalogue
                </p>
                <form
                    onSubmit={event => {
                        event.preventDefault()
                        void handleAdd()
                    }}
                    className="flex gap-2"
                >
                    <div className="relative min-w-0 flex-1">
                        <Stethoscope
                            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden="true"
                        />
                        <Input
                            value={newName}
                            onChange={event =>
                                setNewName(event.target.value.slice(0, NAME_MAX))
                            }
                            placeholder="Ex. : Dermatologie, Neurologie…"
                            aria-label="Nom de la nouvelle spécialité"
                            className="h-11 rounded-full border-border bg-card pl-10 text-sm shadow-sm"
                        />
                    </div>
                    <Button
                        type="submit"
                        disabled={adding || newName.trim().length < 2}
                        className="h-11 shrink-0 gap-1.5 rounded-full px-4 text-sm font-bold"
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
            </section>

            {/* ——— Recherche client (pillée, pattern Patients) ——— */}
            <div className="relative">
                <Search
                    className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                />
                <Input
                    type="search"
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Filtrer par titre de spécialité…"
                    aria-label="Filtrer par titre de spécialité"
                    className="h-11 rounded-full border-border bg-card pl-10 pr-10 text-sm shadow-sm"
                />
                {search !== "" && (
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setSearch("")}
                        aria-label="Effacer la recherche"
                        className="absolute right-1.5 top-1/2 size-8 -translate-y-1/2 rounded-full"
                    >
                        <X className="size-4" aria-hidden="true" />
                    </Button>
                )}
            </div>

            {loading && specialties === null ? (
                <ul
                    className="grid gap-3"
                    aria-busy="true"
                    aria-label="Chargement du catalogue"
                >
                    {[0, 1, 2].map(index => (
                        <li key={index}>
                            <Skeleton
                                className="h-[132px] rounded-2xl"
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
            ) : (
                specialties !== null && (
                    <>
                        {/* ——— Chips d'état + tri (maquette) ——— */}
                        <div className="flex items-center gap-2">
                            <div
                                role="group"
                                aria-label="Filtrer par état"
                                className="-mx-4 flex min-w-0 flex-1 gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                            >
                                {STATUS_FILTERS.map(filter => {
                                    const active =
                                        statusFilter === filter.id
                                    const count =
                                        filter.id === "all"
                                            ? stats.total
                                            : filter.id === "active"
                                              ? stats.activeCount
                                              : stats.inactiveCount
                                    return (
                                        <button
                                            key={filter.id}
                                            type="button"
                                            onClick={() =>
                                                setStatusFilter(filter.id)
                                            }
                                            aria-pressed={active}
                                            className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors ${
                                                active
                                                    ? "border-transparent bg-foreground text-background"
                                                    : "border-border bg-card text-foreground hover:bg-muted/60"
                                            }`}
                                        >
                                            {filter.label}
                                            <span
                                                className={`rounded-full px-1.5 py-px text-[10px] font-bold ${
                                                    active
                                                        ? "bg-background/20"
                                                        : "bg-muted text-muted-foreground"
                                                }`}
                                            >
                                                {count}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                            <Select
                                value={sortMode}
                                onValueChange={value =>
                                    setSortMode(value as SortMode)
                                }
                            >
                                <SelectTrigger
                                    aria-label="Ordre d'affichage du catalogue"
                                    className="h-8 w-auto shrink-0 gap-1 rounded-full border-primary/20 bg-primary/10 px-3 text-[11px] font-bold text-primary"
                                >
                                    <ArrowDownUp
                                        className="size-3.5"
                                        aria-hidden="true"
                                    />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="sortOrder">
                                        Ordre d&apos;affichage
                                    </SelectItem>
                                    <SelectItem value="name">
                                        Nom (A-Z)
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* ——— Catalogue ——— */}
                        {stats.total === 0 ? (
                            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-muted/40 p-8 text-center">
                                <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                    <Stethoscope
                                        className="size-6"
                                        aria-hidden="true"
                                    />
                                </span>
                                <div>
                                    <p className="font-bold">Catalogue vide</p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Ajoutez les spécialités proposées à vos
                                        patients.
                                    </p>
                                </div>
                            </div>
                        ) : visibleSpecialties.length === 0 ? (
                            <p className="rounded-2xl border border-dashed bg-muted/40 p-5 text-center text-sm text-muted-foreground">
                                Aucune spécialité ne correspond à ce filtre.
                            </p>
                        ) : (
                            <ul className="grid gap-3">
                                {visibleSpecialties.map(specialty => {
                                    const isEditing =
                                        editingId === specialty.id
                                    const busy = busyId === specialty.id
                                    return (
                                        <li
                                            key={specialty.id}
                                            className="rounded-2xl border bg-card p-4 shadow-sm"
                                        >
                                            <div className="flex items-center gap-3">
                                                {/* Grip décoratif — aucune
                                                    API de réordonnancement :
                                                    le drag & drop n'est pas
                                                    implémenté. */}
                                                <GripVertical
                                                    className="size-4 shrink-0 text-muted-foreground/50"
                                                    aria-hidden="true"
                                                />
                                                <span
                                                    className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${avatarClass(specialty.name)}`}
                                                    aria-hidden="true"
                                                >
                                                    <Stethoscope
                                                        className="size-4.5"
                                                        aria-hidden="true"
                                                    />
                                                </span>
                                                {isEditing ? (
                                                    <form
                                                        onSubmit={event => {
                                                            event.preventDefault()
                                                            void patchSpecialty(
                                                                specialty,
                                                                {
                                                                    name: editName,
                                                                }
                                                            ).then(ok => {
                                                                if (ok)
                                                                    setEditingId(
                                                                        null
                                                                    )
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
                                                                editName.trim()
                                                                    .length < 2
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
                                                                setEditingId(
                                                                    null
                                                                )
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
                                                        <div className="flex items-center justify-between gap-2">
                                                            {/* Nom wrap 1–2
                                                                lignes (pas de
                                                                truncate :
                                                                anti-
                                                                débordement
                                                                UI-PATIENTS-
                                                                1). */}
                                                            <p className="min-w-0 text-sm font-bold leading-tight">
                                                                {
                                                                    specialty.name
                                                                }
                                                            </p>
                                                            <div className="flex shrink-0 items-center gap-2">
                                                                <Badge
                                                                    className={`rounded-full px-2.5 text-[11px] font-bold ${
                                                                        specialty.isActive
                                                                            ? "bg-success/15 text-success-foreground dark:text-success hover:bg-success/15"
                                                                            : "bg-muted text-muted-foreground hover:bg-muted"
                                                                    }`}
                                                                    aria-label={
                                                                        specialty.isActive
                                                                            ? "Spécialité active"
                                                                            : "Spécialité désactivée"
                                                                    }
                                                                >
                                                                    {
                                                                        specialty.isActive
                                                                            ? "Active"
                                                                            : "Inactive"
                                                                    }
                                                                </Badge>
                                                                <Switch
                                                                    checked={
                                                                        specialty.isActive
                                                                    }
                                                                    onCheckedChange={() =>
                                                                        void patchSpecialty(
                                                                            specialty,
                                                                            {
                                                                                isActive:
                                                                                    !specialty.isActive,
                                                                            }
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        busy
                                                                    }
                                                                    aria-label={
                                                                        specialty.isActive
                                                                            ? `Désactiver ${specialty.name}`
                                                                            : `Activer ${specialty.name}`
                                                                    }
                                                                />
                                                            </div>
                                                        </div>
                                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                                            Ordre
                                                            d&apos;affichage :{" "}
                                                            {
                                                                specialty.sortOrder
                                                            }
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            {!isEditing && (
                                                <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        disabled={busy}
                                                        onClick={() => {
                                                            setEditingId(
                                                                specialty.id
                                                            )
                                                            setEditName(
                                                                specialty.name
                                                            )
                                                        }}
                                                        className="h-9 gap-1.5 rounded-lg text-xs font-semibold"
                                                    >
                                                        <Pencil
                                                            className="size-3.5"
                                                            aria-hidden="true"
                                                        />
                                                        Renommer
                                                    </Button>
                                                    {/* Redondant avec le
                                                        Switch (maquette
                                                        affiche les deux) —
                                                        même handler PATCH. */}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        disabled={busy}
                                                        onClick={() =>
                                                            void patchSpecialty(
                                                                specialty,
                                                                {
                                                                    isActive:
                                                                        !specialty.isActive,
                                                                }
                                                            )
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
                                                            setConfirmDelete(
                                                                specialty
                                                            )
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
                        )}
                    </>
                )
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
