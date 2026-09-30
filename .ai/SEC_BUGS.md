# 🔒 SEC_BUGS — Registre des vulnérabilités de sécurité

> **Registre dédié aux failles de sécurité.** Toute vulnérabilité détectée est consignée ici, **en priorité absolue**.
> Les vulnérabilités **P0/P1** déclenchent un blocage de la livraison (pas de commit PROD tant que non corrigé) et une notification immédiate à l'équipe via `.ai/HANDOFF/SECURITY_TO_TEAM.md`.

**Typologie OWASP de référence :** OWASP Top 10 (A01 Broken Access Control, A02 Cryptographic Failures, A03 Injection, A04 Insecure Design, A05 Security Misconfiguration, A06 Vulnerable Components, A07 Auth Failures, A08 Integrity Failures, A09 Logging Failures, A10 SSRF).

**Légende sévérité :** CRITIQUE · HAUTE · MOYENNE · BASSE
**Légende statut :** ⏳ Ouvert · 🔄 En correction · 👀 En retest · ✅ Corrigé · 🚫 Rejeté

**Total vulnérabilités ouvertes : 0**

| ID | Titre | Type OWASP | Sévérité | Fichier/Endpoint | Statut | Preuve | Correctif | Date |
|---|---|---|---|---|---|---|---|---|
| _—_ | _Aucune vulnérabilité enregistrée_ | _—_ | _—_ | _—_ | _—_ | _—_ | _—_ | _—_ |

### Rappel de procédure
1. Créer la ligne SEC-XXX (séquentiel, jamais réutilisé), avec **preuve vérifiable** (payload, extrait de code, capture, résultat d'outil).
2. Corriger, puis re-tester l'exploitabilité (le correctif doit invalider la preuve initiale).
3. Vérifier l'absence d'effet de bord (cf. `.ai/REGRESSIONS.md`).
4. Tracer l'audit dans `.ai/SECURITY_AUDIT.md`.
