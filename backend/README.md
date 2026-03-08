# HR-Buddy Backend

Backend API for HR-Buddy internal service request platform (Construction Lines).

## Current v1 Scope

Implemented modules:

- `requests`
- `admin-auth`
- `admin-requests`
- `admin-audit`
- `admin-settings`
- `auth-otp`
- `messenger`
- `notifications`
- `attachments`
- `reference`
- `maintenance`
- `activity-log`
- `geo`

SLA runtime is not part of active v1 delivery scope, even if legacy SLA code or tables remain in repository/database.

## Tech Stack

- NestJS 11
- Prisma + PostgreSQL
- TypeScript

## Prerequisites

- Node.js 22+
- npm 10+
- PostgreSQL 15+

On this machine, use `npm.cmd` instead of `npm`.

## Setup (Local)

1. Install dependencies:

```powershell
npm.cmd install
```

2. Create env file:

```powershell
Copy-Item .env.example .env
```

3. Update required secrets and database connection in `.env`.

4. Apply migrations:

```powershell
npx prisma migrate deploy
```

5. Run the API:

```powershell
npm.cmd run start:dev
```

API default port is `3001`.

## Useful Commands

```powershell
npm.cmd run build
npm.cmd run test
npm.cmd run test:e2e
npm.cmd run lint
```

## Optional Dev Seed

If you want sample data for development:

```powershell
npx ts-node scripts/seed-dev.ts
```

## Delivery and Operations Docs

- [Deploy Runbook](./docs/deploy-runbook.md)
- [Operations Checklist](./docs/operations-checklist.md)

## Health Endpoints

- `GET /health`
- `GET /health/db`

## Observability Baseline

- Every response includes `x-request-id` for request correlation.
- If client sends `x-request-id`, backend reuses that value.
- Access and error logs are emitted as structured JSON events (`http_request`, `http_exception`).

## Admin Audit APIs

- `GET /admin/audit/activity-logs` (filter + pagination)
- `GET /admin/audit/activity-logs/export/csv` (CSV export for compliance)

## Rate Limiting / Abuse Protection

- Global abuse protection guard is enabled by default (`ABUSE_PROTECTION_ENABLED=true`).
- Policy-based limits are applied on high-risk routes:
- `POST /auth-otp/send` (`otpSend`)
- `POST /auth-otp/verify` (`otpVerify`)
- `POST /admin/auth/login` (`adminLogin`)
- `POST /requests/building|vehicle|messenger|document` (`requestCreate`)
- Exceeded limits return `429` with `Retry-After` and rate limit headers.
- Store backend is configurable via `ABUSE_PROTECTION_STORE`:
- `memory` (default, single-instance)
- `postgres` (multi-instance safe via shared DB counters)
- Optional postgres tuning:
- `ABUSE_PROTECTION_POSTGRES_RETRY_AFTER_SECONDS`
- `ABUSE_PROTECTION_POSTGRES_CLEANUP_INTERVAL_SECONDS`
- `ABUSE_PROTECTION_POSTGRES_RETENTION_HOURS`
