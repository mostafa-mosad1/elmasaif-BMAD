---
baseline_commit: c77dfe4b5c9519d9cdcce1a91b2003c658e9b23d
---

# Story 0.5: Deterministic ClockService & Hard Startup Guard

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a backend engineer,
I want all system time access abstracted behind an injectable `ClockService` with a hard production startup guard,
So that business deadlines, 48-hour payment countdowns, 12-hour grace periods, and time-dependent state machines can be deterministically simulated and tested across staging and automated test suites, without risking unauthorized clock manipulation or static development OTP leaks in production.

## Acceptance Criteria

1. **Deterministic Injectable `ClockService` (`apps/api` & `packages/shared`):**
   - **Given** any NestJS module or service in `apps/api`
   - **When** the service needs the current system time or evaluates temporal deadlines
   - **Then** it injects and calls `ClockService.now()` (or `ClockService.nowIso()`, `ClockService.nowTimestamp()`) instead of calling native `new Date()` or `Date.now()`
   - **And** `ClockService` provides the following deterministic simulation methods:
     - `now(): Date`: returns current effective time (`realSystemTime + virtualOffsetMs`)
     - `nowIso(): string`: returns ISO 8601 representation of current effective time
     - `nowTimestamp(): number`: returns Unix timestamp in milliseconds
     - `advanceBy(offsetMs: number): Date`: advances virtual clock forward by milliseconds (throws if `offsetMs < 0` or if `NODE_ENV === 'production'`)
     - `advanceHours(hours: number): Date`: advances virtual clock forward by specified hours
     - `advanceDays(days: number): Date`: advances virtual clock forward by specified days
     - `setTime(targetDate: Date | string): Date`: sets virtual clock to an explicit timestamp
     - `reset(): Date`: resets virtual offset back to 0 (real system time)
     - `isMocked(): boolean`: returns `true` if a virtual offset is active, otherwise `false`
     - `getOffsetMs(): number`: returns the current active offset in milliseconds
   - **And** `ClockService` is provided via a `@Global()` `ClockModule` in `apps/api`, making it immediately accessible across all feature modules (`GeoModule`, `HealthModule`, `StorageModule`, and future modules).

2. **Hard Production Startup Guard (`apps/api` & `apps/worker`):**
   - **Given** application bootstrap initialization in `apps/api` (`main.ts` / `StartupGuardService`) and `apps/worker` (`main.ts`)
   - **When** `NODE_ENV === 'production'`
   - **Then** the bootstrap lifecycle actively inspects active environment configurations:
     1. **Mock Clock Guard (NFR5, NFR14, AD-11):** If `ENABLE_MOCK_CLOCK === 'true'` or any non-zero clock offset configuration is detected, the application MUST immediately log a fatal error: `[FATAL STARTUP GUARD] Mock clock and time manipulation are strictly forbidden in production (NODE_ENV=production). Aborting startup.` and abort process execution via `process.exit(1)`.
     2. **Static Dev OTP Guard (NFR5, AD-5, R-05):** If `OTP_PROVIDER === 'static'` or `ENABLE_STATIC_OTP === 'true'` or static dev OTP provider (`123456`) is configured as active, the application MUST immediately log a fatal error: `[FATAL STARTUP GUARD] Static OTP provider ('123456') is strictly forbidden in production (NODE_ENV=production). Aborting startup.` and abort process execution via `process.exit(1)`.
     3. **Production Secret Check:** Asserts that sensitive production credentials (e.g. `JWT_SECRET`, `SESSION_SECRET`) are not set to default development placeholders (`'dev-secret'`, `'change-me'`).
   - **And** when `NODE_ENV !== 'production'`, the startup guard logs an informative warning: `[StartupGuard] Running in development/testing mode (NODE_ENV=${NODE_ENV}). Virtual time shifting and dev OTP testing are permitted.` and allows normal execution.

