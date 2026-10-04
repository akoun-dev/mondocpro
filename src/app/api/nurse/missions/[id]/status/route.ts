import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { NurseMissionError, updateNurseMissionStatus } from "@/lib/nurse";
import { updateMissionStatusSchema } from "@/lib/nurse-schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(["NURSE"]);
  if (!guard.ok) return guard.response;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 }); }
  const parsed = updateMissionStatusSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Statut invalide", details: parsed.error.issues }, { status: 400 });
  try {
    return NextResponse.json({ mission: await updateNurseMissionStatus(guard.user.id, (await params).id, parsed.data.status) });
  } catch (error) {
    if (error instanceof NurseMissionError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Erreur interne — réessayez" }, { status: 500 });
  }
}
