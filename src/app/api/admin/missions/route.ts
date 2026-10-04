import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { dispatchMission, listAdminMissions, NurseMissionError } from "@/lib/nurse";
import { dispatchMissionSchema } from "@/lib/nurse-schemas";

export async function POST(request: Request) {
  const guard = await requireRole(["ADMIN"]);
  if (!guard.ok) return guard.response;
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 }); }
  const parsed = dispatchMissionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dispatch invalide", details: parsed.error.issues }, { status: 400 });
  try { return NextResponse.json({ mission: await dispatchMission(guard.user.id, parsed.data) }, { status: 201 }); }
  catch (error) { if (error instanceof NurseMissionError) return NextResponse.json({ error: error.message }, { status: error.status }); return NextResponse.json({ error: "Erreur interne — réessayez" }, { status: 500 }); }
}

export async function GET() {
  const guard = await requireRole(["ADMIN"]);
  if (!guard.ok) return guard.response;
  try {
    return NextResponse.json({ missions: await listAdminMissions() });
  } catch {
    return NextResponse.json({ error: "Erreur interne — réessayez" }, { status: 500 });
  }
}
