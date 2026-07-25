# 10 — SPÉCIFICATIONS FONCTIONNELLES

## Vision produit

Good Mood est une marque autonome (spinoff des mix DJ Sayd) du pôle Events de CVLN Groupe. Elle unifie 6 modules — Catalogue (musique), Live (events), Media, Merch, Billetterie, Store — sur une seule plateforme, sans dépendance à une infrastructure groupe mutualisée. Le site vitrine public sert de vitrine cinématique ; l'OS interne pilote toute l'exploitation (CRM propre, billetterie intégrée, contenu, sponsoring, finance).

## Objectifs

- **Autonomie** : vendre billets et merch sans passer par un tiers (Weezevent, Shotgun, etc.)
- **Fan CRM propriétaire** : chaque interaction (achat, scan) enrichit une base 100% Good Mood
- **Interop socle groupe** : chaque événement est aussi remonté au socle FrekCore via FREK-ID (contrat synchrone + retry)
- **Multilinguisme** : FR / EN / ES / Kreyòl (marchés Paris + Caraïbes + monde)
- **Expérience premium** : hero 3D immobile, catalogue jouable inline, cinématique cohérente

## Personas

| Persona | Contexte | Besoins |
|---------|---------|---------|
| **Sayd / owner-admin** | DJ, gère tout depuis un mobile | CRM léger, ajout événement en < 3 min, scan porte sans app |
| **Staff porte** | Bénévole ou pro, jour J | Scanner rapide, retour visuel fort (vert/rouge), compteur live |
| **Fan public** | Découvre depuis Insta / QR / bouche-à-oreille | Écouter, acheter billet, recevoir preuve d'achat |
| **Sponsor / partenaire** | Cherche à mesurer l'exposition | Reporting fill rate + audience (Phase 2) |
| **Auditeur / investisseur** | Diligence | Documentation exhaustive (ce dossier) |

## Parcours utilisateur — Fan achète un billet

1. Arrive sur la homepage → fond 3D immobile + hero GOOD MOOD
2. Scroll → Section Tour → clic sur une date `on_sale`
3. Modal TicketPicker → choix ticket type (Standard/VIP) + email + quantité → Total live
4. Clic CHECKOUT → redirection Stripe Checkout hosted
5. Paiement carte → retour sur `/payment/success?session_id=`
6. Polling status → CONFIRMED
7. Email Resend arrive → QR intégré + lien `/ticket/{id}`
8. Jour J → montre le QR au staff porte → scan `/scan` → VALID (vert)
9. FREK-ID reçoit purchase + entry_scan (temps réel)
10. Fan CRM Good Mood a maintenant sa fiche (segments recalculés)

## Parcours utilisateur — Admin crée un event

1. Login `/admin/login` → Dashboard
2. Onglet Events → Add Event → EventForm (name/city/venue/date/capacity/currency/status)
3. Sauvegarde → event créé avec statut choisi
4. Add Ticket Type sur la card → TicketTypeForm (name/price/quota) → sync Stripe automatique
5. Statut passé à `on_sale` → visible côté public avec bouton BILLETS actif
6. Suivi live : sold/capacity, revenue, fill_rate

## Fonctionnalités

### Front-office public
- Hero 3D immobile (particules Three.js, parallaxe souris)
- Catalogue 9 volumes SoundCloud (widget embed inline)
- Tour / Live Experience (events avec statut, ticket picker)
- Store / Merch (produits Stripe)
- Newsletter capture (Resend welcome)
- Language switcher 4 langues
- Ticket view public `/ticket/{id}`

### Back-office OS
- Admin login JWT
- CRUD Catalogue
- CRUD Events + Ticket Types (Stripe sync)
- CRUD Merch (Stripe sync)
- Newsletter viewer + CSV export
- Orders viewer (transactions Stripe)
- Fans viewer (CRM avec segments)
- Outboxes monitoring (FREK-ID + Wallet)
- Reporting event (fill rate, revenue, checked-in)
- Staff scan `/scan` (caméra QR)

## Exigences fonctionnelles

- FR-1 : L'admin peut créer un event avec 5 statuts distincts
- FR-2 : L'API publique masque les events statut `vision`
- FR-3 : L'achat billet est atomiquement lié à une session Stripe unique
- FR-4 : Un scan met à jour l'état ticket + émet FREK-ID sync
- FR-5 : L'email de confirmation contient le QR embarqué

## Exigences non fonctionnelles

- NFR-1 : Latence P95 API < 300ms (Mongo local + Stripe ~200ms)
- NFR-2 : Retry FREK-ID/Wallet at-least-once, jamais perdu
- NFR-3 : Emails Resend best-effort — non bloquant
- NFR-4 : Frontend responsive mobile (scan porte utilisable smartphone)
- NFR-5 : Multi-devise (EUR, USD, GBP) supportée nativement
- NFR-6 : Idempotence webhook Stripe (garde-fou `tickets_issued`)
- NFR-7 : Aucun secret en clair dans le repo (100% via `.env`)
