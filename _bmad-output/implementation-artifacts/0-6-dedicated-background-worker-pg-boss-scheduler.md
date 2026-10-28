---
baseline_commit: f7fc54d081c8daa934f4bd0a2a743c9c63c90ce9
---

# Story 0.6: Dedicated Background Worker & pg-boss Scheduler

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a DevOps and backend engineer,
I want a standalone background worker process running ONE `pg-boss` scheduler with singleton keys and idempotent job handlers,
So that recurring business sweeps (payment deadlines, offer expirations, demand lifecycles, and Fal license compliance checks) execute reliably with automated retry backoff and dead-letter safety, without duplicate job execution or resource contention across horizontally scaled API instances.

## Acceptance Criteria

1. **Dedicated Worker Architecture & Singleton Scheduler (`apps/worker`):**
   - **Given** the standalone background worker service in `apps/worker`
   - **When** the worker process bootstraps via `main.ts`
   - **Then** it executes `assertWorkerProductionSafety()` prior to any connection attempts
   - **And** it initializes a single `PgBoss` instance connected to PostgreSQL via `DATABASE_URL` (using schema `pgboss` or standard boss table prefix)
   - **And** `boss.start()` executes schema setup and connection establishment cleanly
   - **And** the worker registers recurring cron schedules for all 7 cataloged domain jobs using explicit `singletonKey` identifiers to guarantee exactly-once scheduling across any worker process restarts or replicas
   - **And** the worker application listens for termination signals (`SIGTERM`, `SIGINT`) and performs a graceful shutdown via `await boss.stop({ graceful: true, timeout: 10000 })`, clearing timers and draining in-flight jobs.

2. **Canonical 7 Background Job Catalog Registration (`apps/worker` & `packages/shared`):**
   - **Given** the worker scheduler initialized
   - **When** `registerSchedules()` is invoked during startup
   - **Then** the following 7 jobs are registered with exact crons, singleton keys, and retention policies per AD-7 and PRD Addendum Section 3:
     1. `payment-deadline-expiry`:
        - Cadence: `* * * * *` (Every 60 seconds)
        - Singleton Key: `payment-deadline-expiry`
        - Options: `retryLimit: 3`, `retryDelay: 10`, `retryBackoff: true`, `expireInMinutes: 2`
     2. `offer-expiry-checker`:
        - Cadence: `*/5 * * * *` (Every 5 minutes)
        - Singleton Key: `offer-expiry-checker`
        - Options: `retryLimit: 3`, `retryDelay: 30`, `retryBackoff: true`, `expireInMinutes: 5`
     3. `demand-expiry-checker`:
        - Cadence: `0 * * * *` (Hourly at minute 0)
        - Singleton Key: `demand-expiry-checker`
        - Options: `retryLimit: 3`, `retryDelay: 60`, `retryBackoff: true`, `expireInMinutes: 15`
     4. `fal-license-expiry`:
        - Cadence: `5 0 * * *` (Daily at 00:05 UTC)
        - Singleton Key: `fal-license-expiry`
        - Options: `retryLimit: 3`, `retryDelay: 120`, `retryBackoff: true`, `expireInMinutes: 30`
     5. `fal-expiry-warnings`:
        - Cadence: `0 5 * * *` (Daily at 08:00 KSA / 05:00 UTC)
        - Singleton Key: `fal-expiry-warnings`
        - Options: `retryLimit: 3`, `retryDelay: 120`, `retryBackoff: true`, `expireInMinutes: 30`
     6. `owner-fee-reminders`:
        - Cadence: `0 6 * * *` (Daily at 09:00 KSA / 06:00 UTC)
        - Singleton Key: `owner-fee-reminders`
        - Options: `retryLimit: 3`, `retryDelay: 120`, `retryBackoff: true`, `expireInMinutes: 30`
     7. `notification-retention`:
        - Cadence: `0 2 * * *` (Daily at 02:00 UTC)
        - Singleton Key: `notification-retention`
        - Options: `retryLimit: 3`, `retryDelay: 300`, `retryBackoff: true`, `expireInMinutes: 60`.

