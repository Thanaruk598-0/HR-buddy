# Backend Error Contract (v1)

This document defines the API error contract currently used by HR-Buddy backend v1.

## 1) Response Shapes

### 1.1 Business/Domain Error (with `code`)

Most service/guard/domain errors return this shape:

```json
{
  "statusCode": 400,
  "code": "SOME_ERROR_CODE",
  "message": "Human-readable message"
}
```

Additional fields may be included for specific errors (for example `field`, `retryAfterSeconds`, `requestNos`, `eligibleOn`).

### 1.2 DTO Validation Error (class-validator)

ValidationPipe errors do not include domain `code`:

```json
{
  "statusCode": 400,
  "message": ["field must be ..."],
  "error": "Bad Request"
}
```

Frontend should handle both forms:

1. If `code` exists: branch by `code`
2. Otherwise: render validation messages from `message`

## 2) HTTP Status Usage

- `400 Bad Request`: invalid input, rule violation, invalid transition, invalid state
- `401 Unauthorized`: missing/invalid employee/admin session, invalid admin credentials
- `403 Forbidden`: resource exists but caller has no permission
- `404 Not Found`: resource/session/magic link/notification not found
- `429 Too Many Requests`: abuse protection rate-limit policy exceeded

## 3) Rate Limit Contract

When blocked by abuse protection, API returns:

```json
{
  "statusCode": 429,
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Please retry later.",
  "policy": "otpSend",
  "retryAfterSeconds": 60
}
```

