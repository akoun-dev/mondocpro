"use client"

// Vue « Missions & Dispatch » du Médecin Chef — Task 35 (FEATURE-NURSE).
// Supervision complète du cycle des soins à domicile depuis l'interface :
//   1. File « À affecter » — RDV à domicile actifs sans mission ; l'affectation
//      d'un infirmier couvrant la zone notifie immédiatement l'intéressé
//      (MISSION_ASSIGNED, côté serveur src/lib/nurse.ts) ;
//   2. Missions en cours — suivi des statuts (à traiter / acceptée / en cours
//      / terminée / annulée), réaffectation d'une mission non terminée
//      (remise à ASSIGNED + nouvelle notification) et lecture du compte rendu.
// Un seul appel API : GET /api/admin/missions (contrat étendu Task 35 :
// { missions, dispatchQueue, nurses }) — même gabarit visuel que RechargesView.
import { useCallback, useEffect, useState } from "react"
import {
    ClipboardCheck,
    ClipboardList,
    Loader2,
    MapPin,
    Phone,
    RefreshCw,
    Send,
    UserRoundSearch,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/hooks/use-toast"
import {
    MISSION_STATUS_CLASSES,
    MISSION_STATUS_LABELS,
    type AdminMissionBoard,
    type DispatchQueueItem,
    type MissionDto,
    type MissionStatus,
    type NurseDirectoryItem,
} from "@/lib/nurse-schemas"
import { ZONE_LABELS } from "@/lib/auth-schemas"
import { formatPhoneDisplay } from "@/lib/phone"
import { relativePublishedLabel } from "@/lib/datetime"


// « vendredi 9 octobre à 10:00 » — heure Abidjan = UTC+0 (même convention que
// la vue infirmier : l'heure affichée est l'heure locale du patient).
function formatSlot(value: string) {
    return new Intl.DateTimeFormat("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Abidjan",
    }).format(new Date(value))
}

// Infirmiers couvrant la zone du RDV d'abord (l'API refuse une affectation
// hors zone — la contrainte est guidée côté UI pour éviter l'erreur 400).
function nursesForZone(
    nurses: NurseDirectoryItem[],
    zone: string
): NurseDirectoryItem[] {
    const same = nurses.filter(n => n.zone === zone)
    const others = nurses.filter(n => n.zone !== zone)
    return [...same, ...others]
}

// Dialog de sélection d'infirmier — partagé dispatch / réaffectation.
// Déclaré hors de AdminMissionsView : sinon React le démonte et le remonte à
// chaque render, ce qui fait clignoter le Select pendant la saisie.
function NursePicker({
    nurses,
    zone,
    value,
    onChange,
    error,
}: {
    nurses: NurseDirectoryItem[]
    zone: string
    value: string
    onChange: (id: string) => void
    error?: string
}) {
    const candidates = nursesForZone(nurses, zone)
    return (
        <div className="flex flex-col gap-1.5">
            <Label>
                Infirmier(e) — zone{" "}
                {ZONE_LABELS[zone as keyof typeof ZONE_LABELS] ?? zone}
            </Label>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger
                    aria-invalid={error ? true : undefined}
                    className="w-full"
                >
                    <SelectValue placeholder="Sélectionner un(e) infirmier(ère)" />
                </SelectTrigger>
                <SelectContent>
                    {candidates.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                            Aucun(e) infirmier(ère) enregistré(e).
                        </div>
                    ) : (
                        candidates.map(nurse => (
                            <SelectItem key={nurse.id} value={nurse.id}>
                                {nurse.fullName}
                                {nurse.zone !== zone
                                    ? ` — autre zone (${ZONE_LABELS[nurse.zone as keyof typeof ZONE_LABELS] ?? nurse.zone})`
                                    : ""}
                            </SelectItem>
                        ))
                    )}
                </SelectContent>
            </Select>
            {candidates.some(n => n.zone !== zone) && (
                <p className="text-xs text-muted-foreground">
                    L&apos;infirmier(e) doit couvrir la zone du rendez-vous —
                    les autres zones sont indiquées entre parenthèses et seront
                    refusées par le serveur.
                </p>
            )}
            {error ? (
                <p
                    className="text-xs font-medium text-destructive"
                    role="alert"
                >
                    {error}
                </p>
            ) : null}
        </div>
    )
}

