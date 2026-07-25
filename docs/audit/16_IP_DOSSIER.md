# 16 — DOSSIER PROPRIÉTÉ INTELLECTUELLE

## Inventaire des actifs

### Actifs logiciels propriétaires (Observé)

| Actif | Nature | Protection potentielle | Fichier |
|-------|--------|-----------------------|---------|
| **Code source complet** | 1334 lignes Python + 2359 lignes JS/JSX | Droit d'auteur automatique | `backend/`, `frontend/` |
| **Architecture module Billetterie + CRM + FREK-ID outbox** | Concept propriétaire selon spec Good Mood OS §8 | Secret d'affaires + droit d'auteur | `frek_service.py`, `wallet_service.py`, `server.py:_issue_tickets_for_session` |
| **Modèle CRM Fan Segmentation** | Segments primo/recurring/vip auto-calculés à chaque interaction | Base de données (droit sui generis EU) + secret | `ticketing_service.py:upsert_fan` |
| **Contrat FREK-ID (payload structuré)** | Format d'échange défini avec le socle FrekCore | Secret d'affaires groupe | `frek_service.py:emit` |
| **Système d'auto-flip event status** | Algo de bascule automatique sold_out | Droit d'auteur | `ticketing_service.py:maybe_flip_event_to_soldout` |
| **Migration signature-based (safe)** | Backfill idempotent gated par titre legacy OU URL playlist | Droit d'auteur (design pattern original) | `server.py:startup` |

### Contenus & données

| Actif | Nature | Protection |
|-------|--------|-----------|
| **9 volumes catalogue** (titres, descriptions, années) | Œuvres musicales existantes (DJ Sayd) | Droit d'auteur — appartient à DJ Sayd / label FMS |
| **Covers artwork** | Hosted sur CDN SoundCloud | Copyright original des artworks (à confirmer) |
| **Textes brand** (hero, descriptions, tagline) | Copywriting | Droit d'auteur — Good Mood |
| **Traductions 4 langues** (FR/EN/ES/KR) | Œuvre de traduction | Droit d'auteur — Good Mood |
| **Templates emails HTML** | Brand-aligned, custom | Droit d'auteur — Good Mood |
| **Fan CRM database** | Actif propre Good Mood | Droit sui generis base de données (EU) |

### Actifs de marque

| Actif | Statut |
|-------|--------|
| **GOOD MOOD** (nom commercial) | Marque à déposer (INPI FR / EUIPO / WIPO). Non déposée dans le repo. |
| **Logo GM** (`logo-gm.png`) | Droit d'auteur automatique. Peut être déposé comme marque figurative. |
| **DJ SAYD** | Marque personnelle. Existante. Non gérée dans ce repo. |
| **Slogan "PARIS · CARAÏBES · WORLD"** | Éligible dépôt marque semi-figurative si distinctivité prouvée |
| **URL / nom de domaine** goodmood.fest | Actif de propriété intellectuelle (nom de domaine) |

### Actifs documentaires

| Actif | Contenu |
|-------|---------|
| **PRD** (`memory/PRD.md`) | Vision + backlog Phase 1/2 |
| **Spec Good Mood OS Module Billetterie** | Cahier des charges détaillé §1-10 |
| **Ce dossier d'audit** | Documentation exhaustive niveau entreprise |
| **Design guidelines** (`design_guidelines.json`) | Système de design |
| **Playbooks intégrations** | Non commit — issus de l'agent d'intégration |

## Éléments différenciants (potentiellement brevetables selon juridiction)

- **Système d'outbox synchrone + retry queue socle-agnostic** — pattern original permettant de builder aujourd'hui contre un socle inexistant et flipper la production par simple env var. Réutilisable transverse (FREK-ID, Wallet, futurs socles).
- **Auto-migration signature-based** — permet de faire évoluer un seed sans jamais écraser une édition admin.

## Concepts propriétaires (secret d'affaires)

- **Doctrine data Good Mood** — dualité capture locale (CRM propre) + remontée FREK-ID synchrone, à chaque point de contact. Formalisée dans la spec module §8.
- **Structure holding CVLN → Pôle Events → Good Mood** — cadre corporate, actif organisationnel.
- **Rapport valorisation FrekCore / CVLN Agent Factory** — hors périmètre code, référencé dans la spec.

## Recommandations juridiques

1. **Marque GOOD MOOD** — dépôt INPI classe 41 (divertissement, événements) + classe 25 (vêtements/merch) + classe 9 (logiciels) + classe 42 (SaaS)
2. **Marque semi-figurative** logo GM — dépôt figuratif en parallèle
3. **Nom de domaine** — sécuriser `.fest`, `.com`, `.fr`, `.eu`, `.io`
4. **Licence code source** — ajouter `LICENSE` restrictif (proprietary all-rights-reserved) OU dual-license si open-sourcing partiel envisagé
5. **Cession de droits** — s'assurer que tout contributeur signe une cession (freelances, prestataires)
6. **NDA** avec toute personne ayant accès au repo (spec OS + doctrine data = secret d'affaires)
7. **RGPD** — le module CRM Fan collecte des emails + comportements. Obligations :
   - Registre des traitements
   - Politique de confidentialité publique
   - Base légale claire (consentement pour newsletter, exécution contrat pour achat billet)
   - Droit d'accès / suppression via l'admin
   - DPA avec Stripe, Resend, MongoDB Atlas
8. **Copyright notice** — ajouter en-tête `# Copyright (c) 2026 CVLN Groupe — All Rights Reserved` sur chaque fichier source

## Ce qui NE relève PAS de la propriété exclusive Good Mood

- Frameworks utilisés (FastAPI, React, Three.js, etc.) — licences MIT/BSD/Apache, aucune obligation d'attribution
- shadcn/ui components (MIT)
- Contenus SoundCloud (droit des artistes / labels d'origine)
- Icônes lucide-react (ISC)
