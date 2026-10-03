// GET  /api/appointments — Mes rendez-vous (contrat API_CONTRACTS.md)
// POST /api/appointments — Prendre un rendez-vous
// PATIENT uniquement au MVP. Validation zod puis règles métier (créneaux,
// collision) portées par src/lib/appointments.ts — erreurs 400/409 typées.
import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import {
    AppointmentError,
    createAppointmentForPatient,
    listAppointmentsForPatient,
} from "@/lib/appointments"
import { createAppointmentSchema } from "@/lib/appointment-schemas"

// Tri décroissant par créneau (à venir + passés), 100 derniers.
export async function GET() {
    const guard = await requireRole(["PATIENT"])
    if (!guard.ok) return guard.response

    try {
        const appointments = await listAppointmentsForPatient(guard.user.id)
        return NextResponse.json({ appointments })
    } catch (e) {
        console.error("[appointments/GET] erreur:", e)
        return NextResponse.json(
            { error: "Erreur interne — réessayez" },
            { status: 500 }
        )
    }
}

export async function POST(request: Request) {
    const guard = await requireRole(["PATIENT"])
    if (!guard.ok) return guard.response

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json(
            { error: "Corps de requête invalide (JSON attendu)" },
            { status: 400 }
        )
    }

    const parsed = createAppointmentSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            {
                error: "Veuillez corriger les champs signalés",
                details: parsed.error.issues.map(i => ({
                    field: i.path.join("."),
                    message: i.message,
                })),
            },
            { status: 400 }
        )
    }

    try {
        const appointment = await createAppointmentForPatient(
            guard.user.id,
            parsed.data
        )
        return NextResponse.json({ appointment }, { status: 201 })
    } catch (e) {
        if (e instanceof AppointmentError) {
            return NextResponse.json({ error: e.message }, { status: e.status })
        }
        console.error("[appointments/POST] erreur:", e)
        return NextResponse.json(
            { error: "Erreur interne — réessayez" },
            { status: 500 }
        )
    }
}
