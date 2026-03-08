# Backend Operations Checklist

Use this checklist to operate HR-Buddy backend in day-to-day production support.

## 1) Daily Checks

- Verify API liveness:
  - `GET /health`
  - `GET /health/ready`
  - `GET /health/db`
- Review admin login success/failure logs
- Review error logs from OTP delivery pipeline
- Review attachment upload/download errors
- Confirm no unusual spike in failed status transitions
- Confirm no unusual spike in OTP verify failures

## 2) Request Flow Monitoring

- Ensure each status update creates activity logs
- Ensure canceled requests include cancel reason
- Ensure document requests enforce preconditions before DONE
- Spot check messenger requests for pickup event logs

## 3) Security and Access Controls

- Rotate `ADMIN_PASSWORD` and all service secrets on schedule
- Keep `OTP_HASH_SECRET`, `ADMIN_SESSION_SECRET`, and token secrets out of source control
- Confirm admin-only endpoints remain behind admin guard
- Confirm employee endpoints requiring OTP session remain behind employee guard

## 4) Data Retention and Privacy

- Keep retention settings aligned with company PDPA policy
- Confirm periodic retention purge is active when required
- Trigger manual purge as needed:
  - `POST /admin/maintenance/retention/run`
- Verify purge result counts and log outcomes

## 5) Backup and Recovery

- Verify scheduled PostgreSQL backups complete successfully
- Test restore process on non-production environment regularly
- Keep last known good application artifact ready for rollback

## 6) Incident Response (Minimum)

- Classify incident: auth, data integrity, delivery provider, database, or infrastructure
- Capture timeline and impacted endpoints
- Mitigate user-facing impact first
- Record root cause and recovery steps
- Add follow-up issue with owner and due date

## 7) Weekly Maintenance

- Review request/error trends from logs
- Review growth rate of activity logs and notifications
- Validate retention windows are still correct
- Validate webhook provider connectivity and timeout settings
- Run e2e regression suite at least once per week

## 8) Change Management Checklist

Before shipping backend changes:

- Release gate passes: `npm.cmd run release:gate` (build + lint + tests + e2e)
- Optional preprod smoke in gate: set `RELEASE_GATE_INCLUDE_SMOKE=true` then rerun `npm.cmd run release:gate`
- Migration impact reviewed
- New env keys documented in `.env.example`
- Error code changes documented in `docs/error-contract.md`
- Runbook updated when operational behavior changes

