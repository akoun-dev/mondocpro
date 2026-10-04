// Task 37/38 — E2E persistance du thème PAR UTILISATEUR sur serveur frais.
// Crée un compte PATIENT éphémère (supprimé à la fin), joue :
//   login → me (theme) → PATCH DARK → me → PATCH invalide (400 attendu)
//   → PATCH SYSTEM → me — puis supprime le compte.
// Usage : bun scripts/theme-e2e.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const BASE = "http://localhost:3000";
const PHONE = "+2250799888777";
const PASSWORD = "Test#Theme2026";

const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL ?? "" } },
});

async function main() {
    // 0. Compte éphémère
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    await prisma.user.upsert({
        where: { phone: PHONE },
        update: { passwordHash },
        create: {
            fullName: "E2E Thème (éphémère)",
            phone: PHONE,
            passwordHash,
            role: "PATIENT",
            zone: "YOPOUGON",
        },
    });
    console.log("0) compte test prêt :", PHONE);

    try {
        // 1. Login
        const login = await fetch(`${BASE}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: PHONE, password: PASSWORD }),
        });
        console.log("1) login :", login.status);
        if (login.status !== 200) throw new Error("login KO");
        const cookie = login.headers.getSetCookie()[0]!.split(";")[0]!;

        // 2. me — champ theme exposé ?
        const me1 = await (await fetch(`${BASE}/api/auth/me`, { headers: { cookie } })).json();
        console.log("2) me.theme =", me1.user?.theme, "(attendu SYSTEM)");

        // 3. PATCH DARK
        const patch1 = await fetch(`${BASE}/api/auth/profile`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", cookie },
            body: JSON.stringify({ theme: "DARK" }),
        });
        console.log("3) PATCH DARK :", patch1.status, "(attendu 200)");

        // 4. Vérification en base (source de vérité)
        const inDb = await prisma.user.findUnique({ where: { phone: PHONE }, select: { theme: true } });
        console.log("4) theme en base :", inDb?.theme, "(attendu DARK)");

        // 5. PATCH invalide → 400 (garde zod)
        const patchBad = await fetch(`${BASE}/api/auth/profile`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", cookie },
            body: JSON.stringify({ theme: "NOIR" }),
        });
        console.log("5) PATCH invalide :", patchBad.status, "(attendu 400)");

        // 6. Retour SYSTEM
        const patch2 = await fetch(`${BASE}/api/auth/profile`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", cookie },
            body: JSON.stringify({ theme: "SYSTEM" }),
        });
        console.log("6) PATCH SYSTEM :", patch2.status, "(attendu 200)");
    } finally {
        // 7. Nettoyage
        await prisma.user.delete({ where: { phone: PHONE } });
        console.log("7) compte test supprimé ✓");
    }
}

main()
    .catch((e) => {
        console.error("E2E ÉCHOUÉ :", e);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
