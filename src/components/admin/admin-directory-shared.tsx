"use client"

// Briques partagées par les vues admin de l'annuaire (FEATURE-ANNUAIRE-ADMIN) :
// chargement d'une ressource, suspension d'un compte, ligne de compte.
// Vues Patients / Infirmiers + Équipes — un seul endroit pour la logique
// d'appel et le rendu d'une ligne de compte, sinon les trois écrans divergeraient
// sur le libellé du bouton et la couleur du badge.

import { useCallback, useEffect, useState } from "react";
import { Loader2, Phone, ShieldAlert, UserRoundX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { formatPhoneDisplay } from "@/lib/phone";
import { formatDateUTC } from "@/lib/datetime";
import { ZONES, ZONE_LABELS } from "@/lib/auth-schemas";
import {
  ACCOUNT_FILTER,
  ACCOUNT_FILTER_LABELS,
  type AccountFilterValue,
} from "@/lib/admin-users-schemas";

const LOAD_ERROR =
  "Impossible de charger cet annuaire — vérifiez votre connexion puis réessayez.";

/**
 * charge une ressource d'annuaire et la recharge à la demande.
 * `url` change avec les filtres : la ressource est alors rechargée, sans
 * garder l'affichage de la sélection précédente sous un nouveau filtre.
 */
export function useAdminResource<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(url !== null);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    if (url === null) return;
    setLoading(true);
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error();
      setData((await res.json()) as T);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}

/** Construit une query string en ignorant les valeurs par défaut. */
export function adminQuery(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

/** Bloc d'erreur commun — le bouton « Réessayer » reprend le dernier fetch. */
export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
      <p className="text-sm font-medium">{LOAD_ERROR}</p>
      <Button
        variant="outline"
        onClick={onRetry}
        className="mt-4 h-10 gap-2 rounded-xl text-sm font-semibold"
      >
        Réessayer
      </Button>
    </div>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="grid gap-3" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index}>
          <Skeleton className="h-[92px] rounded-2xl" aria-hidden="true" />
        </li>
      ))}
    </ul>
  );
}

