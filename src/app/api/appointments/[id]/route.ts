// PATCH /api/appointments/:id — Annulation (patient) ou clôture (Médecin
// Chef) d'un rendez-vous — contrat API_CONTRACTS.md.
// PATIENT propriétaire : action=CANCEL uniquement (403 si DONE).
// ADMIN (Médecin Chef) : action=DONE (consultation réalisée → dépense
// définitive des Tokens) ou CANCEL (échec équipe/système → libération).
// FEATURE-TOKENS (ADR-007) : le sort des Tokens réservés suit l'action dans
// la même transaction (releaseAppointmentTokens / consumeAppointmentTokens).
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  AppointmentError,
  cancelAppointmentForPatient,
  closeAppointmentByAdmin,
} from "@/lib/appointments";
import { updateAppointmentSchema } from "@/lib/appointment-schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRole(["PATIENT", "ADMIN"]);
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

  const { action } = parsed.data;

  // Cloisonnement des rôles : la clôture (DONE) est réservée au Médecin
  // Chef ; l'ADMIN n'annule pas « à la place » du patient sans passer par
  // la même endpoint documentée (échec équipe / geste commercial).
  if (action === "DONE" && guard.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Accès non autorisé pour ce rôle" },
      { status: 403 },
    );
  }

  try {
    const appointment =
      guard.user.role === "ADMIN"
        ? await closeAppointmentByAdmin(guard.user.id, id, action)
        : await cancelAppointmentForPatient(guard.user.id, id);
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