3. **Development Clock API Endpoints (`apps/api` - `/api/v1/dev/clock`):**
   - **Given** `apps/api` running in a non-production environment (`NODE_ENV !== 'production'`)
   - **When** `GET /api/v1/dev/clock` is called
   - **Then** returns HTTP 200 with JSON payload:
     ```json
     {
       "now": "2026-10-28T14:50:00.000Z",
       "realSystemTime": "2026-10-28T14:50:00.000Z",
       "isMocked": false,
       "offsetMs": 0
     }
     ```
   - **When** `POST /api/v1/dev/clock/advance` is called with valid payload `{ hours?: number, minutes?: number, seconds?: number, ms?: number }`
   - **Then** advances the virtual clock forward accordingly and returns updated clock status
   - **When** `POST /api/v1/dev/clock/set` is called with valid ISO 8601 payload `{ isoDate: "2026-10-30T10:00:00.000Z" }`
   - **Then** pins virtual time to the exact date and returns updated clock status
   - **When** `POST /api/v1/dev/clock/reset` is called
   - **Then** clears virtual offset, restores real system clock, and returns updated clock status
   - **And** if `NODE_ENV === 'production'`, any request to `/api/v1/dev/clock/*` is strictly rejected with HTTP 403 Forbidden:
     ```json
     {
       "code": "CLOCK_MOCK_DISALLOWED_IN_PRODUCTION",
       "message": "Time manipulation endpoints are strictly forbidden in production",
       "requestId": "..."
     }
     ```

4. **Dedicated Worker Service Alignment (`apps/worker`):**
   - **Given** the standalone background worker in `apps/worker/src/main.ts`
   - **When** the worker process bootstraps
   - **Then** it executes the hard production startup guard assertions prior to registering signal handlers and starting recurring job loops
   - **And** the worker heartbeat logger and temporal sweeps utilize `ClockService.now()` (or shared deterministic clock) instead of raw `new Date()`.

5. **Shared Clock Schemas, Types & Error Codes (`packages/shared`):**
   - **Given** `packages/shared`
   - **When** imported by client, API, or worker packages
   - **Then** exposes Zod validation schemas:
     - `advanceClockSchema`: validates `{ hours: z.number().nonnegative().optional(), minutes: z.number().nonnegative().optional(), seconds: z.number().nonnegative().optional(), ms: z.number().nonnegative().optional() }` (ensuring at least one positive increment is provided)
     - `setClockSchema`: validates `{ isoDate: z.string().datetime({ message: 'Must be a valid ISO 8601 date string' }) }`
     - `clockStatusSchema`: validates clock status response
   - **And** exposes TypeScript types: `IClockService`, `ClockStatus`, `AdvanceClockDto`, `SetClockDto`
   - **And** exposes constants/error codes:
     - `CLOCK_MOCK_DISALLOWED_IN_PRODUCTION = 'CLOCK_MOCK_DISALLOWED_IN_PRODUCTION'`
     - `STATIC_OTP_DISALLOWED_IN_PRODUCTION = 'STATIC_OTP_DISALLOWED_IN_PRODUCTION'`.

6. **Automated Unit & Integration Verification:**
   - **Given** test suites in `apps/api`, `apps/worker`, and `packages/shared`
   - **When** `npm test` is executed across all monorepo workspaces
   - **Then** 100% of tests pass:
     - `ClockService` unit tests verifying real-time default, `advanceBy`, `advanceHours`, `advanceDays`, `setTime`, `reset`, negative value rejections, and production safety throws.
     - `StartupGuardService` unit tests verifying fatal `process.exit(1)` triggers on `NODE_ENV=production` with static OTP or mock clock, and normal pass-through in non-production.
     - `ClockDevController` unit tests verifying HTTP GET/POST endpoints, Zod schema validation, and 403 Forbidden protection when `NODE_ENV=production`.
     - `apps/worker` tests verifying startup guard invocation and deterministic clock integration.
     - `packages/shared` tests verifying `clock.schema.ts` validation rules.
     - `npm run lint` and `npm run build` pass without errors across all monorepo workspaces.

## Tasks / Subtasks

