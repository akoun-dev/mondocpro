import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { dispatchMission, NurseMissionError } from "@/lib/nurse";
import { reassignMissionSchema } from "@/lib/nurse-schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(["ADMIN"]);
  if (!guard.ok) return guard.response;
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 }); }
  const parsed = reassignMissionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Réaffectation invalide", details: parsed.error.issues }, { status: 400 });
  try {
    const missionId = (await params).id;
    const mission = await dispatchMission(guard.user.id, { appointmentId: "", nurseId: parsed.data.nurseId }, missionId);
    return NextResponse.json({ mission });
  } catch (error) {
    if (error instanceof NurseMissionError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Erreur interne — réessayez" }, { status: 500 });
  }
}