3. **Job Handler Scaffolding, Idempotency & Dead-Letter Resilience (`apps/worker/src/jobs`):**
   - **Given** registered worker queues
   - **When** a scheduled or ad-hoc job triggers
   - **Then** each queue handler executes under a structured try/catch wrapper that logs job start, duration, processed entity count, and errors
   - **And** all temporal comparisons evaluate against `workerClock.now()` (or deterministic clock) rather than unmockable raw `new Date()`
   - **And** each job handler is structured to be strictly idempotent (safe to retry multiple times without duplicate side effects)
   - **And** failures are caught, logged with structured metadata `[Worker DeadLetter / Job Error]`, and bubble up to `pg-boss` to activate exponential backoff retries according to `retryLimit` and `retryDelay`
   - **And** job handlers emit telemetry log entries: `[Job: {jobName}] Started at {time}`, `[Job: {jobName}] Completed in {ms}ms with outcome: {summary}`.

4. **Removal of Schedulers from API Instances (AR8, AD-7 Compliance):**
   - **Given** `apps/api`
   - **When** inspected for scheduler configurations
   - **Then** `ScheduleModule.forRoot()` is removed from `apps/api/src/app.module.ts`
   - **And** no `@Cron()` or `@Interval()` decorators exist within `apps/api`
   - **And** API instances remain purely request/response HTTP gateways, eliminating duplicate cron triggers across horizontally scaled web/API instances.

5. **Shared Job Contracts & Constants (`packages/shared`):**
   - **Given** `packages/shared`
   - **When** imported by `apps/worker` or `apps/api`
   - **Then** exposes canonical job queue names, singleton keys, default cron schedules, and job payload types:
     - Constants:
       - `JOB_PAYMENT_DEADLINE_EXPIRY = 'payment-deadline-expiry'`
       - `JOB_OFFER_EXPIRY_CHECKER = 'offer-expiry-checker'`
       - `JOB_DEMAND_EXPIRY_CHECKER = 'demand-expiry-checker'`
       - `JOB_FAL_LICENSE_EXPIRY = 'fal-license-expiry'`
       - `JOB_FAL_EXPIRY_WARNINGS = 'fal-expiry-warnings'`
       - `JOB_OWNER_FEE_REMINDERS = 'owner-fee-reminders'`
       - `JOB_NOTIFICATION_RETENTION = 'notification-retention'`
     - Objects: `BACKGROUND_JOBS` mapping each job to its queue name, cadence, singleton key, and default retry configuration
     - Types: `JobName`, `JobConfig`, `JobExecutionResult`.

6. **Environment Configuration & Local Tooling:**
   - **Given** the local development environment
   - **When** `npm run dev:worker` or `npm run dev` is executed
   - **Then** `apps/worker` connects to PostgreSQL using `DATABASE_URL` (loaded via `dotenv` or environment)
   - **And** in development, if PostgreSQL is available, `pg-boss` starts and maintains its active polling loop without crashing
   - **And** if `DATABASE_URL` is missing or PostgreSQL is temporarily unreachable during unit test execution, the service fails gracefully with informative diagnostic logs rather than unhandled promise rejections.

7. **Automated Unit & Integration Verification:**
   - **Given** test suites in `apps/worker`, `apps/api`, and `packages/shared`
   - **When** `npm test` is executed across all monorepo workspaces
   - **Then** 100% of tests pass:
     - Unit tests for `apps/worker/src/scheduler.ts` (or `boss.service.ts`) verifying queue registration, singleton schedule assignments, and graceful shutdown handling.
     - Unit tests for each of the 7 job handler modules in `apps/worker/src/jobs/` verifying execution logging, clock evaluation, idempotency, and error handling.
     - Verification tests in `apps/api` confirming `ScheduleModule` is not registered and API starts cleanly without background cron workers.
     - Unit tests in `packages/shared` verifying job constants, definitions, and types.
     - `npm run lint` and `npm run build` pass without warnings or errors across all workspaces.

