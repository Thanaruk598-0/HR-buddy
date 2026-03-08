# Backend Deploy Runbook

This runbook is for deploying the HR-Buddy backend service to a production-like environment.

## 1) Scope and Current Feature Set

The current backend scope includes:

- Employee request creation and self-service tracking via OTP session
- Admin authentication and request operation flows
- Messenger magic-link status update flow
- In-app notifications
- Attachment upload ticket and download URL flow
- Admin summary and CSV export
- Admin settings CRUD for reference data
- Retention purge module and admin purge trigger endpoint

SLA runtime logic is intentionally out of v1 scope. SLA database tables may still exist for compatibility.

## 2) Prerequisites

- Node.js 22.x LTS
- npm 10+ (use `npm.cmd` on this machine)
- PostgreSQL 15+
- Environment variables prepared from `.env.example`
- App host URL and CORS origin finalized
- OTP and attachment providers chosen (`console` or `webhook`)

## 3) Environment Setup

1. Create env file:

```powershell
Copy-Item .env.example .env
```

2. Update required values in `.env` at minimum:

- `DATABASE_URL`
- `CORS_ORIGINS` (non-localhost origins for production)
- `CORS_ALLOW_CREDENTIALS`
- `OTP_HASH_SECRET`
- `ATTACHMENT_UPLOAD_TICKET_SECRET`
- `MESSENGER_MAGIC_LINK_SECRET`
- `ADMIN_SESSION_SECRET`
- `ADMIN_PASSWORD`

3. If using webhook providers, set:

- `OTP_DELIVERY_PROVIDER=webhook` + `OTP_WEBHOOK_URL`
- `ATTACHMENT_STORAGE_PROVIDER=webhook` + `ATTACHMENT_STORAGE_WEBHOOK_URL`

4. For pre-prod/production readiness gate, enable strict provider mode:

- `READINESS_STRICT_PROVIDERS=true`

## 4) Install and Build

```powershell
npm.cmd install
npm.cmd run build
npm.cmd run release:gate
```

## 5) Database Migration

Apply schema migrations:

```powershell
npx prisma migrate deploy
```

Optional: generate Prisma client explicitly (if your pipeline does not run it):

```powershell
npx prisma generate
```

## 6) Start Service

Production mode:

```powershell
npm.cmd run start:prod
```

Development/watch mode:

```powershell
npm.cmd run start:dev
```

## 7) Smoke Tests After Deploy

Run these checks after startup:

1. Health endpoint:

```http
GET /health
```

Expected: `ok: true`

2. Readiness endpoint:

```http
GET /health/ready
```

Expected: `ok: true` and all checks healthy

3. Database health endpoint:

```http
GET /health/db
```

Expected: `ok: true`

4. Admin login:

```http
POST /admin/auth/login
```

Expected: 200 and admin session token

5. Employee OTP send (non-production console provider):

```http
POST /auth-otp/send
```

Expected: 200 with OTP message accepted

6. Admin export endpoint:

```http
GET /admin/requests/export/csv
```

Expected: 200 with `text/csv`

Optional one-command smoke check:
- GitHub Actions: run workflow `Backend Preprod Smoke` with input `base_url` and secret `SMOKE_ADMIN_PASSWORD`.

```powershell
$env:SMOKE_BASE_URL="http://localhost:3001"
$env:SMOKE_ADMIN_USERNAME="admin"
$env:SMOKE_ADMIN_PASSWORD="<admin-password>"
npm.cmd run smoke:preprod
```

## 8) Retention Job Operations

- Scheduled retention runs only when `RETENTION_ENABLED=true`.
- Manual retention run endpoint:

```http
POST /admin/maintenance/retention/run
```

Use this endpoint for emergency cleanup or verification after deploy.

## 9) Rollback Plan

If a release fails:

1. Stop current backend process.
2. Re-deploy previous app artifact/container image.
3. If schema migration is backward compatible, keep DB at latest migration.
4. If migration causes breakage, restore database from backup according to infra policy.
5. Re-run smoke tests from section 7.

## 10) Release Evidence

Capture and store:

- Commit hash deployed
- Environment target (staging/production)
- Migration version applied
- Smoke test results with timestamp
- Operator name who performed deployment