- [x] Task 1: Define Shared Clock Schemas, Types & Error Codes in `packages/shared` (AC: 5)
  - [x] 1.1 Create `packages/shared/src/schemas/clock.schema.ts`:
    - `advanceClockSchema`: validates `{ hours, minutes, seconds, ms }` where at least one numeric property is provided and all are `>= 0`.
    - `setClockSchema`: validates `{ isoDate: z.string().datetime({ message: 'Must be a valid ISO 8601 date string' }) }`.
    - `clockStatusSchema`: validates `{ now: z.string(), realSystemTime: z.string(), isMocked: z.boolean(), offsetMs: z.number() }`.
  - [x] 1.2 Create `packages/shared/src/types/clock.ts`:
    - Define interface `IClockService` with methods `now()`, `nowIso()`, `nowTimestamp()`, `advanceBy()`, `advanceHours()`, `advanceDays()`, `setTime()`, `reset()`, `isMocked()`, `getOffsetMs()`.
    - Define types `ClockStatus`, `AdvanceClockDto`, `SetClockDto`.
  - [x] 1.3 Update `packages/shared/src/constants/index.ts`:
    - Add error codes `CLOCK_MOCK_DISALLOWED_IN_PRODUCTION = 'CLOCK_MOCK_DISALLOWED_IN_PRODUCTION'`.
    - Add error codes `STATIC_OTP_DISALLOWED_IN_PRODUCTION = 'STATIC_OTP_DISALLOWED_IN_PRODUCTION'`.
  - [x] 1.4 Re-export schemas, types, and constants from `packages/shared/src/index.ts`.
  - [x] 1.5 Create unit tests `packages/shared/src/schemas/__tests__/clock.spec.ts` verifying Zod validation.
  - [x] 1.6 Build `packages/shared` (`npm run build:shared`) and verify TypeScript declarations emit cleanly.

- [x] Task 2: Implement Injectable `ClockService` & `ClockModule` in `apps/api` (AC: 1)
  - [x] 2.1 Create `apps/api/src/common/clock/clock.service.ts`:
    - Implement `ClockService implements IClockService, OnModuleInit`.
    - Inject `ConfigService` to inspect `NODE_ENV`.
    - Maintain private `virtualOffsetMs: number = 0`.
    - Implement `now(): Date`: returns `new Date(Date.now() + this.virtualOffsetMs)`.
    - Implement `nowIso(): string`: returns `this.now().toISOString()`.
    - Implement `nowTimestamp(): number`: returns `this.now().getTime()`.
    - Implement `advanceBy(offsetMs: number): Date`: throws if negative or if `NODE_ENV === 'production'`; adds to `this.virtualOffsetMs`.
    - Implement `advanceHours(hours: number): Date`: converts to ms and calls `advanceBy`.
    - Implement `advanceDays(days: number): Date`: converts to ms and calls `advanceBy`.
    - Implement `setTime(targetDate: Date | string): Date`: throws if invalid or in production; calculates delta against `Date.now()` and sets `virtualOffsetMs`.
    - Implement `reset(): Date`: resets `virtualOffsetMs = 0`.
    - Implement `isMocked(): boolean`: returns `this.virtualOffsetMs !== 0`.
    - Implement `getOffsetMs(): number`: returns `this.virtualOffsetMs`.
    - Implement `getStatus(): ClockStatus`: returns current status object.
  - [x] 2.2 Create `apps/api/src/common/clock/clock.module.ts`:
    - Mark as `@Global()`.
    - Provide and export `ClockService`.
  - [x] 2.3 Register `ClockModule` in `apps/api/src/app.module.ts`.

- [x] Task 3: Implement Hard Production Startup Guard in `apps/api` (AC: 2)
  - [x] 3.1 Create `apps/api/src/common/guards/startup-guard.service.ts`:
    - Implement `StartupGuardService implements OnApplicationBootstrap`.
    - Inject `ConfigService` and `ClockService`.
    - Implement `onApplicationBootstrap()` lifecycle hook.
    - Implement `assertProductionSafety()`:
      - Read `NODE_ENV` from config / `process.env`.
      - If `NODE_ENV === 'production'`:
        - Check if `ENABLE_MOCK_CLOCK === 'true'` or `clockService.isMocked()`. If true, log fatal error and call `process.exit(1)`.
        - Check if `OTP_PROVIDER === 'static'` or `ENABLE_STATIC_OTP === 'true'`. If true, log fatal error and call `process.exit(1)`.
        - Check if `JWT_SECRET === 'dev-secret'` or `SESSION_SECRET === 'dev-session-secret'`. If true, log fatal error and call `process.exit(1)`.
      - If `NODE_ENV !== 'production'`:
        - Log non-production development notice.
  - [x] 3.2 Provide `StartupGuardService` in `ClockModule` or `AppModule`.
  - [x] 3.3 Ensure startup guard runs cleanly during `apps/api` bootstrap in `main.ts`.

