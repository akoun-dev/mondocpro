// Schémas de validation zod — FEATURE-AUTH (miroir des contrats API_CONTRACTS.md)
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

export const registerSchema = z
  .object({
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
    role: z.enum(ROLES, { message: "Rôle invalide" }),
    zone: z.enum(ZONES, { message: "Zone invalide" }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, "Mot de passe requis"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
