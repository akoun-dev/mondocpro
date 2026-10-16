"use client";

// Lecture d'une sensibilisation — dialog article (maquette PO 2026-10) :
// pastille de catégorie, zones ciblées, corps intégral et écoute vocale.
import {
  TriangleAlert,
  HeartPulse,
  MapPin,
  Volume2,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSpeech } from "@/hooks/use-speech";
import { ZONE_LABELS } from "@/lib/auth-schemas";
import {
  estimatedListenMinutes,
  relativePublishedLabel,
} from "@/lib/datetime";
import type { SensibilisationDto } from "@/lib/sensibilisations";

type Props = {
  sensibilisation: SensibilisationDto | null;
  onClose: () => void;
};

export function SensibilisationDialog({ sensibilisation, onClose }: Props) {
  const speechText = sensibilisation
    ? `${sensibilisation.title}. ${sensibilisation.body}`
    : null;
  const { speaking, supported, toggle } = useSpeech(speechText);

  return (
    <Dialog
      open={sensibilisation !== null}
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl sm:max-w-lg">
        {sensibilisation && (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      sensibilisation.category === "ALERT"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-success-light text-success-foreground"
                  }`}
                >
                  {sensibilisation.category === "ALERT" ? (
                    <TriangleAlert className="size-3.5" aria-hidden="true" />
                  ) : (
                    <HeartPulse className="size-3.5" aria-hidden="true" />
                  )}
                  {sensibilisation.category === "ALERT"
                    ? "Alerte Santé"
                    : "Conseil Santé"}
                </span>
                {sensibilisation.zones.length > 0 ? (
                  sensibilisation.zones.map(zone => (
                    <span
                      key={zone}
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                    >
                      <MapPin className="size-3" aria-hidden="true" />
                      {ZONE_LABELS[zone]}
                    </span>
                  ))
                ) : (
                  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    Toutes les zones
                  </span>
                )}
              </div>
              <DialogTitle className="text-left text-lg font-bold leading-snug">
                {sensibilisation.title}
              </DialogTitle>
              <DialogDescription className="text-left text-xs" suppressHydrationWarning>
                Publié {relativePublishedLabel(sensibilisation.publishedAt).toLowerCase()}
              </DialogDescription>
            </DialogHeader>

            <div className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
              {sensibilisation.body}
            </div>

            {supported && (
              <Button
                variant="outline"
                onClick={toggle}
                aria-pressed={speaking}
                className="mt-1 h-10 gap-2 rounded-xl text-sm font-semibold"
              >
                {speaking ? (
                  <>
                    <Square className="size-4" aria-hidden="true" />
                    Arrêter l'écoute
                  </>
                ) : (
                  <>
                    <Volume2 className="size-4" aria-hidden="true" />
                    Écouter ({estimatedListenMinutes(speechText ?? "")} min)
                  </>
                )}
              </Button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