## Tasks / Subtasks

- [x] Task 1: Define Canonical Background Job Contracts & Constants in `packages/shared` (AC: 5)
  - [x] 1.1 Create `packages/shared/src/constants/jobs.ts`:
    - Define string constants for all 7 cataloged jobs:
      - `JOB_PAYMENT_DEADLINE_EXPIRY = 'payment-deadline-expiry'`
      - `JOB_OFFER_EXPIRY_CHECKER = 'offer-expiry-checker'`
      - `JOB_DEMAND_EXPIRY_CHECKER = 'demand-expiry-checker'`
      - `JOB_FAL_LICENSE_EXPIRY = 'fal-license-expiry'`
      - `JOB_FAL_EXPIRY_WARNINGS = 'fal-expiry-warnings'`
      - `JOB_OWNER_FEE_REMINDERS = 'owner-fee-reminders'`
      - `JOB_NOTIFICATION_RETENTION = 'notification-retention'`
    - Define dictionary `BACKGROUND_JOB_DEFINITIONS` with metadata for each job (name, cadence, singletonKey, retryLimit, retryDelay, retryBackoff, expireInMinutes, description).
  - [x] 1.2 Create `packages/shared/src/types/jobs.ts`:
    - Define types: `JobName`, `JobScheduleConfig`, `JobExecutionResult`, `JobPayload`.
  - [x] 1.3 Export job constants and types in `packages/shared/src/constants/index.ts`, `packages/shared/src/types/index.ts`, and `packages/shared/src/index.ts`.
  - [x] 1.4 Add unit tests in `packages/shared/src/constants/__tests__/jobs.spec.ts` verifying all 7 jobs are defined with valid crons and non-empty singleton keys.
  - [x] 1.5 Run `npm run build:shared` and verify declaration files emit cleanly.

- [x] Task 2: Remove `@nestjs/schedule` Cron from `apps/api` (AC: 4)
  - [x] 2.1 Remove `ScheduleModule.forRoot()` from `apps/api/src/app.module.ts`.
  - [x] 2.2 Verify that `apps/api` has no active `@Cron()` or `@Interval()` decorators.
  - [x] 2.3 Run `npm run test` in `apps/api` and verify all existing API tests pass without regression.

- [x] Task 3: Install & Configure `pg-boss` in `apps/worker` (AC: 1, 6)
  - [x] 3.1 Update `apps/worker/package.json`:
    - Add `pg-boss` dependency (`^10.4.2` or `^10.0.0` per `ARCHITECTURE-SPINE.md`).
    - Add `dotenv` dependency for loading monorepo `.env` (`../../.env`).
  - [x] 3.2 Update `apps/worker/tsconfig.json` if needed to ensure path aliases, module resolution, and declaration maps function smoothly.
  - [x] 3.3 Create `apps/worker/src/config.ts`:
    - Load environment variables (`DATABASE_URL`, `NODE_ENV`, etc.) with fallback defaults and validation.
    - Provide `getWorkerConfig()` returning typed configuration.

- [x] Task 4: Implement Worker Scheduler & Lifecycle Management (`apps/worker/src/scheduler.ts`) (AC: 1, 2)
  - [x] 4.1 Create `apps/worker/src/scheduler.ts`:
    - Class `WorkerScheduler`:
      - Encapsulates `PgBoss` instance.
      - Constructor accepts connection string or configuration object.
      - Method `start()`:
        - Calls `boss.start()`.
        - Calls `registerSchedules()`.
        - Calls `registerHandlers()`.
        - Attaches `boss.on('error', (err) => console.error('[PgBoss Error]', err))`.
      - Method `registerSchedules()`:
        - Iterates over `BACKGROUND_JOB_DEFINITIONS` (or registers the 7 cataloged jobs individually).
        - Calls `boss.schedule(job.name, job.cadence, {}, { singletonKey: job.singletonKey, retryLimit: job.retryLimit, retryDelay: job.retryDelay, retryBackoff: job.retryBackoff, expireInMinutes: job.expireInMinutes })`.
        - Logs successful schedule registration.
      - Method `registerHandlers()`:
        - Calls `boss.work(job.name, handler)` for each cataloged job.
      - Method `stop()`:
        - Calls `await boss.stop({ graceful: true, timeout: 10000 })`.
  - [x] 4.2 Update `apps/worker/src/main.ts`:
    - Load `.env` at entry point (`import 'dotenv/config'` or path resolution).
    - Execute `assertWorkerProductionSafety()`.
    - Instantiate `WorkerScheduler`.
    - Register `SIGTERM` and `SIGINT` process listeners to invoke `await scheduler.stop()`.
    - Maintain heartbeat logger utilizing `workerClock.nowIso()`.

