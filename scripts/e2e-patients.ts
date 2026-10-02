// E2E API patients (Task 14, lot P0/P1) — contrats API_CONTRACTS.md.
// Usage : bun scripts/e2e-patients.ts  (serveur dev requis sur :3000)
// Jar A = PATIENT (cookie fichier .zscripts/test-cookies.txt)
// Jar B = PATIENT temporaire (inscription API) — test propriété 404
// Jar C = INFIRMIER (fixture Prisma) — test 403
const BASE = "http://localhost:3000";
const results: { name: string; pass: boolean; info?: string }[] = [];

function check(name: string, pass: boolean, info?: string) {
  results.push({ name, pass, info });
  console.log(`${pass ? "PASS" : "FAIL"} — ${name}${info ? ` (${info})` : ""}`);
}

// Créneau valide : prochain jour ouvré à 10:00 (≥ 2 h d'avance).
function nextBusinessSlot(): { date: string; time: string } {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  const date = d.toISOString().slice(0, 10);
  return { date, time: "10:00" };
}

async function call(
  path: string,
  opts: { method?: string; cookie?: string; body?: unknown } = {},
) {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(opts.cookie ? { Cookie: opts.cookie } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let json: any = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json, setCookie: res.headers.get("set-cookie") };
}

function cookieFromJar(content: string): string | undefined {
  const line = content
    .split("\n")
    .reverse()
    .find((l) => l.includes("Mon doc Pro_session") && !l.trim().startsWith("# ") && !l.startsWith("# Netscape") && !l.startsWith("# This file") && !l.startsWith("# https"));
  const value = line?.split("\t").pop()?.trim();
  return value ? `Mon doc Pro_session=${value}` : undefined;
}

// ——— Jar A : PATIENT existant (fichier curl) ———
import { readFileSync } from "node:fs";
const jarA = cookieFromJar(readFileSync(".zscripts/test-cookies.txt", "utf8"));
if (!jarA) { console.error("FATAL: cookie session PATIENT introuvable"); process.exit(1); }

// 1. Health
const h = await call("/api/health");
check("health 200 + database up", h.status === 200 && h.json?.status === "ok" && h.json?.database === "up", JSON.stringify(h.json));

// 2. 401 sans session
for (const [m, p, b] of [
  ["GET", "/api/appointments", null],
  ["POST", "/api/appointments", { type: "CABINET", zone: "YOPOUGON", date: "2026-12-01", time: "10:00" }],
  ["PATCH", "/api/appointments/xyz", { action: "CANCEL" }],
  ["GET", "/api/sensibilisations", null],
] as const) {
  const r = await call(p, { method: m, body: b });
  check(`${m} ${p} sans session → 401`, r.status === 401, `got ${r.status}`);
}

// 3. RDV — création
const slot = nextBusinessSlot();
const post1 = await call("/api/appointments", { method: "POST", cookie: jarA, body: { type: "CABINET", zone: "YOPOUGON", ...slot, reason: "Consultation générale" } });
check("POST appointment → 201", post1.status === 201, JSON.stringify(post1.json?.appointment ?? post1.json));
const apptId = post1.json?.appointment?.id as string | undefined;
check("appointment.status = PENDING", post1.json?.appointment?.status === "PENDING");

// 4. Collision 409
const post2 = await call("/api/appointments", { method: "POST", cookie: jarA, body: { type: "DOMICILE", zone: "YOPOUGON", ...slot } });
check("POST même créneau → 409", post2.status === 409, `got ${post2.status}`);

// 5. Règles créneau 400 (dimanche, hors grille, délai insuffisant, > 60 jours)
const sunday = new Date(); sunday.setUTCDate(sunday.getUTCDate() + 7 + (7 - sunday.getUTCDay()) % 7);
const rSunday = await call("/api/appointments", { method: "POST", cookie: jarA, body: { type: "CABINET", zone: "YOPOUGON", date: sunday.toISOString().slice(0, 10), time: "10:00" } });
check("POST dimanche → 400", rSunday.status === 400, `got ${rSunday.status}`);
const rGrid = await call("/api/appointments", { method: "POST", cookie: jarA, body: { type: "CABINET", zone: "YOPOUGON", date: slot.date, time: "10:07" } });
check("POST hors grille 30 min → 400", rGrid.status === 400, `got ${rGrid.status}`);
const today = new Date(); today.setUTCHours(23, 0, 0, 0);
const rLead = await call("/api/appointments", { method: "POST", cookie: jarA, body: { type: "CABINET", zone: "YOPOUGON", date: today.toISOString().slice(0, 10), time: "23:00" } });
check("POST délai < 2 h → 400", rLead.status === 400, `got ${rLead.status}`);