- [x] Task 4: Implement Development Clock Controller (`apps/api` - `/api/v1/dev/clock`) (AC: 3)
  - [x] 4.1 Create `apps/api/src/common/clock/clock-dev.controller.ts`:
    - Prefix: `dev/clock` (resolves under `/api/v1/dev/clock`).
    - Add Swagger annotations: `@ApiTags('Development (Non-Production)')`.
    - Guard every endpoint: if `process.env.NODE_ENV === 'production'`, throw `ForbiddenException` with code `CLOCK_MOCK_DISALLOWED_IN_PRODUCTION`.
    - Endpoint `GET /api/v1/dev/clock`: returns `clockService.getStatus()`.
    - Endpoint `POST /api/v1/dev/clock/advance`: validates body via `ZodValidationPipe(advanceClockSchema)` or DTO; advances clock and returns updated status.
    - Endpoint `POST /api/v1/dev/clock/set`: validates body via `ZodValidationPipe(setClockSchema)`; sets clock and returns updated status.
    - Endpoint `POST /api/v1/dev/clock/reset`: resets clock and returns updated status.
  - [x] 4.2 Register `ClockDevController` in `ClockModule`.

- [x] Task 5: Implement Startup Guard & Clock Alignment in `apps/worker` (AC: 2, AC: 4)
  - [x] 5.1 Create `apps/worker/src/startup-guard.ts`:
    - Export standalone function `assertWorkerProductionSafety()`.
    - If `process.env.NODE_ENV === 'production'`:
      - Assert mock clock and static dev OTP are not enabled.
      - If violated, log fatal error and invoke `process.exit(1)`.
  - [x] 5.2 Create `apps/worker/src/clock.ts` (or import from shared helper):
    - Export standalone `workerClock` instance providing `now(): Date` and `nowIso(): string`.
  - [x] 5.3 Update `apps/worker/src/main.ts`:
    - Call `assertWorkerProductionSafety()` before initiating worker bootstrap.
    - Replace `new Date().toISOString()` with `workerClock.nowIso()`.

- [x] Task 6: Testing, Linting & Verification (AC: 6)
  - [x] 6.1 Create unit tests `apps/api/src/common/clock/__tests__/clock.service.spec.ts`:
    - Test initial clock matches system time.
    - Test `advanceBy(ms)` correctly shifts `now()`.
    - Test `advanceHours(hours)` and `advanceDays(days)` correctly shift `now()`.
    - Test `advanceBy(-100)` throws `BadRequestException`.
    - Test `setTime(isoDate)` correctly shifts `now()`.
    - Test `setTime('invalid')` throws `BadRequestException`.
    - Test `reset()` restores real system time.
    - Test that when `NODE_ENV === 'production'`, calling `advanceBy` or `setTime` throws `ForbiddenException`.
  - [x] 6.2 Create unit tests `apps/api/src/common/guards/__tests__/startup-guard.service.spec.ts`:
    - Mock `process.exit` and `console.error`.
    - Test production + static OTP triggers `process.exit(1)`.
    - Test production + mock clock enabled triggers `process.exit(1)`.
    - Test production + dev secrets triggers `process.exit(1)`.
    - Test production with clean configuration succeeds without exiting.
    - Test non-production mode with mock clock and static OTP succeeds without exiting.
  - [x] 6.3 Create unit tests `apps/api/src/common/clock/__tests__/clock-dev.controller.spec.ts`:
    - Test controller delegates to `ClockService` for `GET /dev/clock`, `POST /advance`, `POST /set`, `POST /reset`.
    - Test controller throws 403 Forbidden when `NODE_ENV === 'production'`.
  - [x] 6.4 Create unit tests `apps/worker/src/__tests__/startup-guard.spec.ts`:
    - Test worker startup safety assertions in production vs development.
  - [x] 6.5 Run monorepo test suites: `npm test` (verify 100% pass across all workspaces).
  - [x] 6.6 Run monorepo lint: `npm run lint` across all workspaces.
  - [x] 6.7 Run monorepo build: `npm run build` across all workspaces.

## Dev Notes

### Architecture Patterns & Technical Guardrails

