# Security

## Automation

- Dependabot security updates are enabled in GitHub.
- Dependabot version updates are configured in [`.github/dependabot.yml`](/home/kiri_/projects/scanner-inventario-app/.github/dependabot.yml).
- The weekly security audit workflow in [`.github/workflows/security-audit.yml`](/home/kiri_/projects/scanner-inventario-app/.github/workflows/security-audit.yml) uses `SNYK_TOKEN`.
- AI PR review in [`.github/workflows/ai-pr-review.yml`](/home/kiri_/projects/scanner-inventario-app/.github/workflows/ai-pr-review.yml) uses `OPENAI_API_KEY` and falls back to `GEMINI_API_KEY`.
