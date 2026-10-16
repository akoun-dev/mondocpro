// Schémas de validation zod — FEATURE-SENSO phase 2 (rédaction Médecin Chef).
// Source unique partagée par le formulaire admin (client) et les routes
// /api/admin/sensibilisations (serveur) — même convention que auth-schemas.ts.
// Les bornes suivent le modèle Prisma : title VarChar(120), body Text (borne
// éditoriale 8 000 caractères) ; zones = liste fermée des secteurs couverts.
import { z } from "zod";

import { ZONES } from "@/lib/auth-schemas";

export const SENSIBILISATION_CATEGORIES = ["ADVICE", "ALERT"] as const;

export type SensibilisationCategoryValue =
    (typeof SENSIBILISATION_CATEGORIES)[number];

export const SENSIBILISATION_CATEGORY_LABELS: Record<
    SensibilisationCategoryValue,
    string
> = {
    ADVICE: "Conseil santé",
    ALERT: "Alerte santé",
};

export const SENSIBILISATION_TITLE_MIN = 4;
export const SENSIBILISATION_TITLE_MAX = 120;
export const SENSIBILISATION_BODY_MIN = 10;
export const SENSIBILISATION_BODY_MAX = 8000;

const titleSchema = z
    .string({ message: "Titre requis" })
    .trim()
    .min(
        SENSIBILISATION_TITLE_MIN,
        `Le titre doit contenir au moins ${SENSIBILISATION_TITLE_MIN} caractères`,
    )
    .max(
        SENSIBILISATION_TITLE_MAX,
        `Le titre ne peut pas dépasser ${SENSIBILISATION_TITLE_MAX} caractères`,
    );

const bodySchema = z
    .string({ message: "Contenu requis" })
    .trim()
    .min(
        SENSIBILISATION_BODY_MIN,
        `Le contenu doit contenir au moins ${SENSIBILISATION_BODY_MIN} caractères`,
    )
    .max(
        SENSIBILISATION_BODY_MAX,
        `Le contenu ne peut pas dépasser ${SENSIBILISATION_BODY_MAX} caractères`,
    );

const categorySchema = z.enum(SENSIBILISATION_CATEGORIES, {
    message: "Catégorie invalide",
});

// Zones ciblées — liste vide = publié pour TOUTES les zones (même convention
// que le fil patients) ; dédupliquée côté service.
const zonesSchema = z.array(z.enum(ZONES), {
    message: "Zone cible invalide",
});

// Création : tous les champs requis (le formulaire admin n'a pas de brouillon).
export const createSensibilisationSchema = z.object({
    title: titleSchema,
    body: bodySchema,
    category: categorySchema,
    zones: zonesSchema,
});

// Édition : PATCH partiel — au moins un champ doit être fourni.
export const updateSensibilisationSchema = z
    .object({
        title: titleSchema.optional(),
        body: bodySchema.optional(),
        category: categorySchema.optional(),
        zones: zonesSchema.optional(),
    })
    .refine((d) => Object.values(d).some((v) => v !== undefined), {
        message: "Aucune modification fournie",
    });

export type CreateSensibilisationInput = z.infer<
    typeof createSensibilisationSchema
>;
export type UpdateSensibilisationInput = z.infer<
    typeof updateSensibilisationSchema
>;