- **Deterministic Time Simulation (AD-11, NFR14, AR13):**
  - Direct calls to `new Date()` or `Date.now()` within domain services, timeout checks, and background workers are strictly prohibited.
  - All temporal calculations, payment deadlines (`ClockService.now() + 48 hours`), correction window extensions (`ClockService.now() + 12 hours`), and background sweeps must route through `ClockService.now()`.
  - Timestamp values must be passed directly into database queries and Prisma mutations rather than relying on database default clocks when simulating elapsed time.
  - In testing and staging environments, `ClockService` enables instantaneous time travel (e.g. `clockService.advanceHours(48)`), allowing end-to-end payment timeout cancellation and Fal expiry cron sweeps to be verified deterministically in milliseconds without waiting for real wall-clock time.

- **Hard Production Startup Guard (AD-5, AD-11, NFR5, R-05):**
  - **The Threat:** Accidental deployment of development shortcuts to production—specifically the static OTP provider (`123456`) or virtual clock simulation endpoints—would represent a catastrophic security bypass (account takeover of any Saudi mobile number) or temporal integrity failure (unauthorized deal cancellation/forcing).
  - **The Solution:** A non-bypassable bootstrap lifecycle hook (`OnApplicationBootstrap`) that evaluates `NODE_ENV === 'production'`. If any development shortcut is enabled, the process immediately logs a fatal diagnostic and aborts via `process.exit(1)`.
  - Because this runs during application bootstrap before HTTP listeners are bound, an insecure container will fail health checks and orchestrators (e.g. Kubernetes, Docker Swarm, AWS ECS) will immediately reject the deployment.

- **Standard Error Envelope Compliance (AD-8):**
  - When clock manipulation endpoints are invoked in production, the controller throws NestJS `ForbiddenException('Time manipulation endpoints are strictly forbidden in production')`.
  - The global `HttpExceptionFilter` catches this and returns:
    ```json
    {
      "code": "CLOCK_MOCK_DISALLOWED_IN_PRODUCTION",
      "message": "Time manipulation endpoints are strictly forbidden in production",
      "details": {},
      "requestId": "..."
    }
    ```

- **Global Module Architecture (`@Global()`):**
  - `ClockModule` is decorated with `@Global()`, exported in `AppModule`.
  - Feature modules across `apps/api` can inject `ClockService` in constructors without declaring `imports: [ClockModule]` in every individual module.

### Source Tree Components to Touch / Create

- **Create:**
  - `packages/shared/src/schemas/clock.schema.ts`
  - `packages/shared/src/types/clock.ts`
  - `packages/shared/src/schemas/__tests__/clock.spec.ts`
  - `apps/api/src/common/clock/clock.service.ts`
  - `apps/api/src/common/clock/clock.module.ts`
  - `apps/api/src/common/clock/clock-dev.controller.ts`
  - `apps/api/src/common/clock/__tests__/clock.service.spec.ts`
  - `apps/api/src/common/clock/__tests__/clock-dev.controller.spec.ts`
  - `apps/api/src/common/guards/startup-guard.service.ts`
  - `apps/api/src/common/guards/__tests__/startup-guard.service.spec.ts`
  - `apps/worker/src/startup-guard.ts`
  - `apps/worker/src/clock.ts`
  - `apps/worker/src/__tests__/startup-guard.spec.ts`

- **Modify / Verify:**
  - `packages/shared/src/constants/index.ts` (add `CLOCK_MOCK_DISALLOWED_IN_PRODUCTION`, `STATIC_OTP_DISALLOWED_IN_PRODUCTION`)
  - `packages/shared/src/schemas/index.ts` (re-export clock schemas)
  - `packages/shared/src/types/index.ts` (re-export clock types)
  - `packages/shared/src/index.ts` (re-export clock contracts)
  - `apps/api/src/app.module.ts` (import and register `ClockModule`)
  - `apps/worker/src/main.ts` (call `assertWorkerProductionSafety()`, utilize `workerClock`)

### Existing Code Analysis (UPDATE Targets)

1. **`apps/api/src/app.module.ts`:**
   - *Current state:* Imports `ConfigModule`, `ThrottlerModule`, `ScheduleModule`, `PrismaModule`, `HealthModule`, `StorageModule`, `GeoModule`, and applies `RequestIdMiddleware`.
   - *What this story changes:* Imports and registers `ClockModule` (which exports global `ClockService` and provides `StartupGuardService`).
   - *What must be preserved:* All existing module imports, throttler settings, and middleware configurations.

