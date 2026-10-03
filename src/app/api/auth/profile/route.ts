// PATCH /api/auth/profile — FEATURE-PROFIL (Task 22/23, contrat API_CONTRACTS.md)
// Édition du profil de l'utilisateur connecté : nom complet, date de naissance,
// secteur d'habitation (zone) et préférences de notification (rappels RDV,
// alertes de santé locales).
// Sécurité :
//   - le user ciblé est TOUJOURS celui de la session (jamais pris du corps) :
//     chacun ne peut modifier que son propre profil ;
//   - phone / role non modifiables (le schéma Zod les refuse) ; zone éditable
//     depuis la Task 23 (même modèle : Zod partagé + PATCH sémantique) ;
//   - tous les rôles authentifiés sont admis (chacun possède un profil).
// birthDate "AAAA-MM-JJ" → Date minuit UTC (Afrique/Abidjan = UTC+0) ;
// birthDate null → efface la valeur (affichage « Non renseignée »).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, toPublicUser } from "@/lib/auth";
import { updateProfileSchema, ZONES } from "@/lib/auth-schemas";

export async function PATCH(request: Request) {
    const guard = await requireRole(["PATIENT", "NURSE", "ADMIN"]);
    if (!guard.ok) return guard.response;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "Corps de requête invalide (JSON attendu)" },
            { status: 400 }
        );
    }

    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            {
                error: "Veuillez corriger les champs signalés",
                details: parsed.error.issues.map((i) => ({
                    field: i.path.join("."),
                    message: i.message,
                })),
            },
            { status: 400 }
        );
    }

    // Delta minimal : seuls les champs fournis sont modifiés (PATCH sémantique).
    const data: {
        fullName?: string;
        birthDate?: Date | null;
        zone?: (typeof ZONES)[number];
        appointmentReminders?: boolean;
        healthAlerts?: boolean;
    } = {};
    if (parsed.data.fullName !== undefined) data.fullName = parsed.data.fullName;
    if (parsed.data.zone !== undefined) data.zone = parsed.data.zone;
    if (parsed.data.birthDate !== undefined) {
        data.birthDate = parsed.data.birthDate
            ? new Date(`${parsed.data.birthDate}T00:00:00.000Z`)
            : null;
    }
    if (parsed.data.appointmentReminders !== undefined) {
        data.appointmentReminders = parsed.data.appointmentReminders;
    }
    if (parsed.data.healthAlerts !== undefined) {
        data.healthAlerts = parsed.data.healthAlerts;
    }

    try {
        const user = await db.user.update({
            where: { id: guard.user.id },
            data,
        });
        return NextResponse.json({ user: toPublicUser(user) });
    } catch (e) {
        console.error("[auth/profile PATCH] erreur:", e);
        return NextResponse.json(
            { error: "Erreur interne — réessayez" },
            { status: 500 }
        );
    }
}
