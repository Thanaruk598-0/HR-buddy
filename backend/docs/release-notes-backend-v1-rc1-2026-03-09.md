# Backend Release Notes - v1 RC1 (2026-03-09)

## Release

- Candidate: `backend-v1-rc1`
- Date: 2026-03-09
- Baseline commit: `0b34a95`

## Scope Included

- Employee requests: BUILDING / VEHICLE / MESSENGER / DOCUMENT
- OTP session flow (email-based)
- Admin auth, admin request actions, admin report summary + CSV export
- Messenger magic-link flow
- Attachment upload ticket + complete + download URL flows
- Notifications (in-app)
- Admin settings CRUD (departments/categories/operators)
- Admin audit APIs + CSV export
- Maintenance endpoints (retention + PDPA anonymization)
- Abuse protection / rate limiting
- Request-id observability and structured HTTP logs

## Explicitly Out of Scope

- SLA runtime as active v1 feature
- Production deployment activity
- Network-edge/WAF/CDN configuration

## Quality Evidence

- Local `release:gate` passes (build + lint + unit + e2e)
- Added/updated e2e coverage for:
  - admin settings validation/update
  - admin audit validation
  - admin attachment upload flow
- Runtime config guard hardened for production CORS policy
- Global security headers middleware enabled

## Main Changes Since Foundation

- CI release gate workflow + postgres service parity
- Preprod smoke workflow (manual trigger)
- Lint hardening and release-gate lint enforcement
- Legacy unused SLA module removed from runtime
- Backend error contract document added
- Security baseline hardening (headers + CORS config guard)
- Post-RC1 structural cleanup: move geo module to `src/modules/geo` (commit `5a46754`)


## Operational Notes

- Do not remove `.github/workflows/backend-release-gate.yml` while branch protection requires it
- Keep `SMOKE_ADMIN_PASSWORD` secret only for optional preprod smoke workflow

## Known Follow-up (Next Phase)

- Wire real OTP email provider in target environment
- Wire real attachment storage provider in target environment
- Execute deploy runbook in preprod/prod
- Add frontend workflow gate after backend freeze is accepted