2. **`apps/worker/src/main.ts`:**
   - *Current state:* Bootstraps standalone background worker, registers SIGTERM/SIGINT handlers, and runs an unreferenced 60-second heartbeat logging `new Date().toISOString()`.
   - *What this story changes:* Executes `assertWorkerProductionSafety()` at the start of `bootstrap()`, logs current clock time using `workerClock.nowIso()`, and handles production startup errors cleanly.
   - *What must be preserved:* Graceful shutdown signal handling (`SIGTERM`, `SIGINT`), cleanup logic, and export structure.

3. **`packages/shared/src/constants/index.ts`:**
   - *Current state:* Defines platform commission, deadlines, file limits, and `STATIC_DEV_OTP = '123456'`.
   - *What this story changes:* Exports error codes `CLOCK_MOCK_DISALLOWED_IN_PRODUCTION` and `STATIC_OTP_DISALLOWED_IN_PRODUCTION`.
   - *What must be preserved:* All existing constants (`PLATFORM_COMMISSION_PERCENTAGE`, `DEAL_PAYMENT_DEADLINE_HOURS`, etc.).

4. **`packages/shared/src/schemas/index.ts` & `packages/shared/src/types/index.ts`:**
   - *Current state:* Exports geo, IBAN, mobile, national ID schemas and general types.
   - *What this story changes:* Re-exports `advanceClockSchema`, `setClockSchema`, `clockStatusSchema`, and `IClockService`, `ClockStatus`, `AdvanceClockDto`, `SetClockDto`.
   - *What must be preserved:* All existing exports.

### Testing Standards Summary

- **Test Frameworks:**
  - `apps/api`: Jest (`npm run test --workspace=apps/api`)
  - `apps/worker`: Jest or Vitest (`npm run test --workspace=apps/worker`)
  - `packages/shared`: Vitest (`npm run test --workspace=packages/shared`)
- **Required Test Scenarios:**
  1. `ClockService`:
     - Real-time identity: verifies `now()` is within 50ms of real system clock upon instantiation.
     - Advancement: advancing by 1 hour (3,600,000 ms) shifts `now()` forward by 1 hour.
     - Fractional & multi-unit advancement: `advanceHours(1.5)` shifts clock forward by 90 minutes.
     - Days advancement: `advanceDays(2)` shifts clock forward by 48 hours (vital for deal 48h payment timeout tests).
     - Fixed pinning: `setTime(iso)` shifts `now()` to exact target timestamp.
     - Negative validation: passing negative numbers throws `BadRequestException`.
     - Reset: calling `reset()` clears offset and restores real-time clock.
     - Production protection: `NODE_ENV=production` blocks `advanceBy`, `setTime`, `reset` with `ForbiddenException`.
  2. `StartupGuardService`:
     - Production + `ENABLE_MOCK_CLOCK=true` -> calls `process.exit(1)`.
     - Production + `OTP_PROVIDER=static` -> calls `process.exit(1)`.
     - Production + `JWT_SECRET='dev-secret'` -> calls `process.exit(1)`.
     - Production + valid secure config -> completes bootstrap cleanly.
     - Development + `ENABLE_MOCK_CLOCK=true` + `OTP_PROVIDER=static` -> logs dev notice, does NOT call `process.exit(1)`.
  3. `ClockDevController`:
     - `GET /api/v1/dev/clock` -> returns HTTP 200 with `now`, `isMocked`, `offsetMs`.
     - `POST /api/v1/dev/clock/advance` -> advances clock and returns updated payload.
     - `POST /api/v1/dev/clock/set` -> sets virtual date and returns updated payload.
     - `POST /api/v1/dev/clock/reset` -> clears offset.
     - Production invocation -> returns HTTP 403 Forbidden with standard error envelope.

### Project Structure Notes

- Alignment with unified monorepo structure:
  - Injectable clock service and dev controller placed under `apps/api/src/common/clock/`.
  - Startup safety guard placed under `apps/api/src/common/guards/`.
  - Worker startup safety checks in `apps/worker/src/startup-guard.ts`.
  - Shared schemas and DTOs in `packages/shared/src/schemas/clock.schema.ts` and `packages/shared/src/types/clock.ts`.

### References

- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-11 — Deterministic Time Simulation (Injectable ClockService)]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-5 — Dual-Realm Authentication, Hard Production OTP Guard & Account Lifecycle]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.5: Deterministic ClockService & Hard Startup Guard]
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#NFR5 / NFR14 / AR13 / R-05]
- [Source: _bmad-output/implementation-artifacts/0-4-master-geographic-tables-initial-prisma-schema.md]

