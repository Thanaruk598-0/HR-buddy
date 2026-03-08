# Backend Project Structure

This document defines the backend folder layout for v1 and the ownership of each area.

## Source Tree

```text
backend/
  src/
    app.module.ts
    app.controller.ts
    bootstrap/
    common/
      http/
      security/
    config/
    data/
      geo/compiled/
    health/
    modules/
      activity-log/
      admin-audit/
      admin-auth/
      admin-requests/
      admin-settings/
      attachments/
      auth-otp/
      geo/
      maintenance/
      messenger/
      notifications/
      reference/
      requests/
    prisma/
  prisma/
  scripts/
  test/
  docs/
```

## Folder Ownership

- `src/common`: shared middleware/guards/interceptors/utilities.
- `src/config`: runtime config mapping + env validation rules.
- `src/health`: liveness/readiness checks.
- `src/prisma`: Prisma service/module wiring only.
- `src/modules/*`: business features grouped by domain.
- `src/data`: static runtime datasets (for example geo compiled data).
- `scripts`: operational scripts (gate/smoke/freeze/seed/compile).
- `docs`: delivery and operations documentation.

## Module Conventions

- Every business module lives under `src/modules/<module-name>`.
- Keep controllers/services/dto/rules/types inside each module folder.
- Cross-module shared logic goes to `src/common`, not another module.
- Avoid creating new top-level feature folders under `src/`.

## Current Notes

- `geo` module was moved to `src/modules/geo` for consistency with other modules.
- Dataset override is controlled by `GEO_DATASET_PATH` and falls back to source/dist/cwd candidates.