// 6. Liste
const list = await call("/api/appointments", { cookie: jarA });
check("GET appointments → 200 avec RDV créé", list.status === 200 && Array.isArray(list.json?.appointments) && list.json.appointments.some((a: any) => a.id === apptId), `count ${list.json?.appointments?.length}`);

// 7. Propriété : patient B (nouvelle inscription) ne voit pas/annule pas le RDV de A
const regB = await call("/api/auth/register", { method: "POST", body: { fullName: "Patient B E2E", phone: `+2250711${String(Date.now()).slice(-6)}`, password: "TestPatient2026!", confirmPassword: "TestPatient2026!", zone: "YOPOUGON" } });
const cookieB = regB.setCookie?.split(";")[0];
check("register patient B → 201 + cookie", regB.status === 201 && !!cookieB, `got ${regB.status}`);
const rOwn = await call(`/api/appointments/${apptId}`, { method: "PATCH", cookie: cookieB, body: { action: "CANCEL" } });
check("PATCH RDV d'autrui → 404", rOwn.status === 404, `got ${rOwn.status}`);

// 8. Annulation par le propriétaire
const cancel = await call(`/api/appointments/${apptId}`, { method: "PATCH", cookie: jarA, body: { action: "CANCEL" } });
check("PATCH CANCEL propriétaire → 200 CANCELLED", cancel.status === 200 && cancel.json?.appointment?.status === "CANCELLED", `got ${cancel.status}`);
const cancel2 = await call(`/api/appointments/${apptId}`, { method: "PATCH", cookie: jarA, body: { action: "CANCEL" } });
check("PATCH re-cancel → 409", cancel2.status === 409, `got ${cancel2.status}`);
const badAction = await call(`/api/appointments/${apptId}`, { method: "PATCH", cookie: jarA, body: { action: "RESCHEDULE" } });
check("PATCH action inconnue → 400", badAction.status === 400, `got ${badAction.status}`);

// 9. 403 INFIRMIER sur RDV + 200 sur SENSO (tous rôles)
const loginC = await call("/api/auth/login", { method: "POST", body: { phone: "+2250755666777", password: "TestInfirmier2026!" } });
const cookieC = loginC.setCookie?.split(";")[0];
check("login INFIRMIER → 200 + cookie", loginC.status === 200 && !!cookieC, `got ${loginC.status}`);
const r403a = await call("/api/appointments", { cookie: cookieC });
check("GET appointments INFIRMIER → 403", r403a.status === 403, `got ${r403a.status}`);
const r403b = await call("/api/appointments", { method: "POST", cookie: cookieC, body: { type: "CABINET", zone: "YOPOUGON", ...slot } });
check("POST appointments INFIRMIER → 403", r403b.status === 403, `got ${r403b.status}`);

// 10. SENSO — liste, ciblage zone, détail, 404
// Seed : 6 contenus — 3 sans ciblage, YOPOUGON ciblé par Vaccination + Grossesse,
// « Eau de boisson » (SONGON/NDOTRE) masqué pour le lecteur YOPOUGON → 5 attendus.
const senso = await call("/api/sensibilisations", { cookie: jarA });
const items = senso.json?.sensibilisations ?? [];
const allVisible = items.every((s: any) => !s.zones?.length || s.zones.includes("YOPOUGON"));
check("GET sensibilisations → 200 (5 visibles pour YOPOUGON)", senso.status === 200 && items.length === 5, `count ${items.length}`);
check("ciblage zone respecté (aucun contenu hors YOPOUGON)", allVisible);
const sensoId = senso.json?.sensibilisations?.[0]?.id;
const detail = await call(`/api/sensibilisations/${sensoId}`, { cookie: jarA });
check("GET sensibilisation :id → 200", detail.status === 200 && detail.json?.sensibilisation?.id === sensoId, `got ${detail.status}`);
const unknow = await call("/api/sensibilisations/inexistant-id-xyz", { cookie: jarA });
check("GET sensibilisation inconnue → 404", unknow.status === 404, `got ${unknow.status}`);
const sensoInf = await call("/api/sensibilisations", { cookie: cookieC });
check("GET sensibilisations INFIRMIER → 200 (tous rôles)", sensoInf.status === 200, `got ${sensoInf.status}`);

// ——— Bilan ———
const failed = results.filter((r) => !r.pass);
console.log(`\n=== BILAN : ${results.length - failed.length}/${results.length} PASS ===`);
if (failed.length) process.exit(1);
