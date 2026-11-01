# Investigation: Payout accounts endpoint returns 404

## Hand-off Brief

1. **What happened.** The user's payout page receives `Cannot GET /api/v1/users/payout-accounts`, although the checked-in web/API routing agrees on that route.
2. **Where the case stands.** Active; source evidence indicates a request-target or runtime mismatch is more likely than a missing database table; actual workplace runtime values are unavailable.
3. **What's needed next.** Compare effective `INTERNAL_API_URL`, `API_URL`, and `PORT` values and capture the browser request host/API logs to identify the responding process.

## Case Info

| Field            | Value                                                                      |
| ---------------- | -------------------------------------------------------------------------- |
| Ticket           | N/A                                                                        |
| Date opened      | 2026-11-01                                                                 |
| Status           | Active                                                                     |
| System           | Windows; application is being run at the user's workplace; versions unknown |
| Evidence sources | User-reported HTTP error; frontend caller, Next.js rewrite, API startup/prefix, controller/module, Prisma schema, Docker Compose, git history |

## Problem Statement

The user says the project worked at home but is not working at work, possibly because database tables are missing. They now report `Internal server error` and `Cannot GET /api/v1/users/payout-accounts`. The missing-table explanation is an unverified hypothesis.

## Evidence Inventory

| Source        | Status    | Notes |
| --------      | --------- | ----- |
| User message  | Available | Exact reported response: `Internal server error` / `Cannot GET /api/v1/users/payout-accounts`. |
| Repository    | Available | Matching route exists at `apps/api/src/modules/users/payout.controller.ts:29-34` and is in module controllers at `apps/api/src/modules/users/users.module.ts:18`. |
| API startup/config | Partial | Next rewrite defaults to `http://localhost:4000`; `INTERNAL_API_URL` or `API_URL` can override. Runtime values are unknown. |
| Docker Compose | Available | Defines PostgreSQL, MinIO, Mailpit; no API or web service. |
| Tests | Available | Payout controller tests exist; test results not run in this investigation. |
| Runtime logs  | Missing   | No server logs or process details provided. |
| Database      | Partial   | Prisma schema declares model `PayoutAccount` mapped to `payout_accounts`; actual migration/table state is unknown. |
| Version control | Available | Payout implementation appears in commit `0c836f6`; cross-machine commit/branch comparison not performed. |

## Investigation Backlog

| # | Path to Explore | Priority | Status | Notes |
| - | --------------- | -------- | ------ | ----- |
| 1 | Trace registration of `GET /api/v1/users/payout-accounts` and frontend request target | High | Done | Frontend path, Next rewrite, API prefix, controller, and module registration align in source. |
| 2 | Inspect database migration/startup setup and local infrastructure instructions | High | Open | Schema declares `payout_accounts`; runtime table presence is unknown and does not explain an unmatched route response. |
| 3 | Obtain effective runtime URL/port, browser request host, and API logs | High | Blocked | Needed to identify the actual answering process and distinguish a wrong target from stale code. |

## Timeline of Events

| Time | Event | Source | Confidence |
| ----------- | --------------------- | --------------------- | --------------------- |
| Unknown | User reports project worked at home but fails at work; suspects missing database tables. | User message | Confirmed as reported; cause unconfirmed |
| 2026-11-01 | User reports GET `/api/v1/users/payout-accounts` returns `Cannot GET ...`. | User message | Confirmed as reported |

## Confirmed Findings

### Finding 1: Requested GET path is not handled by the responding server

**Evidence:** User-reported response: `Cannot GET /api/v1/users/payout-accounts`.

**Detail:** This response indicates that the server answering this request did not handle the requested GET path. It does not by itself establish whether the route is absent from the application, the request reached the wrong service, or a proxy/prefix configuration is incorrect.

### Finding 2: Repository source implements and registers the GET route

**Evidence:** `apps/api/src/modules/users/payout.controller.ts:29-34`; `apps/api/src/modules/users/users.module.ts:18`.

**Detail:** `PayoutController` is decorated with `@Controller('users/payout-accounts')` and defines `@Get()`. The users module includes it in its controller list. The codebase therefore has the route under the configured global prefix, but that does not prove the workplace process is running this code.

### Finding 3: Frontend and API route configuration agree in source

**Evidence:** `apps/web/src/app/app/settings/payout/page.tsx:51-55`; `apps/web/next.config.ts:20-29`; `apps/api/src/main.ts:31`; `apps/api/src/app.module.ts:9,29`.

**Detail:** The payout page requests `/api/v1/users/payout-accounts`. Next.js rewrites `/api/:path*` to `INTERNAL_API_URL`, then `API_URL`, then `http://localhost:4000`. The API listens on `PORT` or `4000`, sets prefix `api/v1`, and imports the module that registers `PayoutController`. The committed source therefore has a consistent path, but the effective workplace environment and request destination remain unknown.

### Finding 4: Database model exists in the Prisma schema; runtime table state is unknown

**Evidence:** `apps/api/prisma/schema.prisma:241-257`.

**Detail:** The schema declares `PayoutAccount` mapped to `payout_accounts`. This does not establish whether the workplace database has been migrated. A missing table could fail after the request reaches the handler, but cannot by itself explain the reported `Cannot GET` route lookup response.

## Deduced Conclusions

### Deduction 1: Missing database tables are not yet established as the cause

**Based on:** Findings 1, 2, and 3.

**Reasoning:** The frontend path, Next.js rewrite, API prefix, registered controller, and module import agree in checked-in source, while the responding server reports no GET handler. This points more strongly to an effective runtime destination/process mismatch or stale deployment. Database state should be checked separately, but it does not explain a route-not-found response.