- [x] Task 5: Implement Cataloged Job Handlers in `apps/worker/src/jobs/` (AC: 3)
  - [x] 5.1 Create `apps/worker/src/jobs/payment-deadline-expiry.job.ts`:
    - Handler for `payment-deadline-expiry` queue.
    - Evaluates Deals past `PaymentDeadline` using `workerClock.now()`.
    - Logs execution summary with duration and outcome.
  - [x] 5.2 Create `apps/worker/src/jobs/offer-expiry-checker.job.ts`:
    - Handler for `offer-expiry-checker` queue.
    - Evaluates Offers where `now >= OfferExpiry` (7-day rule).
    - Logs execution summary.
  - [x] 5.3 Create `apps/worker/src/jobs/demand-expiry-checker.job.ts`:
    - Handler for `demand-expiry-checker` queue.
    - Evaluates Demands where `now >= ExpiresAt` (30-day rule).
    - Logs execution summary.
  - [x] 5.4 Create `apps/worker/src/jobs/fal-license-expiry.job.ts`:
    - Handler for `fal-license-expiry` queue.
    - Evaluates Fal profiles where `expiryDate <= today()`.
    - Logs execution summary.
  - [x] 5.5 Create `apps/worker/src/jobs/fal-expiry-warnings.job.ts`:
    - Handler for `fal-expiry-warnings` queue.
    - Evaluates profiles expiring in 30, 7, and 1 days.
    - Logs execution summary.
  - [x] 5.6 Create `apps/worker/src/jobs/owner-fee-reminders.job.ts`:
    - Handler for `owner-fee-reminders` queue.
    - Evaluates owner contracts nearing `ContractFeeDeadline` (7 days).
    - Logs execution summary.
  - [x] 5.7 Create `apps/worker/src/jobs/notification-retention.job.ts`:
    - Handler for `notification-retention` queue.
    - Evaluates notifications older than 90 days.
    - Logs execution summary.
  - [x] 5.8 Create `apps/worker/src/jobs/index.ts` re-exporting all handlers and a handler map.

- [x] Task 6: Comprehensive Automated Tests (AC: 7)
  - [x] 6.1 Create `apps/worker/src/__tests__/scheduler.spec.ts`:
    - Mock `pg-boss` instance.
    - Verify `start()` initializes boss and schedules all 7 jobs with singleton keys.
    - Verify `registerSchedules()` sets correct crons and options.
    - Verify `stop()` performs graceful shutdown.
  - [x] 6.2 Create `apps/worker/src/jobs/__tests__/jobs.spec.ts`:
    - Unit tests for all 7 job handlers verifying proper logging, clock queries, and error handling.
  - [x] 6.3 Verify `apps/api` test suite (`npm test` in `apps/api`) passes without `ScheduleModule`.
  - [x] 6.4 Verify `packages/shared` test suite passes.
  - [x] 6.5 Run full monorepo build (`npm run build`) and linter (`npm run lint`) to ensure zero errors.

- [x] Task 7: Update Sprint Status & Documentation (AC: 7)
  - [x] 7.1 Update `sprint-status.yaml` marking `0-6-dedicated-background-worker-pg-boss-scheduler` as `in-progress` (or `review` upon completion).
  - [x] 7.2 Record all created and modified files in the Dev Agent Record.