/** Sélecteur de zone partagé — « Toutes les zones » par défaut. */
export function ZoneFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (zone: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-10 w-full rounded-xl" aria-label="Filtrer par zone">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Toutes les zones</SelectItem>
        {ZONES.map(zone => (
          <SelectItem key={zone} value={zone}>
            {ZONE_LABELS[zone]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Filtre d'état de compte — Actifs / Suspendus / Tous. */
export function AccountFilterSelect({
  value,
  onChange,
}: {
  value: AccountFilterValue;
  onChange: (value: AccountFilterValue) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-10 w-full rounded-xl" aria-label="Filtrer par état">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ACCOUNT_FILTER.map(filter => (
          <SelectItem key={filter} value={filter}>
            {ACCOUNT_FILTER_LABELS[filter]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ZoneBadge({ zone }: { zone: string }) {
  return (
    <Badge variant="secondary" className="font-normal">
      {ZONE_LABELS[zone as keyof typeof ZONE_LABELS] ?? zone}
    </Badge>
  );
}

/**
 * Confirmation de suspension / réactivation.
 *
 * Le risque est asymétrique et l'interface doit le dire : suspendre coupe
 * l'accès d'un soignant ou d'un patient immédiatement, alors que réactiver ne
 * fait que lui rendre son accès. Le libellé de l'action confirme donc toujours
 * le verbe exact, pas un « Confirmer » ambigu.
 */
export function SuspendAccountDialog({
  target,
  busy,
  error,
  onOpenChange,
  onSubmit,
}: {
  target: { id: string; fullName: string; isActive: boolean } | null;
  busy: boolean;
  error: string | undefined;
  onOpenChange: (open: boolean) => void;
  onSubmit: (isActive: boolean) => void;
}) {
  const suspending = target !== null && target.isActive;
  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {suspending ? (
              <UserRoundX className="size-5 text-destructive" aria-hidden="true" />
            ) : (
              <ShieldAlert className="size-5 text-primary" aria-hidden="true" />
            )}
            {suspending ? "Suspendre le compte" : "Réactiver le compte"}
          </DialogTitle>
          <DialogDescription>
            {suspending ? (
              <>
                <strong>{target?.fullName}</strong> perdra immédiatement l'accès à
                l'application : sessions fermées sur tous ses appareils et
                connexion refusée. Son historique reste conservé et le compte
                peut être réactivé à tout moment.
              </>
            ) : (
              <>
                <strong>{target?.fullName}</strong> pourra de nouveau se
                connecter et utiliser l'application normalement.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="h-10 rounded-xl"
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={() => onSubmit(!suspending)}
            disabled={busy}
            className="h-10 gap-2 rounded-xl font-semibold"
          >
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {suspending ? "Suspendre" : "Réactiver"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Bascule l'état d'un compte (PATCH /api/admin/users/:id).
 * Partagé par les vues Patients et Infirmiers — le message d'erreur du serveur
 * est affiché tel quel : c'est lui qui explique, par exemple, qu'il faut
 * réaffecter les missions en cours avant de pouvoir suspendre.
 */
export function useAccountSuspension(onDone?: () => void | Promise<void>) {
  const [target, setTarget] = useState<{
    id: string;
    fullName: string;
    isActive: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  function open(account: { id: string; fullName: string; isActive: boolean }) {
    setTarget(account);
    setError(undefined);
  }

  async function submit(isActive: boolean) {
    if (!target) return;
    setBusy(true);
    setError(undefined);
    try {
      const res = await fetch(`/api/admin/users/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (res.ok) {
        toast({
          title: isActive ? "Compte réactivé" : "Compte suspendu",
          description: isActive
            ? `${target.fullName} peut de nouveau se connecter.`
            : `${target.fullName} n'a plus accès à l'application.`,
        });
        setTarget(null);
        await onDone?.();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Opération impossible — réessayez.");
    } catch {
      setError(
        "Impossible de contacter le serveur. Vérifiez votre connexion internet puis réessayez.",
      );
    } finally {
      setBusy(false);
    }
  }

  return {
    target,
    busy,
    error,
    open,
    submit,
    setOpen: (open: boolean) => {
      if (!open) {
        setTarget(null);
        setError(undefined);
      }
    },
  };
}

/** Ligne « identité + téléphone » commune aux deux annuaires. */
export function AccountIdentity({
  fullName,
  phone,
  suspended,
}: {
  fullName: string;
  phone: string;
  suspended?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-2 truncate font-semibold">
        {fullName}
        {suspended && (
          <Badge variant="destructive" className="shrink-0 font-normal">
            Suspendu
          </Badge>
        )}
      </p>
      <p className="flex items-center gap-1 text-sm text-muted-foreground">
        <Phone className="size-3.5 shrink-0" aria-hidden="true" />
        {formatPhoneDisplay(phone)}
      </p>
    </div>
  );
}

/** Libellé de zone résolu, avec repli sur la valeur brute. */
export function ZoneLabel({ zone }: { zone: string }) {
  return <>{ZONE_LABELS[zone as keyof typeof ZONE_LABELS] ?? zone}</>;
}

/** Champ de recherche : la saisie est différée côté appelant (debounce). */
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="sr-only" htmlFor="admin-search">
        {label}
      </Label>
      <input
        id="admin-search"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );
}

/** Champ de formulaire étiqueté — utilisé dans les filtres avancés. */
export function FilterField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

/** Compteur de liste affiché dans le titre de section. */
export function CountBadge({ value }: { value: number }) {
  return (
    <Badge variant="secondary" className="font-normal tabular-nums">
      {value}
    </Badge>
  );
}

/** Date courte ou tiret cadratin quand la valeur est absente. */
export function DateOrDash({ value }: { value: string | null }) {
  if (!value) {
    return <span className="text-muted-foreground">—</span>;
  }
  return <>{formatDateUTC(value)}</>;
}