**Conclusion:** A wrong/different API process, request target, or deployment/runtime configuration is more plausible than missing database tables. Effective workplace environment values and request logs are needed to identify which.

## Hypothesized Paths

### Hypothesis 1: Route registration or request routing differs at work

**Status:** Open

**Theory:** The route may not be implemented/registered in the running API, or the web app may be sending the request to a service that does not own it.

**Supporting indicators:** The repository caller and route agree, but the reported response says the answering server does not handle it; Next.js permits `INTERNAL_API_URL` and `API_URL` overrides.

**Would confirm:** Browser/API logs show the request reaching a process or target that lacks the route, or effective runtime environment/startup uses stale/different code or a different prefix.

**Would refute:** The request is confirmed to reach the intended API process running this source and still fails before entering database logic.

**Resolution:** Source-level absence and checked-in path/prefix mismatch are refuted; runtime routing remains unverified.

## Missing Evidence

| Gap | Impact | How to Obtain |
| ---------------- | -------------------------------- | --------------- |
| API/web startup commands and active URL | Distinguishes wrong service or proxy from a missing route | Share terminal commands/output and browser Network request URL. |
| API logs for the request | Identifies which process answered and whether a handler was reached | Capture API terminal output while reproducing. |
| Database migration status | Determines whether schema initialization is also missing | Inspect migration status after confirming route registration. |

## Source Code Trace

| Element | Detail |
| ------------- | ------------------------------------------- |
| Error origin | Responding server's route lookup; runtime identity unknown. |
| Trigger | Payout page issues GET `/api/v1/users/payout-accounts`. |
| Condition | Repository route and rewrite are aligned, but the answering process reports no handler; effective destination/process is unknown. |
| Related files | `apps/web/src/app/app/settings/payout/page.tsx:51-55`; `apps/web/next.config.ts:20-29`; `apps/api/src/main.ts:31,56-57`; `apps/api/src/modules/users/payout.controller.ts:29-38`; `apps/api/src/modules/users/users.module.ts:13-18`; `apps/api/src/app.module.ts:9,15-17,29`. |

## Conclusion

**Confidence:** Medium

The reported response says the requested path is not handled by the answering server, while the checked-in web caller, rewrite, API prefix, and registered route align. A wrong/stale runtime target or request-routing mismatch is therefore more likely than missing database tables. The effective workplace environment and answering process remain unverified.

## Recommended Next Steps

### Fix direction

Not established. Trace route registration, API prefix, and web-to-API request routing first; then inspect schema/migrations if the handler exists and reaches database operations.

### Diagnostic

Inspect the route definition and the frontend request URL, then compare both with the API's configured global prefix and proxy target. If ambiguity remains, capture the request in the API logs.

## Reproduction Plan

1. Start the project's documented local services and API.
2. Send GET `/api/v1/users/payout-accounts` to the same origin used by the web app.
3. Record the full URL, response status/body, API process logs, and whether the handler is entered.

## Side Findings

- None.

## Follow-up: 2026-11-01

### New Evidence

- The Prisma schema declares 30 models/tables, including `users`, `identity_documents`, `payout_accounts`, `sessions`, and other application data. See `apps/api/prisma/schema.prisma`.
- Passwords are represented by `User.passwordHash` in `users`; there is no separate password-change table in the schema.
- `apps/api/prisma` contains `schema.prisma` and `seed.ts`, but no checked-in `migrations` directory. The API package provides `prisma:push` (`prisma db push`).
- `docker compose ps` on this workspace reported no running services. This says nothing conclusive about the user's other machine.
- Compose defines the local PostgreSQL service and named persistent volume `postgres_data`; it also starts MinIO and Mailpit.
- User ran `docker compose up -d` on the work machine; PostgreSQL, MinIO, and Mailpit started, and PostgreSQL reported healthy.
- User's `prisma generate` failed with Windows `EPERM` renaming `query_engine-windows.dll.node.tmp...` over `query_engine-windows.dll.node`.
- User's `prisma db push` reported `The database is already in sync with the Prisma schema`, then failed with the same `EPERM` during engine rename.
- A query run inside the Compose PostgreSQL container returned zero rows from `pg_tables` for schema `public`.

### Additional Findings

- The database is running on the user's machine, but the evidence conflicts: Prisma reports the schema is already synchronized while a direct query to the Compose PostgreSQL server shows no public tables.
- `EPERM` is confirmed to affect Prisma Client engine-file replacement on Windows. The output alone does not establish whether the same file lock caused or followed the database synchronization result.
- Missing tables may explain API failures after a valid route reaches Prisma. It does not account for the separately reported `Cannot GET` response, which indicates an unhandled route on the responding server.

### Updated Hypotheses

- The Compose database may still be uninitialized, or Prisma may be connecting to a different PostgreSQL endpoint than the one queried inside the container; this discrepancy requires a direct endpoint comparison.
- A Windows process or security scanner may be holding the Prisma query engine DLL open, preventing client generation.
- A runtime/request-target mismatch remains open for the `Cannot GET` response.

### Backlog Changes

- Done: user started Compose services and confirmed PostgreSQL is healthy.
- In progress: independently run Prisma schema push with generation skipped, then query the container's public table list again.
- Open: verify which PostgreSQL endpoint Prisma reaches and which process is locking the Prisma engine DLL.

### Updated Conclusion

The user's direct database query confirms that the Compose PostgreSQL instance currently has zero public tables. However, the same run reports Prisma considers its target schema synchronized, so it is not yet proven that both checks reached the same database endpoint or that the push actually applied the schema. `EPERM` confirms Prisma Client generation is blocked by a Windows file rename/lock issue. The route-not-found symptom remains separate from database table existence.