Headers included:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After` (when blocked)

## 4) Error Code Catalog (Current v1)

### 4.1 Auth and Session

| Code | Status | Typical endpoint/area |
|---|---:|---|
| `INVALID_ADMIN_CREDENTIALS` | 401 | `POST /admin/auth/login` |
| `ADMIN_SESSION_TOKEN_REQUIRED` | 401 | admin guarded endpoints |
| `INVALID_OR_EXPIRED_ADMIN_SESSION` | 401 | admin guarded endpoints |
| `SESSION_TOKEN_REQUIRED` | 401 | employee guarded endpoints |
| `INVALID_OR_EXPIRED_SESSION` | 401 | employee guarded endpoints |

### 4.2 OTP

| Code | Status | Typical endpoint/area |
|---|---:|---|
| `OTP_SESSION_NOT_FOUND` | 404 | `POST /auth-otp/verify` |
| `OTP_EXPIRED` | 400 | `POST /auth-otp/verify` |
| `OTP_ATTEMPTS_EXCEEDED` | 400 | `POST /auth-otp/verify` |
| `INVALID_OTP_CODE` | 400 | `POST /auth-otp/verify` |
| `OTP_COOLDOWN_ACTIVE` | 400 | `POST /auth-otp/send` |
| `OTP_RATE_LIMITED` | 400 | `POST /auth-otp/send` |

### 4.3 Request Creation and Employee Actions

| Code | Status | Typical endpoint/area |
|---|---:|---|
| `INVALID_DEPARTMENT_ID` | 400 | create request |
| `DUPLICATE_REQUEST` | 400 | create request dedupe |
| `INVALID_PROBLEM_CATEGORY_ID` | 400 | building create |
| `PROBLEM_CATEGORY_OTHER_REQUIRED` | 400 | building create |
| `INVALID_VEHICLE_ISSUE_CATEGORY_ID` | 400 | vehicle create |
| `VEHICLE_ISSUE_CATEGORY_OTHER_REQUIRED` | 400 | vehicle create |
| `DELIVERY_SERVICE_REQUIRED` | 400 | messenger create |
| `DELIVERY_SERVICE_OTHER_REQUIRED` | 400 | messenger create |
| `INVALID_NEEDED_DATE` | 400 | document create |
| `DELIVERY_ADDRESS_REQUIRED` | 400 | document create |
| `DELIVERY_ADDRESS_NOT_ALLOWED` | 400 | document create |
| `REQUEST_NOT_CANCELABLE_BY_EMPLOYEE` | 400 | cancel request |
| `NOT_FOUND` | 404 | request detail/cancel |
| `FORBIDDEN` | 403 | request detail/cancel |

### 4.4 Admin Request Actions

| Code | Status | Typical endpoint/area |
|---|---:|---|
| `NOT_FOUND` | 404 | `PATCH /admin/requests/:id/status`, detail |
| `INVALID_OPERATOR_ID` | 400 | admin status update / PDPA |
| `OPERATOR_INACTIVE` | 400 | admin status update / PDPA |
| `INVALID_STATUS_TRANSITION` | 400 | admin status update |
| `NOTE_REQUIRED_FOR_ACTION` | 400 | admin status update |
| `DOCUMENT_DETAIL_NOT_FOUND` | 400 | document admin action |
| `INVALID_DIGITAL_FILE_ATTACHMENT_ID` | 400 | document admin action |
| `DIGITAL_FILE_ATTACHMENT_MUST_BE_DOCUMENT` | 400 | document admin action |
| `DELIVERY_ADDRESS_REQUIRED_BEFORE_APPROVED` | 400 | document admin action |
| `DELIVERY_ADDRESS_REQUIRED_BEFORE_DONE` | 400 | document admin action |
| `DIGITAL_FILE_REQUIRED_BEFORE_DONE` | 400 | document admin action |
| `PICKUP_NOTE_REQUIRED_BEFORE_DONE` | 400 | document admin action |

### 4.5 Attachments

| Code | Status | Typical endpoint/area |
|---|---:|---|
| `INVALID_ATTACHMENT_MIME_TYPE` | 400 | presign/add attachment |
| `ATTACHMENT_FILE_TOO_LARGE` | 400 | presign/add attachment |
| `ATTACHMENT_COUNT_LIMIT_EXCEEDED` | 400 | presign/add attachment |
| `INVALID_ATTACHMENT_UPLOAD_TOKEN` | 400 | complete upload |
| `ATTACHMENT_UPLOAD_TOKEN_EXPIRED` | 400 | complete upload |
| `ATTACHMENT_UPLOAD_TOKEN_REQUEST_MISMATCH` | 400 | complete upload |
| `ATTACHMENT_UPLOAD_TOKEN_ROLE_MISMATCH` | 400 | complete upload |
| `DUPLICATE_ATTACHMENT_STORAGE_KEY` | 400 | add/complete attachment |
| `REQUEST_NOT_FOUND` | 404 | attachment access |
| `ATTACHMENT_NOT_FOUND` | 404 | download URL |
| `FORBIDDEN` | 403 | employee attachment access |

### 4.6 Messenger Magic Link

| Code | Status | Typical endpoint/area |
|---|---:|---|
| `MAGIC_LINK_NOT_FOUND` | 404 | messenger token flow |
| `INVALID_MAGIC_LINK_REQUEST_TYPE` | 400 | messenger token flow |
| `MAGIC_LINK_REVOKED` | 400 | messenger token flow |
| `MAGIC_LINK_EXPIRED` | 400 | messenger token flow |
| `INVALID_MESSENGER_TARGET_STATUS` | 400 | messenger status update |
| `INVALID_MESSENGER_STATUS_TRANSITION` | 400 | messenger status update |
| `PICKUP_EVENT_NOT_ALLOWED` | 400 | messenger pickup event |
| `REQUIRED_TEXT_MISSING` | 400 | messenger report problem |

### 4.7 Admin Settings

| Code | Status | Typical endpoint/area |
|---|---:|---|
| `VALIDATION_ERROR` | 400 | name normalization rules |
| `NO_UPDATE_FIELDS` | 400 | empty patch payload |
| `DEPARTMENT_NAME_EXISTS` | 400 | department create/update |
| `DEPARTMENT_NOT_FOUND` | 404 | department update |
| `PROBLEM_CATEGORY_NAME_EXISTS` | 400 | problem category create/update |
| `PROBLEM_CATEGORY_NOT_FOUND` | 404 | problem category update |
| `VEHICLE_ISSUE_CATEGORY_NAME_EXISTS` | 400 | vehicle issue category create/update |
| `VEHICLE_ISSUE_CATEGORY_NOT_FOUND` | 404 | vehicle issue category update |
| `OPERATOR_NAME_EXISTS` | 400 | operator create/update |
| `OPERATOR_NOT_FOUND` | 404 | operator update |

### 4.8 Notifications

| Code | Status | Typical endpoint/area |
|---|---:|---|
| `NOTIFICATION_NOT_FOUND` | 404 | mark read (employee/admin) |

### 4.9 PDPA Maintenance

| Code | Status | Typical endpoint/area |
|---|---:|---|
| `NOT_FOUND` | 404 | request anonymize |
| `PDPA_SUBJECT_NOT_FOUND` | 404 | subject anonymize |
| `REQUEST_NOT_TERMINAL` | 400 | request/subject anonymize |
| `REQUEST_NOT_CLOSED` | 400 | request/subject anonymize |
| `REQUEST_ANONYMIZE_TOO_EARLY` | 400 | request/subject anonymize |
| `PDPA_SUBJECT_CONTAINS_INELIGIBLE_REQUESTS` | 400 | subject anonymize |
| `INVALID_OPERATOR_ID` | 400 | request/subject anonymize |
| `OPERATOR_INACTIVE` | 400 | request/subject anonymize |

## 5) Frontend Handling Recommendation

1. Always parse `statusCode` and `code` when available.
2. Keep a centralized error-code mapping in frontend (toast/dialog copy).
3. Fallback for unknown errors: show generic message and include request id from `x-request-id` for support.
4. Treat `429 RATE_LIMIT_EXCEEDED` as retryable with timer from `retryAfterSeconds`/`Retry-After`.

## 6) Compatibility Note

This catalog reflects backend source as of 2026-03-09.
Add or change codes only in backward-compatible way, then update this file in the same PR.
