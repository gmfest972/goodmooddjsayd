# 12 — EXPORT GIT

## Structure repo recommandée

```
good-mood/
├── .gitignore
├── README.md
├── LICENSE
├── docs/audit/               ← ce dossier
├── memory/PRD.md
├── backend/
├── frontend/
└── .github/workflows/         (recommandation CI)
```

## `.gitignore` (recommandé)

```
# Env / secrets
.env
.env.*
!.env.example
backend/.env
frontend/.env

# Python
__pycache__/
*.py[cod]
*$py.class
.venv/
.pytest_cache/
*.egg-info/

# Node
node_modules/
frontend/build/
frontend/.next/
frontend/coverage/

# Logs
*.log
/var/log/

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# Test artefacts
test_reports/
*.xml

# Runtime data
uploads/
tmp/
```

## Stratégie GitFlow

| Branche | Rôle |
|---------|------|
| `main` | Production, tag SemVer sur chaque release |
| `develop` | Intégration continue |
| `feature/<name>` | Nouvelle fonctionnalité |
| `hotfix/<name>` | Correctif production urgent (branché sur `main`) |
| `release/<version>` | Préparation release |

## Versionning (SemVer)

- Format : `vMAJOR.MINOR.PATCH`
- MAJOR : rupture API
- MINOR : nouvelle fonctionnalité rétrocompatible
- PATCH : bug fix

## Releases suggérées

| Tag | Contenu |
|-----|---------|
| `v0.1.0` | Site vitrine + catalogue + tour + newsletter (Phase 1 initiale) |
| `v0.2.0` | Merch + Stripe |
| `v0.3.0` | Multilangue + branding logo/socials |
| `v1.0.0` | Billetterie & CRM (Good Mood OS §8) — module actuel |

## Tags recommandés en cours

```
git tag -a v1.0.0-audit -m "Snapshot pré-audit — dossier /docs/audit/ figé"
```

## CI/CD suggéré (GitHub Actions)

`.github/workflows/backend.yml` :
- pytest sur push
- lint (ruff / mypy)

`.github/workflows/frontend.yml` :
- yarn build
- (opt) tests Jest

`.github/workflows/deploy.yml` :
- déclenché sur tag `v*.*.*`
- build + push image + rollout K8s
