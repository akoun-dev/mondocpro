import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createVisitReport, NurseMissionError } from "@/lib/nurse";
import { visitReportSchema } from "@/lib/nurse-schemas";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(["NURSE"]);
  if (!guard.ok) return guard.response;
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 }); }
  const parsed = visitReportSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Compte-rendu invalide", details: parsed.error.issues }, { status: 400 });
  try { return NextResponse.json({ report: await createVisitReport(guard.user.id, (await params).id, parsed.data) }, { status: 201 }); }
  catch (error) { if (error instanceof NurseMissionError) return NextResponse.json({ error: error.message }, { status: error.status }); return NextResponse.json({ error: "Erreur interne — réessayez" }, { status: 500 }); }
}
