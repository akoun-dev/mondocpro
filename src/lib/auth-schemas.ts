// Schémas de validation zod — FEATURE-AUTH (miroir des contrats API_CONTRACTS.md)
// Inscription : rôle supprimé du contrat public — PATIENT forcé côté serveur
// (décision PO 2026-10 : pas de choix de rôle à l'inscription).
import { z } from "zod";

export const ROLES = ["PATIENT", "INFIRMIER"] as const; // ADMIN = seed uniquement (ADR-004 §5)
export const ZONES = ["YOPOUGON", "SONGON", "PK22", "NDOTRE"] as const;

export const ZONE_LABELS: Record<(typeof ZONES)[number], string> = {
  YOPOUGON: "Yopougon",
  SONGON: "Songon",
  PK22: "PK22",
  NDOTRE: "N'Dotré",
};

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{8,15}$/, "Numéro de téléphone invalide (8 à 15 chiffres, indicatif optionnel)");

// Base partagée : un seul endroit définit chaque règle de champ (DRY).
const registerBase = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Le nom complet doit contenir au moins 2 caractères")
    .max(80, "Le nom complet ne peut pas dépasser 80 caractères"),
  phone: phoneSchema,
  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères")
    .max(72, "Le mot de passe ne peut pas dépasser 72 caractères"),
  confirmPassword: z.string(),
  zone: z.enum(ZONES, { message: "Zone invalide" }),
});

export const registerSchema = registerBase.refine((d) => d.password === d.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

// Sous-schémas par étape du parcours d'inscription guidé (register-form) —
// mêmes règles que le contrat complet, validées incrementalement côté client.
export const registerStepIdentitySchema = registerBase.pick({ fullName: true, phone: true });

export const registerStepZoneSchema = registerBase.pick({ zone: true });

export const registerStepSecuritySchema = registerBase
  .pick({ password: true, confirmPassword: true })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, "Mot de passe requis"),
  // « Se souvenir de moi » : coché (défaut serveur) = session 30 jours,
  // décoché = session courte (cookie de session navigateur).
  rememberMe: z.boolean().optional(),
});

// Mot de passe oublié — US-AUTH-5 : demande de code (étape 1) puis
// code + nouveau mot de passe (étape 2).
export const forgotPasswordSchema = z.object({
  phone: phoneSchema,
});

export const resetPasswordSchema = z
  .object({
    phone: phoneSchema,
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Le code doit contenir exactement 6 chiffres"),
    password: z
      .string()
      .min(8, "Le mot de passe doit contenir au moins 8 caractères")
      .max(72, "Le mot de passe ne peut pas dépasser 72 caractères"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// Convertit les issues zod en dictionnaire { champ: message } pour l'affichage inline.
export function zodIssuesToFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in errors)) {
      errors[field] = issue.message;
    }
  }
  return errors;
}
