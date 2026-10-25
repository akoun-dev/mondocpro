import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
    const guard = await requireRole(["NURSE"])
    if (!guard.ok) return guard.response

    try {
        const patients = await db.user.findMany({
            where: { role: "PATIENT" },
            orderBy: { fullName: "asc" },
            select: {
                id: true,
                fullName: true,
                phone: true,
                zone: true,
                patientMissions: {
                    where: { nurseId: guard.user.id },
                    orderBy: { assignedAt: "desc" },
                    select: {
                        status: true,
                        appointment: {
                            select: {
                                scheduledAt: true,
                                type: true,
                                reason: true,
                                specialty: { select: { name: true } },
                            },
                        },
                    },
                },
            },
        })

        return NextResponse.json({
            patients: patients.map(patient => ({
                id: patient.id,
                fullName: patient.fullName,
                phone: patient.phone,
                zone: patient.zone,
                missionCount: patient.patientMissions.length,
                lastMission: patient.patientMissions[0]
                    ? {
                        status: patient.patientMissions[0].status,
                        scheduledAt: patient.patientMissions[0].appointment.scheduledAt.toISOString(),
                        type: patient.patientMissions[0].appointment.type,
                        reason: patient.patientMissions[0].appointment.reason,
                        specialty: patient.patientMissions[0].appointment.specialty?.name ?? null,
                    }
                    : null,
            })),
        })
    } catch (error) {
        console.error("[nurse/patients GET]", error)
        return NextResponse.json({ error: "Erreur interne — réessayez" }, { status: 500 })
    }
}
