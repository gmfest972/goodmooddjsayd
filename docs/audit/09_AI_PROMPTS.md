# 09 — PROMPTS & INSTRUCTIONS IA

## Prompts historiques

**Non disponible dans le projet.** Aucun fichier `.prompt`, `system_prompt.md` ou variable d'environnement `SYSTEM_PROMPT` n'existe dans le repo. Aucun composant IA autonome n'est intégré (ni OpenAI, ni Anthropic, ni Gemini, ni fal.ai).

## Intentions fonctionnelles reconstruites

Le produit n'utilise pas d'IA générative en run-time. Les traces IA proviennent uniquement du **processus de développement** (agent E1 d'Emergent) et se manifestent comme suit :

| Trace | Où | Comment |
|-------|-----|---------|
| Intentions produit | `memory/PRD.md` | Documenté avec vision, personas, roadmap |
| Compte-rendus itérations | Historique de conversation | Non exporté dans le repo |
| Rapports de tests | `test_reports/iteration_*.json` | Chaque itération = 1 rapport |
| Design tokens | `design_guidelines.json` (racine) | Généré par sub-agent design |

## Extensions IA envisageables (Recommandations)

Aucune fonctionnalité IA n'est actuellement en production. Zones où l'IA pourrait apporter de la valeur :

1. **Recommandations d'events** basées sur les segments fan (primo → suggérer un event similaire de sa ville)
2. **Génération automatique de descriptifs** d'events / merch depuis un brief court
3. **Modération automatique** des emails soumis (anti-spam / anti-typos)
4. **Résumés reporting** pour sponsors (LLM → PDF one-pager)
5. **Chatbot support** fan (FAQ billetterie)

Ces extensions relèveraient d'une intégration nouvelle avec un provider LLM (OpenAI / Claude / Gemini), non implémentée à ce jour.
