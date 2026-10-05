// Lecture des query params des routes annuaire admin.
// Les schémas zod de admin-users-schemas.ts portent les valeurs par défaut,
// donc un paramètre absent ou vide ne doit pas être transmis tel quel au
// parseur : `?zone=` casserait `z.enum(ZONES)` alors que l'utilisateur n'a
// rien filtré.
import type { ZodType } from "zod";

/**
 * Extrait les query params dans un objet "que ce qui est présent", les
 * valeurs vides comprises. Le schéma applique ensuite ses défauts.
 */
export function queryInput(
  request: Request,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  new URL(request.url).searchParams.forEach((value, key) => {
    out[key] = value === "" ? undefined : value;
  });
  return out;
}

/**
 * Parse une query string. `success: false` = la requête est mal formée, et
 * `fieldErrors` associe chaque champ fautif à son message (affiché sous le
 * champ concerné plutôt qu'en bannière).
 */
export function parseQuery<T>(
  schema: ZodType<T>,
  request: Request,
):
  | { ok: true; data: T }
  | { ok: false; fieldErrors: Record<string, string> } {
  const parsed = schema.safeParse(queryInput(request));
  if (parsed.success) return { ok: true, data: parsed.data };

  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join(".");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { ok: false, fieldErrors };
}