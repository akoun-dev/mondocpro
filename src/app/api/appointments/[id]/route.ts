// PATCH /api/appointments/:id — Annuler un rendez-vous (contrat API_CONTRACTS.md)
// PATIENT propriétaire uniquement ; action = CANCEL. Règles métier (statuts
// annulables, propriété) dans src/lib/appointments.ts — 404 / 409 typés.
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  AppointmentError,
  cancelAppointmentForPatient,
} from "@/lib/appointments";
import { updateAppointmentSchema } from "@/lib/appointment-schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRole(["PATIENT"]);
  if (!guard.ok) return guard.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide (JSON attendu)" },
      { status: 400 },
    );
  }

  const parsed = updateAppointmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Action non supportée",
        details: parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    const appointment = await cancelAppointmentForPatient(guard.user.id, id);
    return NextResponse.json({ appointment });
  } catch (e) {
    if (e instanceof AppointmentError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[appointments/PATCH] erreur:", e);
    return NextResponse.json(
      { error: "Erreur interne — réessayez" },
      { status: 500 },
    );
  }
}