export function AdminMissionsView() {
    const [board, setBoard] = useState<AdminMissionBoard | null>(null)
    const [loadError, setLoadError] = useState(false)
    const [busyId, setBusyId] = useState<string | null>(null)

    // Dispatch : RDV ciblé + infirmier sélectionné dans le dialog.
    const [dispatchTarget, setDispatchTarget] =
        useState<DispatchQueueItem | null>(null)
    const [dispatchNurseId, setDispatchNurseId] = useState<string>("")
    const [dispatchError, setDispatchError] = useState<string | undefined>(
        undefined
    )

    // Réaffectation : mission ciblée + nouvel infirmier.
    const [reassignTarget, setReassignTarget] = useState<MissionDto | null>(
        null
    )
    const [reassignNurseId, setReassignNurseId] = useState<string>("")
    const [reassignError, setReassignError] = useState<string | undefined>(
        undefined
    )

    const loadAll = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/missions", {
                cache: "no-store",
            })
            if (!res.ok) throw new Error()
            const body = (await res.json()) as AdminMissionBoard
            setBoard(body)
            setLoadError(false)
        } catch {
            setLoadError(true)
        }
    }, [])

    useEffect(() => {
        void loadAll()
    }, [loadAll])

    function openDispatch(item: DispatchQueueItem) {
        setDispatchTarget(item)
        setDispatchNurseId("")
        setDispatchError(undefined)
    }

    function openReassign(mission: MissionDto) {
        setReassignTarget(mission)
        setReassignNurseId("")
        setReassignError(undefined)
    }

    async function submitDispatch(event: React.FormEvent) {
        event.preventDefault()
        if (!dispatchTarget) return
        if (!dispatchNurseId) {
            setDispatchError("Sélectionnez un infirmier à affecter")
            return
        }
        setBusyId(dispatchTarget.id)
        try {
            const res = await fetch("/api/admin/missions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    appointmentId: dispatchTarget.id,
                    nurseId: dispatchNurseId,
                }),
            })
            if (res.ok) {
                const nurse = board?.nurses.find(n => n.id === dispatchNurseId)
                toast({
                    title: "Mission affectée",
                    description: `${nurse?.fullName ?? "L'infirmier"} a été notifié(e) — la mission apparaît dans son onglet Missions.`,
                })
                setDispatchTarget(null)
                await loadAll()
                return
            }
            const body = (await res.json().catch(() => ({}))) as {
                error?: string
            }
            setDispatchError(
                body.error ?? "Affectation impossible — réessayez."
            )
        } catch {
            setDispatchError(
                "Impossible de contacter le serveur. Vérifiez votre connexion internet puis réessayez."
            )
        } finally {
            setBusyId(null)
        }
    }

    async function submitReassign(event: React.FormEvent) {
        event.preventDefault()
        if (!reassignTarget) return
        if (!reassignNurseId) {
            setReassignError("Sélectionnez le nouvel infirmier")
            return
        }
        setBusyId(reassignTarget.id)
        try {
            const res = await fetch(
                `/api/admin/missions/${reassignTarget.id}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ nurseId: reassignNurseId }),
                }
            )
            if (res.ok) {
                const nurse = board?.nurses.find(n => n.id === reassignNurseId)
                toast({
                    title: "Mission réaffectée",
                    description: `${nurse?.fullName ?? "Le nouvel infirmier"} a été notifié(e) — la mission lui est désormais assignée.`,
                })
                setReassignTarget(null)
                await loadAll()
                return
            }
            const body = (await res.json().catch(() => ({}))) as {
                error?: string
            }
            setReassignError(
                body.error ?? "Réaffectation impossible — réessayez."
            )
        } catch {
            setReassignError(
                "Impossible de contacter le serveur. Vérifiez votre connexion internet puis réessayez."
            )
        } finally {
            setBusyId(null)
        }
    }

    return (
        <div className="flex flex-col gap-5">
            {/* Titre + sous-titre : rendus dans le header de l'app (helper
                viewHeading). Seule l'action de rafraîchissement reste ici,
                alignée à droite. Le retour est assuré par le bouton système
                (Capacitor) via l'historique des onglets. */}
            <div className="flex justify-end">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void loadAll()}
                    aria-label="Rafraîchir les missions"
                    className="size-9 shrink-0 rounded-full"
                >
                    <RefreshCw className="size-4" aria-hidden="true" />
                </Button>
            </div>

            {loadError && board === null ? (
                <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
                    <p className="text-sm font-medium">
                        Impossible de charger les missions.
                    </p>
                    <Button
                        variant="outline"
                        onClick={() => void loadAll()}
                        className="mt-4 h-10 gap-2 rounded-xl text-sm font-semibold"
                    >
                        Réessayer
                    </Button>
                </div>
            ) : board === null ? (
                <ul
                    className="grid gap-3"
                    aria-busy="true"
                    aria-label="Chargement des missions"
                >
                    {[0, 1].map(index => (
                        <li key={index}>
                            <Skeleton
                                className="h-[110px] rounded-2xl"
                                aria-hidden="true"
                            />
                        </li>
                    ))}
                </ul>
            ) : (
                <>
                    {/* ——— File « à affecter » — RDV domicile sans mission ——— */}
                    <section aria-labelledby="dispatch-queue">
                        <h3
                            id="dispatch-queue"
                            className="mb-2.5 text-[15px] font-bold tracking-tight"
                        >
                            À affecter{" "}
                            {board.dispatchQueue.length > 0 && (
                                <Badge className="ml-1 bg-warning text-warning-foreground">
                                    {board.dispatchQueue.length}
                                </Badge>
                            )}
                        </h3>
                        {board.dispatchQueue.length === 0 ? (
                            <p className="rounded-2xl border border-dashed bg-muted/40 p-5 text-center text-sm text-muted-foreground">
                                Aucune consultation à domicile en attente
                                d&apos;affectation.
                            </p>
                        ) : (
                            <ul className="grid gap-3">
                                {board.dispatchQueue.map(item => (
                                    <li
                                        key={item.id}
                                        className="rounded-2xl border bg-card p-4 shadow-sm"
                                    >
                                        <div className="flex flex-wrap items-start gap-3">
                                            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                                <ClipboardList
                                                    className="size-5"
                                                    aria-hidden="true"
                                                />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-bold">
                                                    {item.patientName}
                                                </p>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    <span
                                                        suppressHydrationWarning
                                                    >
                                                        {formatSlot(
                                                            item.scheduledAt
                                                        )}
                                                    </span>{" "}
                                                    ·{" "}
                                                    {ZONE_LABELS[
                                                        item.zone as keyof typeof ZONE_LABELS
                                                    ] ?? item.zone}
                                                </p>
                                                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                                    {item.specialtyName ??
                                                        "Consultation"}
                                                    {item.tokensReserved > 0
                                                        ? ` · ${item.tokensReserved} Token${item.tokensReserved > 1 ? "s" : ""} réservé${item.tokensReserved > 1 ? "s" : ""}`
                                                        : ""}
                                                </p>
                                            </div>
                                            {/* Le badge passe sous le texte sur mobile : sur 390 px il
                          sinon écrase le nom du patient. */}
                                            <Badge
                                                className="mt-0.5 shrink-0 self-start bg-warning/15 text-warning-foreground sm:mt-0"
                                                aria-label="Statut : rendez-vous à affecter"
                                            >
                                                À dispatcher
                                            </Badge>
                                        </div>
                                        {item.reason && (
                                            <p className="mt-2.5 rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
                                                Motif : {item.reason}
                                            </p>
                                        )}
                                        <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
                                            <Button
                                                size="sm"
                                                disabled={busyId === item.id}
                                                onClick={() =>
                                                    openDispatch(item)
                                                }
                                                className="h-9 w-full flex-1 gap-1.5 rounded-xl text-xs font-bold"
                                            >
                                                {busyId === item.id ? (
                                                    <Loader2
                                                        className="size-4 animate-spin"
                                                        aria-hidden="true"
                                                    />
                                                ) : (
                                                    <UserRoundSearch
                                                        className="size-4"
                                                        aria-hidden="true"
                                                    />
                                                )}
                                                Affecter un(e) infirmier(ère)
                                            </Button>
                                            {item.patientPhone && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    asChild
                                                    className="h-9 w-full gap-1.5 rounded-xl border-border text-xs font-bold sm:w-auto"
                                                >
                                                    <a
                                                        href={`tel:${item.patientPhone}`}
                                                    >
                                                        <Phone
                                                            className="size-4"
                                                            aria-hidden="true"
                                                        />
                                                        Appeler
                                                    </a>
                                                </Button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    {/* ——— Missions affectées (suivi + réaffectation + CR) ——— */}
                    <section aria-labelledby="missions-list">
                        <h3
                            id="missions-list"
                            className="mb-2.5 text-[15px] font-bold tracking-tight"
                        >
                            Missions{" "}
                            {board.missions.length > 0 && (
                                <Badge variant="secondary" className="ml-1">
                                    {board.missions.length}
                                </Badge>
                            )}
                        </h3>
                        {board.missions.length === 0 ? (
                            <p className="rounded-2xl border border-dashed bg-muted/40 p-5 text-center text-sm text-muted-foreground">
                                Aucune mission pour le moment — affectez
                                d&apos;abord une consultation à domicile.
                            </p>
                        ) : (
                            <ul className="grid gap-3">
                                {board.missions.map(mission => (
                                    <li
                                        key={mission.id}
                                        className="rounded-2xl border bg-card p-4 shadow-sm"
                                    >
                                        <div className="flex flex-wrap items-start gap-3">
                                            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                                <ClipboardCheck
                                                    className="size-5"
                                                    aria-hidden="true"
                                                />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-bold">
                                                    {mission.patient
                                                        ?.fullName ??
                                                        "Patient"}{" "}
                                                    <span className="font-medium text-muted-foreground">
                                                        →{" "}
                                                        {mission.nurse
                                                            ?.fullName ??
                                                            "Infirmier"}
                                                    </span>
                                                </p>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    <span
                                                        suppressHydrationWarning
                                                    >
                                                        {formatSlot(
                                                            mission.scheduledAt
                                                        )}
                                                    </span>{" "}
                                                    ·{" "}
                                                    {mission.type === "DOMICILE"
                                                        ? "À domicile"
                                                        : "Au cabinet"}{" "}
                                                    ·{" "}
                                                    {ZONE_LABELS[
                                                        mission.zone as keyof typeof ZONE_LABELS
                                                    ] ?? mission.zone}
                                                </p>
                                                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                                    {mission.appointment
                                                        ?.specialty?.name ??
                                                        "Consultation"}{" "}
                                                    · affectée{" "}
                                                    <span
                                                        suppressHydrationWarning
                                                    >
                                                        {relativePublishedLabel(
                                                            mission.assignedAt
                                                        )}
                                                    </span>
                                                </p>
                                            </div>
                                            {/* Badge sous le texte sur mobile (flex-wrap du parent). */}
                                            <Badge
                                                className={`mt-0.5 shrink-0 self-start sm:mt-0 ${
                                                    MISSION_STATUS_CLASSES[
                                                        mission.status as MissionStatus
                                                    ] ??
                                                    "bg-muted text-muted-foreground"
                                                }`}
                                                aria-label={`Statut : ${MISSION_STATUS_LABELS[mission.status as MissionStatus] ?? mission.status}`}
                                            >
                                                {MISSION_STATUS_LABELS[
                                                    mission.status as MissionStatus
                                                ] ?? mission.status}
                                            </Badge>
                                        </div>
                                        {mission.report && (
                                            <details className="mt-2.5 rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
                                                <summary className="cursor-pointer text-xs font-semibold text-foreground">
                                                    Compte rendu du{" "}
                                                    <span
                                                        suppressHydrationWarning
                                                    >
                                                        {formatSlot(
                                                            mission.report
                                                                .createdAt
                                                        )}
                                                    </span>
                                                </summary>
                                                <p className="mt-1.5 leading-relaxed">
                                                    <MapPin
                                                        className="mr-1 inline size-3 -translate-y-px"
                                                        aria-hidden="true"
                                                    />
                                                    {
                                                        mission.report
                                                            .observations
                                                    }
                                                </p>
                                                {mission.report
                                                    .actionsTaken && (
                                                    <p className="mt-1 leading-relaxed">
                                                        <strong className="text-foreground">
                                                            Actions :
                                                        </strong>{" "}
                                                        {
                                                            mission.report
                                                                .actionsTaken
                                                        }
                                                    </p>
                                                )}
                                                {mission.report
                                                    .recommendations && (
                                                    <p className="mt-1 leading-relaxed">
                                                        <strong className="text-foreground">
                                                            Recommandations :
                                                        </strong>{" "}
                                                        {
                                                            mission.report
                                                                .recommendations
                                                        }
                                                    </p>
                                                )}
                                            </details>
                                        )}
                                        {!["COMPLETED", "CANCELLED"].includes(
                                            mission.status
                                        ) && (
                                            <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={
                                                        busyId === mission.id
                                                    }
                                                    onClick={() =>
                                                        openReassign(mission)
                                                    }
                                                    className="h-9 w-full flex-1 gap-1.5 rounded-xl text-xs font-bold"
                                                >
                                                    <Send
                                                        className="size-4"
                                                        aria-hidden="true"
                                                    />
                                                    Réaffecter
                                                </Button>
                                                {mission.patient?.phone && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        asChild
                                                        className="h-9 w-full gap-1.5 rounded-xl text-xs font-bold text-muted-foreground sm:w-auto"
                                                    >
                                                        <a
                                                            href={`tel:${mission.patient.phone}`}
                                                        >
                                                            <Phone
                                                                className="size-4"
                                                                aria-hidden="true"
                                                            />
                                                            Patient
                                                        </a>
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </>
            )}

            {/* Dialog dispatch — POST /api/admin/missions */}
            <Dialog
                open={Boolean(dispatchTarget)}
                onOpenChange={open => {
                    if (!open) setDispatchTarget(null)
                }}
            >
                {/* max-h + scroll : la liste d'infirmiers peut dépasser la hauteur
            disponible sur mobile une fois le clavier virtuel ouvert. */}
                <DialogContent className="max-h-[90dvh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Affecter la mission</DialogTitle>
                        <DialogDescription>
                            {dispatchTarget && (
                                <>
                                    {dispatchTarget.patientName} ·{" "}
                                    {ZONE_LABELS[
                                        dispatchTarget.zone as keyof typeof ZONE_LABELS
                                    ] ?? dispatchTarget.zone}{" "}
                                    ·{" "}
                                    <span suppressHydrationWarning>
                                        {formatSlot(dispatchTarget.scheduledAt)}
                                    </span>
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <form
                        onSubmit={submitDispatch}
                        className="flex flex-col gap-4"
                    >
                        <NursePicker
                            nurses={board?.nurses ?? []}
                            zone={dispatchTarget?.zone ?? ""}
                            value={dispatchNurseId}
                            onChange={id => {
                                setDispatchNurseId(id)
                                setDispatchError(undefined)
                            }}
                            error={dispatchError}
                        />
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setDispatchTarget(null)}
                                disabled={busyId !== null}
                            >
                                Annuler
                            </Button>
                            <Button type="submit" disabled={busyId !== null}>
                                {busyId !== null && (
                                    <Loader2
                                        className="size-4 animate-spin"
                                        aria-hidden="true"
                                    />
                                )}
                                Affecter et notifier
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Dialog réaffectation — PATCH /api/admin/missions/:id */}
            <Dialog
                open={Boolean(reassignTarget)}
                onOpenChange={open => {
                    if (!open) setReassignTarget(null)
                }}
            >
                <DialogContent className="max-h-[90dvh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Réaffecter la mission</DialogTitle>
                        <DialogDescription>
                            {reassignTarget && (
                                <>
                                    {reassignTarget.patient?.fullName ??
                                        "Patient"}{" "}
                                    · mission actuellement «{" "}
                                    {MISSION_STATUS_LABELS[
                                        reassignTarget.status as MissionStatus
                                    ] ?? reassignTarget.status}
                                    » — le nouvel infirmier sera notifié et la
                                    mission repassera « À traiter ».
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <form
                        onSubmit={submitReassign}
                        className="flex flex-col gap-4"
                    >
                        <NursePicker
                            nurses={board?.nurses ?? []}
                            zone={reassignTarget?.zone ?? ""}
                            value={reassignNurseId}
                            onChange={id => {
                                setReassignNurseId(id)
                                setReassignError(undefined)
                            }}
                            error={reassignError}
                        />
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setReassignTarget(null)}
                                disabled={busyId !== null}
                            >
                                Annuler
                            </Button>
                            <Button type="submit" disabled={busyId !== null}>
                                {busyId !== null && (
                                    <Loader2
                                        className="size-4 animate-spin"
                                        aria-hidden="true"
                                    />
                                )}
                                Réaffecter et notifier
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