## Dev Agent Record

### Agent Model Used

Gemini 3.8 Flash (High)

### Debug Log References

- Verified all test runners across monorepo (`npm test`): 142 tests passing across `@elmasaif/api`, `@elmasaif/shared`, `@elmasaif/worker`, `@elmasaif/web`.
- Verified TypeScript declarations emit and full production builds (`npm run build`): shared (tsc), api (nest build), web (next build), worker (tsc).
- Verified ESLint rules and no-restricted-imports boundaries (`npm run lint`): 0 warnings, 0 errors.

### Completion Notes List

- Task 1: Defined shared Zod validation schemas (`advanceClockSchema`, `setClockSchema`, `clockStatusSchema`), TypeScript types (`IClockService`, `ClockStatus`, `AdvanceClockDto`, `SetClockDto`), and error constants (`CLOCK_MOCK_DISALLOWED_IN_PRODUCTION`, `STATIC_OTP_DISALLOWED_IN_PRODUCTION`) in `packages/shared`. Added Vitest unit test suite with 9 passing assertions.
- Task 2: Implemented injectable, global `ClockService` and `@Global()` `ClockModule` in `apps/api/src/common/clock/`. Implemented deterministic offset management (`advanceBy`, `advanceHours`, `advanceDays`, `setTime`, `reset`, `getStatus`) and production safety locks. Registered in `AppModule`. Added Jest test suite with 15 passing assertions.
- Task 3: Implemented `StartupGuardService` with `OnApplicationBootstrap` in `apps/api/src/common/guards/startup-guard.service.ts` enforcing hard startup aborts (`process.exit(1)`) in production if `ENABLE_MOCK_CLOCK === 'true'`, virtual clock is active, `OTP_PROVIDER === 'static'`, `ENABLE_STATIC_OTP === 'true'`, or dev secrets are detected. Added Jest test suite with 8 passing assertions.
- Task 4: Created `ClockDevController` under `/api/v1/dev/clock` exposing `GET /dev/clock`, `POST /dev/clock/advance`, `POST /dev/clock/set`, `POST /dev/clock/reset` with Swagger annotations, `ZodValidationPipe` body validation, and 403 Forbidden enforcement in production returning the standard error envelope. Added Jest test suite with 8 passing assertions.
- Task 5: Implemented `assertWorkerProductionSafety()` and `workerClock` in `apps/worker` for background jobs and heartbeat tracking. Integrated assertions into `bootstrap()`. Added Vitest test suite with 7 passing assertions.
- Task 6: Completed full verification: `npm test` (142/142 tests passing), `npm run lint` (clean across all workspaces), `npm run build` (clean across all workspaces).

### File List

- `packages/shared/src/schemas/clock.schema.ts` (created)
- `packages/shared/src/types/clock.ts` (created)
- `packages/shared/src/schemas/__tests__/clock.spec.ts` (created)
- `packages/shared/src/constants/index.ts` (modified)
- `packages/shared/src/schemas/index.ts` (modified)
- `packages/shared/src/types/index.ts` (modified)
- `apps/api/src/common/clock/clock.service.ts` (created)
- `apps/api/src/common/clock/clock.module.ts` (created)
- `apps/api/src/common/clock/clock-dev.controller.ts` (created)
- `apps/api/src/common/guards/startup-guard.service.ts` (created)
- `apps/api/src/common/pipes/zod-validation.pipe.ts` (created)
- `apps/api/src/common/clock/__tests__/clock.service.spec.ts` (created)
- `apps/api/src/common/clock/__tests__/clock-dev.controller.spec.ts` (created)
- `apps/api/src/common/guards/__tests__/startup-guard.service.spec.ts` (created)
- `apps/api/src/app.module.ts` (modified)
- `apps/worker/src/startup-guard.ts` (created)
- `apps/worker/src/clock.ts` (created)
- `apps/worker/src/main.ts` (modified)
- `apps/worker/src/__tests__/startup-guard.spec.ts` (created)
- `apps/worker/package.json` (modified)
- `apps/worker/tsconfig.json` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/0-5-deterministic-clockservice-hard-startup-guard.md` (modified)

### Change Log

- 10-28-2026: Implemented Story 0.5 Deterministic ClockService & Hard Startup Guard across packages/shared, apps/api, and apps/worker with 100% test coverage and full verification.
