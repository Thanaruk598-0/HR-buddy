# Legal Compliance Checklist (TH)

This document tracks technical and operational controls for Thai legal baseline readiness of the HR-Buddy backend.

Important: This is an engineering checklist, not legal advice.

## 1) Legal Scope Covered by This Checklist

- Computer-Related Crime Act B.E. 2550 (traffic data retention baseline)
- MDES announcement on computer traffic data retention (B.E. 2564)
- PDPA technical controls related to logging, retention, and data minimization

## 2) Implemented in Backend (Done)

- [x] Request ID is generated/reused and included in access/error logs
- [x] Activity/Audit logs are written for critical business actions
- [x] Retention job exists for scheduled/manual purge
- [x] PDPA anonymize capability exists for supported entities
- [x] Production runtime guard enforces secure baseline
- [x] Release gate validates build, lint, unit, and e2e tests
- [x] Production requires `RETENTION_ACTIVITY_LOGS_DAYS >= 90`

## 3) Organization Process Still Required (Not Code-Only)

- [ ] Define roles: Data Controller, System Owner, Operator
- [ ] Publish SOP for lawful data disclosure and chain-of-custody
- [ ] Define legal-hold process to pause purge for requested scope
- [ ] Define incident response workflow with evidence retention
- [ ] Publish Privacy Notice and internal data handling policy
- [ ] Review retention schedule at least annually

## 4) Production Environment Baseline

- `NODE_ENV=production`
- `RUNTIME_ENV=production`
- `RUNTIME_CONFIG_STRICT=true`
- `HEALTH_CHECK_TOKEN=<strong-secret>`
- `ABUSE_PROTECTION_STORE=postgres`
- `ABUSE_PROTECTION_POSTGRES_FAIL_CLOSED_IN_PRODUCTION=true`
- `RETENTION_ENABLED=true`
- `RETENTION_ACTIVITY_LOGS_DAYS=90` or more

## 5) Audit Evidence to Keep

- Deployed commit hash and release gate result
- Sanitized env proof (without exposing secrets)
- Retention run logs/results
- Incident and recovery logs
- Change approval records

## 6) Infra/Platform Responsibilities

- Ensure platform log retention matches legal baseline
- Ensure NTP/time synchronization is configured
- Ensure backup and restore procedures are tested
- Ensure secret rotation and access control are enforced

## 7) Official References

- Computer-Related Crime Act (MDES official page, unofficial translation):
  - https://www.mdes.go.th/law/detail/3618-COMPUTER-RELATED-CRIME-ACT-B-E--2550--2007-
- MDES news/explainer on computer traffic data retention announcement (B.E. 2564):
  - https://mdes.go.th/news/detail/4603-%E0%B8%94%E0%B8%B5%E0%B8%AD%E0%B8%B5%E0%B9%80%E0%B8%AD%E0%B8%AA-%E0%B8%A2%E0%B9%89%E0%B8%B3%E0%B8%AB%E0%B8%A5%E0%B8%B1%E0%B8%81%E0%B9%80%E0%B8%81%E0%B8%93%E0%B8%91%E0%B9%8C%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B9%80%E0%B8%81%E0%B9%87%E0%B8%9A%E0%B8%A3%E0%B8%B1%E0%B8%81%E0%B8%A9%E0%B8%B2%E0%B8%82%E0%B9%89%E0%B8%AD%E0%B8%A1%E0%B8%B9%E0%B8%A5%E0%B8%88%E0%B8%A3%E0%B8%B2%E0%B8%88%E0%B8%A3%E0%B8%97%E0%B8%B2%E0%B8%87%E0%B8%84%E0%B8%AD%E0%B8%A1%E0%B8%9E%E0%B8%B4%E0%B8%A7%E0%B9%80%E0%B8%95%E0%B8%AD%E0%B8%A3%E0%B9%8C%E0%B8%AF-%E0%B8%9E-%E0%B8%A8--2564-%E0%B9%80%E0%B8%9E%E0%B8%B7%E0%B9%88%E0%B8%AD%E0%B8%84%E0%B8%B8%E0%B9%89%E0%B8%A1%E0%B8%84%E0%B8%A3%E0%B8%AD%E0%B8%87%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%8A%E0%B8%B2%E0%B8%8A%E0%B8%99%E0%B8%88%E0%B8%B2%E0%B8%81%E0%B8%A0%E0%B8%B1%E0%B8%A2%E0%B9%82%E0%B8%8B%E0%B9%80%E0%B8%8A%E0%B8%B5%E0%B8%A2%E0%B8%A5