## Dev Notes

### Architecture Patterns and Constraints

- **AD-7 — Separate Worker Process (pg-boss Scheduler) & Idempotent Background Job Catalog:**
  - **Binds:** `apps/worker`, `apps/api/src/modules/jobs`, `apps/api/src/modules/deals`, `apps/api/src/modules/audit`.
  - **Prevents:** Lost asynchronous tasks on server reboot, job duplication, distributed scheduler collisions, API thread pool exhaustion, and un-audited background state shifts.
  - **Rule:** Background queues and recurring scheduling run via ONE dedicated scheduler (`pg-boss` schedule with singleton keys) executed in a separate worker process (`apps/worker`), not in every API instance.
  - **Rule:** Recurring scheduled jobs (`@nestjs/schedule` cron) are removed from API instances.
  - **Rule:** Every job handler MUST be strictly idempotent (safe to retry multiple times without duplicate side effects).
  - **Rule:** Any asynchronous state transition executed by background jobs MUST write to the immutable `AuditLog` table within the same database transaction.

- **AR8 — Dedicated Background Worker & pg-boss Scheduler:**
  - Background queues and recurring cron jobs run via ONE scheduler (`pg-boss` with singleton keys) inside a dedicated worker process (`apps/worker`), not in API instances. Remove `@nestjs/schedule` cron from API instances.

- **NFR9 — Payment Deadline Background Execution:**
  - Automated payment timeout cron runs every 60 seconds in dedicated worker process (`apps/worker`) via `pg-boss` and evaluates deals against `PaymentDeadline` using `ClockService.now()` / `workerClock.now()`.

- **NFR10 — High Availability & Queue Resilience:**
  - 99.5% monthly availability; background queues run via `pg-boss` with persistent state, retry backoff, and dead-letter queues in dedicated worker process.

### Canonical Background Job Catalog (pg-boss & Schedulers)

| # | Job Name | Cadence | Singleton Key | Trigger / Scope | Behavioral Effect & Audit Impact |
|---|---|---|---|---|---|
| 1 | `payment-deadline-expiry` | `* * * * *` (Every 60s) | `payment-deadline-expiry` | Scans Deals where `ClockService.now() >= PaymentDeadline` | Cancels deals lacking confirmed proofs, subject to 12h grace period for unreviewed on-time proofs. Reverts listing to `Active`. Logs `DealCancelledByTimeout`. |
| 2 | `offer-expiry-checker` | `*/5 * * * *` (Every 5m) | `offer-expiry-checker` | Scans Offers where `ClockService.now() >= OfferExpiry` | Sets offer status to `Expired`. Emits notifications to buyer and seller. |
| 3 | `demand-expiry-checker` | `0 * * * *` (Hourly) | `demand-expiry-checker` | Scans Demands where `ClockService.now() >= ExpiresAt` | Sets demand to `Expired`; closes unaccepted proposals. |
| 4 | `fal-license-expiry` | `5 0 * * *` (Daily 00:05 UTC) | `fal-license-expiry` | Scans approved Fal profiles where `expiryDate <= today()` | Moves profile to `ComplianceRestricted`; moves active listings to `UnderComplianceReview`. Emits fraud/compliance alert. |
| 5 | `fal-expiry-warnings` | `0 5 * * *` (Daily 08:00 KSA) | `fal-expiry-warnings` | Scans profiles expiring in 30, 7, and 1 days | Dispatches urgent renewal alerts via in-app and email. |
| 6 | `owner-fee-reminders` | `0 6 * * *` (Daily 09:00 KSA) | `owner-fee-reminders` | Scans contracts in `SignedPendingFee` | Sends payment reminder alerts to owners. |
| 7 | `notification-retention` | `0 2 * * *` (Daily 02:00 UTC) | `notification-retention` | Scans notifications older than 90 days | Hard deletes old notification records to optimize table size. |

### Technical Stack & Dependencies

