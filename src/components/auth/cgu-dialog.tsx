"use client";

// Conditions Générales d'Utilisation — vue modale (Dialog).
// Ouverte depuis le consentement de l'étape Sécurité de l'inscription :
// un Dialog (et non une vue dédiée) préserve l'état du wizard (nom, téléphone,
// zone, mots de passe) quand l'utilisateur consulte les CGU puis les referme.
import { ScrollText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const CGU_SECTIONS: { title: string; body: string }[] = [
  {
    title: "1. Objet du service",
    body: "MondocPro est une plateforme digitale de prise de rendez-vous médicaux au cabinet ou à domicile, d'épargne santé (Tokens) et de sensibilisation à la santé, opérant à Abidjan (Yopougon, Songon, PK22, N'Dotré) en Côte d'Ivoire. Les présentes Conditions Générales encadrent l'accès et l'utilisation de la plateforme par les patients.",
  },
  {
    title: "2. Création et sécurité du compte",
    body: "Le compte patient est créé à partir de votre nom complet, de votre numéro de téléphone (+225) et d'un mot de passe de 8 caractères minimum. Il est strictement personnel : ne le partagez pas. Vous vous engagez à fournir des informations exactes et à jour. Vos mots de passe sont chiffrés (bcrypt) et vos sessions protégées ; en cas d'utilisation suspectée, changez votre mot de passe via « Mot de passe oublié ? ».",
  },
  {
    title: "3. Rendez-vous et disponibilité",
    body: "Les rendez-vous sont confirmés sous réserve de la disponibilité des médecins, infirmiers et structures partenaires de votre zone. Un rendez-vous peut être annulé ou reprogrammé par le professionnel en cas d'imprévu ; MondocPro vous en informera par les canaux disponibles (SMS, notification).",
  },
  {
    title: "4. Données de santé et confidentialité",
    body: "Vos données, y compris les informations liées à votre suivi médical, sont traitées de manière confidentielle, sécurisée et uniquement à des fins de prise en charge sanitaire. Elles ne sont jamais revendues. Vous disposez d'un droit d'accès, de rectification et de suppression de vos données sur simple demande au support.",
  },
  {
    title: "5. Limites et urgences",
    body: "MondocPro est un service d'intermédiation : il ne remplace en aucun cas une consultation, un diagnostic ou un avis médical. En cas d'urgence vitale, appelez immédiatement le SAMU au 185 ou rendez-vous dans la structure sanitaire la plus proche.",
  },
  {
    title: "6. Évolution des conditions",
    body: "MondocPro peut faire évoluer les présentes conditions pour suivre l'amélioration du service ou ses obligations légales. La version applicable est celle affichée au moment de votre utilisation ; toute modification substantielle vous sera signalée.",
  },
  {
    title: "7. Droit applicable et contact",
    body: "Les présentes conditions sont soumises au droit ivoirien. Pour toute question : support@mondocpro.ci — Abidjan, Côte d'Ivoire. Dernière mise à jour : octobre 2026.",
  },
];

export function CguDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-hidden rounded-2xl p-0 sm:max-w-lg">
        <DialogHeader className="gap-1.5 border-b bg-primary/5 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-primary-dark">
            <ScrollText className="size-5" aria-hidden="true" />
            Conditions Générales
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            MondocPro — votre santé en main. Veuillez lire ces conditions avant
            de créer votre compte.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4 max-h-[calc(85vh-9rem)]">
          {CGU_SECTIONS.map((section) => (
            <section key={section.title} className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{section.body}</p>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
