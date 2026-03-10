# Backend v1 Freeze Checklist

This checklist is used to freeze backend scope before frontend integration and before any deployment work.

## 1) Scope Lock

- Backend v1 scope is frozen (SLA runtime excluded)
- New backend feature requests are moved to backlog unless critical bug
- API contract changes require explicit approval and changelog entry

## 2) Quality Gate

- Local gate passes: `npm.cmd run release:gate`
- Freeze readiness check passes: `npm.cmd run freeze:check`
- GitHub `Backend Release Gate` passes on latest commit
- Branch protection keeps release gate as required status check

## 3) Handover Package

- API and ops docs are up to date:
  - `docs/deploy-runbook.md`
  - `docs/operations-checklist.md`
  - `docs/error-contract.md`
  - `docs/legal-compliance-th.md`
- Release note file is created for this freeze (see `docs/release-notes-*.md`)

## 4) Runtime Guard and Security Baseline

- Production runtime guard rules validated
- CORS production rules validated (`CORS_ORIGINS`, `CORS_ALLOW_CREDENTIALS`)
- Security headers middleware is enabled globally
- Production retention baseline validated (`RETENTION_ACTIVITY_LOGS_DAYS >= 90`)

## 5) Deferred (Not in this freeze)

- Real production deploy
- Preprod/prod provider credentials wiring
- Infra/network-edge setup outside repository

## 6) Freeze Exit Criteria

Freeze is complete when all below are true:

- [ ] Checklist section 1-5 completed
- [ ] Release note committed
- [ ] Commit hash tagged or recorded for release candidate
- [ ] Frontend team receives handover link + backend RC hash