- **`pg-boss` Version:** `10.x` (`^10.4.2` or `^10.0.0` as specified in `ARCHITECTURE-SPINE.md`). `pg-boss` manages Postgres tables automatically (prefix `pgboss` or schema `pgboss`).
- **PostgreSQL Connection:** Connects via `DATABASE_URL` (`postgresql://elmasaif_user:elmasaif_password@localhost:5432/elmasaif_db?schema=public`).
- **Clock Abstraction:** Uses `workerClock` (from Story 0.5) to ensure future deterministic time testing or virtual offset capabilities are maintained in background tasks.
- **Graceful Shutdown:** `boss.stop({ graceful: true, timeout: 10000 })` on `SIGTERM` / `SIGINT`.

### Previous Story Intelligence & Learnings

- **From Story 0.5 (`0-5-deterministic-clockservice-hard-startup-guard.md`):**
  - `apps/worker` already contains `startup-guard.ts` (`assertWorkerProductionSafety()`) and `clock.ts` (`workerClock`).
  - Worker tests run using Vitest (`vitest run`).
  - Strict monorepo ESLint boundaries are enforced (`no-restricted-imports`).
  - `npm test` runs across all workspaces: `apps/api` (Jest), `apps/worker` (Vitest), `packages/shared` (Vitest), `apps/web` (Jest).
  - Every export in `packages/shared` must be re-exported through `packages/shared/src/index.ts` and declare types cleanly for dependent workspaces.

### Git Intelligence & Recent Work Patterns

- `f7fc54d` (Story 0.5): Implemented deterministic ClockService, hard startup safety guards in both API and Worker, dev endpoints, and Vitest test suites.
- `c77dfe4` (Story 0.4): Implemented Master Geographic tables (`City`, `District`), composite keys, and raw migrations.
- `217ea21` (Story 0.3): Implemented same-origin API proxy and HTTP presentation boundary.
- Pattern established: Clean separation of concerns, comprehensive unit testing, zero warnings/errors in linting and build.

### Project Structure Notes

```
apps/worker/
├── package.json                   # Added pg-boss, dotenv
├── tsconfig.json
├── src/
│   ├── config.ts                  # Typed worker configuration
│   ├── startup-guard.ts           # Production safety guard (Story 0.5)
│   ├── clock.ts                   # workerClock provider (Story 0.5)
│   ├── scheduler.ts               # WorkerScheduler managing PgBoss singleton
│   ├── jobs/                      # 7 cataloged job handlers
│   │   ├── index.ts
│   │   ├── payment-deadline-expiry.job.ts
│   │   ├── offer-expiry-checker.job.ts
│   │   ├── demand-expiry-checker.job.ts
│   │   ├── fal-license-expiry.job.ts
│   │   ├── fal-expiry-warnings.job.ts
│   │   ├── owner-fee-reminders.job.ts
│   │   └── notification-retention.job.ts
│   ├── __tests__/
│   │   ├── startup-guard.spec.ts  # (Story 0.5)
│   │   ├── scheduler.spec.ts      # Tests for scheduler, schedules, singleton keys
│   │   └── jobs.spec.ts           # Tests for job handlers
│   └── main.ts                    # Bootstrap entry point

apps/api/
├── src/
│   └── app.module.ts              # Removed ScheduleModule.forRoot() (AR8, AD-7)

packages/shared/
├── src/
│   ├── constants/
│   │   ├── jobs.ts                # Canonical job names, definitions, crons
│   │   └── index.ts
│   ├── types/
│   │   ├── jobs.ts                # Job types, payloads, execution results
│   │   └── index.ts
│   └── index.ts
```

### References

- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-7 — Separate Worker Process (pg-boss Scheduler) & Idempotent Background Job Catalog]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AR8 — Dedicated Background Worker & pg-boss Scheduler]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/addendum.md#Section 3 — Background Job Catalog (pg-boss & Schedulers)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.6: Dedicated Background Worker & pg-boss Scheduler]
- [Source: _bmad-output/planning-artifacts/epics.md#NFR9 / NFR10]
- [Source: _bmad-output/implementation-artifacts/0-5-deterministic-clockservice-hard-startup-guard.md]

## Dev Agent Record

### Agent Model Used

Gemini 3.8 Flash (High)

### Debug Log References

- Verified all 7 canonical jobs defined with exact crons and singleton keys per AD-7 and AR8.
- Resolved TypeScript `Record<JobName, ...>` indexing by declaring job constants `as const` in `packages/shared/src/constants/jobs.ts`.
- Verified clean removal of `ScheduleModule.forRoot()` from `apps/api/src/app.module.ts` and confirmed zero active `@Cron` / `@Interval` decorators.
- Verified `apps/worker` lifecycle handling with `WorkerScheduler` wrapping `pg-boss` v10, supporting singleton crons and graceful shutdown timeouts (`boss.stop({ graceful: true, timeout: 10000 })`).
- Verified all 182 unit and integration tests across 21 test suites in `apps/api`, `apps/worker`, `apps/web`, and `packages/shared` pass with 100% success rate.
- Verified monorepo `npm run lint` and `npm run build` pass with zero warnings or errors.

### Completion Notes List

- Implemented canonical background job constants, configurations, and definitions in `packages/shared/src/constants/jobs.ts` and `packages/shared/src/types/jobs.ts`.
- Verified and enforced removal of `@nestjs/schedule` cron schedulers from `apps/api/src/app.module.ts`, preventing duplicate cron triggers across horizontally scaled API replicas (AD-7, AR8).
- Installed `pg-boss` (^10.4.2) and `dotenv` (^16.4.5) in `apps/worker`.
- Implemented `apps/worker/src/config.ts` providing typed worker configuration with production safety checks.
- Implemented `WorkerScheduler` in `apps/worker/src/scheduler.ts` encapsulating `PgBoss` singleton scheduling, error listeners, queue work registration, and graceful shutdown.
- Created reusable `createJobHandler` wrapper and implemented all 7 domain background jobs in `apps/worker/src/jobs/` with idempotent evaluation against `workerClock.now()`, structured telemetry logging, and dead-letter error handling.
- Implemented comprehensive automated test suites covering contracts, scheduler lifecycle, job handlers, and API scheduler removal.

### File List

- `packages/shared/src/constants/jobs.ts` (new)
- `packages/shared/src/types/jobs.ts` (new)
- `packages/shared/src/constants/__tests__/jobs.spec.ts` (new)
- `packages/shared/src/constants/index.ts` (modified)
- `packages/shared/src/types/index.ts` (modified)
- `apps/api/src/app.module.ts` (modified)
- `apps/api/src/__tests__/scheduler-removal.spec.ts` (new)
- `apps/worker/package.json` (modified)
- `apps/worker/src/config.ts` (new)
- `apps/worker/src/scheduler.ts` (new)
- `apps/worker/src/main.ts` (modified)
- `apps/worker/src/jobs/job-wrapper.ts` (new)
- `apps/worker/src/jobs/payment-deadline-expiry.job.ts` (new)
- `apps/worker/src/jobs/offer-expiry-checker.job.ts` (new)
- `apps/worker/src/jobs/demand-expiry-checker.job.ts` (new)
- `apps/worker/src/jobs/fal-license-expiry.job.ts` (new)
- `apps/worker/src/jobs/fal-expiry-warnings.job.ts` (new)
- `apps/worker/src/jobs/owner-fee-reminders.job.ts` (new)
- `apps/worker/src/jobs/notification-retention.job.ts` (new)
- `apps/worker/src/jobs/index.ts` (new)
- `apps/worker/src/__tests__/config.spec.ts` (new)
- `apps/worker/src/__tests__/scheduler.spec.ts` (new)
- `apps/worker/src/__tests__/main.spec.ts` (new)
- `apps/worker/src/jobs/__tests__/jobs.spec.ts` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/0-6-dedicated-background-worker-pg-boss-scheduler.md` (modified)

### Change Log

- 2026-10-28: Implemented Story 0.6: Dedicated Background Worker & pg-boss Scheduler (ready-for-dev -> in-progress -> review).

