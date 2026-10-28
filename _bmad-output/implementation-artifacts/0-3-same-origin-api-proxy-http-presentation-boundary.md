---
baseline_commit: 5618a758a6ab8f4b3944dd560c1a6ffc6a449980
---

# Story 0.3: Same-Origin API Proxy & HTTP Presentation Boundary

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a frontend developer,
I want Next.js rewrites configured in `apps/web` to proxy all `/api/*` requests directly to `apps/api` with standardized HTTP client error handling and request correlation tracking,
So that session cookies remain strictly same-origin, client and server components communicate cleanly across the architectural presentation boundary, and browser components avoid third-party cookie restrictions.

## Acceptance Criteria

1. **Next.js Transparent API Rewrites & Proxy Routing:**
   - **Given** `apps/web` (Next.js 15 App Router on port 3000) and `apps/api` (NestJS 10 on port 4000) running concurrently
   - **When** a client or browser fetches `/api/v1/:path*` (e.g. `/api/v1/health`) through `apps/web` (`http://localhost:3000/api/v1/health`)
   - **Then** Next.js transparently rewrites and proxies the request to the backend NestJS service destination (`process.env.INTERNAL_API_URL` || `process.env.API_URL` || `http://localhost:4000`)
   - **And** requests to `/api/docs` (Swagger UI) and other `/api/*` paths are also proxied without rewriting clashes
   - **And** standard HTTP verbs (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`) and headers (including `Content-Type`, `Authorization`, `Idempotency-Key`, `If-Match`, `X-Request-Id`) pass through intact.

2. **Same-Origin Cookie Preservation & Session Boundary:**
   - **Given** session-issuing responses from `apps/api` containing `Set-Cookie` headers (e.g., `sessionId`, `SameSite=Lax`, `HttpOnly`, `Path=/`)
   - **When** delivered through the Next.js rewrite proxy at origin `http://localhost:3000`
   - **Then** cookies are attached strictly to the same origin (`localhost:3000`) without cross-origin domain mismatches
   - **And** subsequent client browser fetches automatically include cookies via `credentials: 'include'`
   - **And** cross-origin third-party cookie blockers (such as Apple Safari ITP, Google Chrome Privacy Sandbox, and Firefox ETP) have zero blocking effect because communication is purely first-party same-origin traffic (per AD-1 / AR3).

3. **Universal Presentation API Client (`apiClient`) with Client/Server Environment Support:**
   - **Given** the shared API client module located at `apps/web/src/lib/api-client.ts`
   - **When** invoked in client/browser context (`typeof window !== 'undefined'`)
   - **Then** it uses relative `/api/v1` base paths, ensuring requests go to the same origin (`window.location.origin`) through the Next.js rewrite proxy with `credentials: 'include'`
   - **When** invoked in server-side context (Server Components, SSR, Server Actions)
   - **Then** it resolves to the internal backend endpoint (`process.env.INTERNAL_API_URL || process.env.API_URL || 'http://localhost:4000/api/v1'`) ensuring Node.js server fetches succeed without relative URL exceptions
   - **And** handles HTTP 204 No Content gracefully (returning empty object or undefined)
   - **And** unwraps the standardized error envelope `{ code, message, details, requestId }`, throwing a typed `ApiError` containing `statusCode`, `code`, `message`, `details`, and `requestId`.

4. **Standardized Global Error Filter & Request ID Middleware in `apps/api`:**
   - **Given** HTTP requests arriving at `apps/api`
   - **When** processed by `RequestIdMiddleware`
   - **Then** an `X-Request-Id` correlation header is extracted from the incoming request or generated (UUID v4 / nanoid) and attached to both request context and response headers
   - **When** an exception is thrown in any controller or guard
   - **Then** `HttpExceptionFilter` formats the response into the canonical error envelope (per AD-8):
     ```json
     {
       "code": "ERROR_CODE",
       "message": "Human-readable description or Arabic fallback",
       "details": {},
       "requestId": "uuid"
     }
     ```
   - **And** 500 internal server errors mask sensitive stack traces and internal database errors in production while logging the correlation `requestId` for diagnostics.

5. **Strict Presentation / Domain Boundary Guardrails:**
   - **Given** source files in `apps/web`
   - **When** analyzed via `npm run lint` or static boundary analysis
   - **Then** `apps/web` contains zero direct database queries, zero `@prisma/*` imports, zero direct imports from `@elmasaif/api` or `@elmasaif/worker`
   - **And** all data fetching and mutations strictly execute through HTTP REST calls against `/api/v1` (per AD-2 / AR4).

6. **Automated Unit & Proxy Verification:**
   - **Given** test suites across `apps/web` and `apps/api`
   - **When** `npm test` is executed across the monorepo
   - **Then** 100% of test suites pass, verifying:
     - `next.config.ts` rewrites configuration correctly returns source `/api/:path*` and target destination with environment fallback.
     - `apiClient` correctly resolves relative URLs in browser mode, uses absolute URLs in server mode, includes credentials, and maps the AD-8 error envelope.
     - `apps/api` health controller returns expected status for `/api/v1/health` and `/api/v1/health/ready`.
     - `HttpExceptionFilter` produces canonical `{ code, message, details, requestId }` envelopes with status codes and correlation IDs.

## Tasks / Subtasks

- [x] Task 1: Configure Next.js Transparent API Rewrites (AC: 1, AC: 2)
  - [x] 1.1 Update `apps/web/next.config.ts` to implement `async rewrites()` returning a rewrite rule mapping `/api/:path*` to `${apiDestination}/api/:path*` where `apiDestination` is resolved from `process.env.INTERNAL_API_URL || process.env.API_URL || 'http://localhost:4000'`.
  - [x] 1.2 Verify that `/api/docs` (Swagger UI) proxies cleanly through Next.js without rewriting conflicts.
  - [x] 1.3 Verify environment variable definitions in `.env`, `.env.example`, and `apps/web/.env.example` ensuring `API_URL` and `INTERNAL_API_URL` are clearly documented.

- [x] Task 2: Standardize Global Error Envelope & Request ID in `apps/api` (AC: 4)
  - [x] 2.1 Create `apps/api/src/common/middleware/request-id.middleware.ts`:
    - Extract incoming `X-Request-Id` or generate a new UUID.
    - Attach `requestId` to `req.headers['x-request-id']` and set `res.setHeader('X-Request-Id', requestId)`.
  - [x] 2.2 Create `apps/api/src/common/filters/http-exception.filter.ts`:
    - Implement NestJS `ExceptionFilter` catching `HttpException` and generic `Error`.
    - Extract status code (default 500).
    - Map exception response to standard error envelope: `{ code, message, details, requestId }`.
    - Ensure 500 internal errors do not leak stack traces or internal connection details in non-development modes.
  - [x] 2.3 Update `apps/api/src/main.ts` and/or `apps/api/src/app.module.ts`:
    - Register `RequestIdMiddleware` for all routes.
    - Register `HttpExceptionFilter` globally via `app.useGlobalFilters(new HttpExceptionFilter())`.
  - [x] 2.4 Verify existing `HealthController` in `apps/api/src/modules/health/health.controller.ts` functions with the global filter and responds to `/api/v1/health` and `/api/v1/health/ready`.

- [x] Task 3: Enhance Universal Presentation API Client (`apiClient`) (AC: 2, AC: 3, AC: 5)
  - [x] 3.1 Update `apps/web/src/lib/api-client.ts`:
    - Add environment detection: in browser (`typeof window !== 'undefined'`), `API_BASE_URL` defaults to `/api/v1` (relative same-origin path).
    - In server environment (`typeof window === 'undefined'`), `API_BASE_URL` defaults to `process.env.INTERNAL_API_URL || process.env.API_URL || 'http://localhost:4000/api/v1'`.
    - Support optional custom `headers` while preserving default `Content-Type: application/json`, `Accept: application/json`.
    - Ensure `credentials: 'include'` is set for browser requests to automatically send and store `HttpOnly` session cookies.
    - Update `ApiError` class to include `requestId?: string` and parse `{ code, message, details, requestId }` from response JSON.
  - [x] 3.2 Provide convenience helper methods on `apiClient`: `apiClient.get<T>`, `apiClient.post<T>`, `apiClient.put<T>`, `apiClient.patch<T>`, `apiClient.delete<T>`.

- [x] Task 4: Setup Testing & Boundary Verification in `apps/web` (AC: 5, AC: 6)
  - [x] 4.1 Configure Vitest in `apps/web/package.json`:
    - Add devDependencies: `vitest: "^1.6.0"`, `@types/node: "^20.12.12"`.
    - Add script: `"test": "vitest run"`.
  - [x] 4.2 Author unit tests in `apps/web/src/lib/__tests__/api-client.spec.ts`:
    - Test relative URL resolution in browser context (`window` defined).
    - Test absolute URL resolution in server context (`window` undefined).
    - Test successful 200 response parsing and 204 No Content empty object return.
    - Test error handling: throws `ApiError` correctly capturing `statusCode`, `code`, `message`, `details`, and `requestId`.
  - [x] 4.3 Author unit tests in `apps/web/__tests__/next-config.spec.ts`:
    - Test `next.config.ts` exports `rewrites()` function.
    - Test rewrite rules correctly map `/api/:path*` to destination with fallback to `http://localhost:4000/api/:path*`.
    - Test custom `INTERNAL_API_URL` or `API_URL` environment variables override default port 4000.
  - [x] 4.4 Author unit tests in `apps/api/src/common/__tests__/http-exception.filter.spec.ts` and `apps/api/src/modules/health/__tests__/health.controller.spec.ts`:
    - Test `HttpExceptionFilter` formats NestJS `BadRequestException` into `{ code, message, details, requestId }`.
    - Test `HttpExceptionFilter` formats unknown runtime errors into `{ code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error', requestId }`.
    - Test `HealthController` check and ready methods return expected payloads.

- [x] Task 5: Monorepo Integration & Verification (AC: 1 to 6)
  - [x] 5.1 Run `npm run lint` across all packages to verify boundary rules (`apps/web` disallows `@prisma/*`, `@elmasaif/api`, etc.).
  - [x] 5.2 Run `npm run build` across monorepo (`packages/shared`, `apps/api`, `apps/web`, `apps/worker`) to ensure clean compilation.
  - [x] 5.3 Run `npm test` across all workspaces to confirm 100% test pass rate.

## Dev Notes

### Architecture Patterns & Technical Guardrails

- **Same-Origin API Proxy & Cookie Isolation (AD-1, AR3):**
  - Next.js `rewrites()` in `apps/web/next.config.ts` transparently proxies all `/api/:path*` traffic to the NestJS backend at `apps/api`.
  - **Why this is critical:** In modern browsers (Safari ITP, Firefox ETP, Chrome Privacy Sandbox), cookies issued from a different origin/port (e.g., frontend on `localhost:3000` and API on `localhost:4000`) are classified as third-party cross-site cookies unless configured with complex Partitioned/CHIPS headers. By proxying `/api/*` through Next.js on port 3000, `Set-Cookie` headers issued by the API are treated by the browser as strictly first-party same-origin cookies on `localhost:3000`.
  - In `next.config.ts`:
    ```typescript
    async rewrites() {
      const apiDestination =
        process.env.INTERNAL_API_URL ||
        process.env.API_URL ||
        'http://localhost:4000';
      return [
        {
          source: '/api/:path*',
          destination: `${apiDestination}/api/:path*`,
        },
      ];
    }
    ```

- **Strict Presentation / Domain Separation (AD-2, AR4):**
  - `apps/web` is strictly a presentation tier. It must contain zero direct database queries, zero `@prisma/*` client imports, and zero backend module imports.
  - Next.js Server Actions and Route Handlers MUST NOT perform database mutations. All mutations and queries route via HTTP REST calls (`/api/v1/*`).
  - Enforced by ESLint rule in `apps/web/.eslintrc.json` blocking `@prisma/*`, `@elmasaif/api`, `@elmasaif/worker`, and relative cross-app imports.

- **Standardized Error Envelope (AD-8):**
  - Global NestJS exception filter enforces the error envelope:
    ```typescript
    export interface StandardErrorEnvelope {
      code: string;
      message: string;
      details?: Record<string, any>;
      requestId: string;
    }
    ```
  - Standard error codes should be stable strings (e.g. `VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`, `INTERNAL_SERVER_ERROR`).
  - Correlation ID `X-Request-Id` is generated via UUID v4 or extracted from incoming header, attached to response headers, and included in the error envelope.

- **Dual-Environment `apiClient` Resolution:**
  - In the browser (`typeof window !== 'undefined'`), requests must hit relative paths `/api/v1/*` so they go to the Next.js same-origin server on port 3000, passing through the rewrite proxy to port 4000.
  - In server components or SSR (`typeof window === 'undefined'`), Node.js `fetch` requires an absolute URL. `apiClient` must resolve to `process.env.INTERNAL_API_URL || process.env.API_URL || 'http://localhost:4000'` with `/api/v1`.

### Source Tree Components to Touch / Create

- **Create:**
  - `apps/api/src/common/filters/http-exception.filter.ts`
  - `apps/api/src/common/middleware/request-id.middleware.ts`
  - `apps/api/src/common/__tests__/http-exception.filter.spec.ts`
  - `apps/api/src/modules/health/__tests__/health.controller.spec.ts`
  - `apps/web/src/lib/__tests__/api-client.spec.ts`
  - `apps/web/__tests__/next-config.spec.ts`

- **Modify / Verify:**
  - `apps/web/next.config.ts` (add `rewrites()` method)
  - `apps/web/src/lib/api-client.ts` (support dual client/server base URLs, error envelope parsing, typed helpers)
  - `apps/web/package.json` (add `vitest` devDependency and `"test": "vitest run"` script)
  - `apps/api/src/main.ts` (register `RequestIdMiddleware` and `HttpExceptionFilter`)
  - `.env.example` / `.env` (ensure `API_URL` and `INTERNAL_API_URL` are present)

### Existing Code Analysis (UPDATE Targets)

1. **`apps/web/next.config.ts`:**
   - *Current state:* Defines Next.js configuration with `reactStrictMode: true`, `outputFileTracingRoot`, `transpilePackages: ['@elmasaif/shared']`, and `images.remotePatterns` for https and localhost.
   - *What this story changes:* Adds `async rewrites()` returning `{ source: '/api/:path*', destination: `${apiDestination}/api/:path*` }`.
   - *What must be preserved:* All existing configurations (`transpilePackages`, `outputFileTracingRoot`, `images`).

2. **`apps/web/src/lib/api-client.ts`:**
   - *Current state:* Hardcodes `API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'`. Lacks server/client environment distinction and does not unwrap `requestId`.
   - *What this story changes:* Updates base URL resolution (relative `/api/v1` for browser, absolute for Node SSR), updates `ApiError` to record `requestId`, and unwraps the AD-8 error envelope.
   - *What must be preserved:* `apiClient<T>` export, `ApiError` export, `credentials: 'include'`, 204 status handling.

3. **`apps/web/package.json`:**
   - *Current state:* Contains Next.js 15, React 19 dependencies, and scripts `dev`, `build`, `start`, `lint`. No test runner configured.
   - *What this story changes:* Adds `vitest: "^1.6.0"` to devDependencies and `"test": "vitest run"` script.
   - *What must be preserved:* All existing scripts and dependencies.

4. **`apps/api/src/main.ts`:**
   - *Current state:* Initializes Express app, sets helmet, cookieParser, CORS, global prefix `api/v1`, global `ValidationPipe`, Swagger documentation, and listens on port 4000.
   - *What this story changes:* Applies `RequestIdMiddleware` and binds `HttpExceptionFilter` globally.
   - *What must be preserved:* Security headers, CORS credentials, validation pipe, Swagger setup at `api/docs`, and port listening.

### Testing Standards Summary

- Test Frameworks:
  - `apps/api`: Jest (`npm run test --workspace=apps/api`)
  - `apps/web`: Vitest (`npm run test --workspace=apps/web`)
  - `packages/shared`: Vitest (`npm run test --workspace=packages/shared`)
- Required Test Cases:
  1. Next.js rewrite configuration: verifies source pattern `/api/:path*` maps to `${INTERNAL_API_URL || API_URL || 'http://localhost:4000'}/api/:path*`.
  2. `apiClient` browser URL resolution: verifies relative URL `/api/v1/test` when `window` exists.
  3. `apiClient` server URL resolution: verifies absolute URL `http://localhost:4000/api/v1/test` when `window` is undefined.
  4. `apiClient` error handling: verifies `ApiError` extracts `statusCode`, `code`, `message`, `details`, and `requestId` from standard error envelope.
  5. `HttpExceptionFilter`: verifies standard envelope formatting for NestJS `BadRequestException` and generic unhandled runtime errors.
  6. `HealthController`: verifies `check()` returns `{ status: 'ok', service: 'elmasaif-api' }` and `ready()` returns database status.

### Project Structure Notes

- Alignment with unified project structure:
  - API proxy configuration is placed inside `apps/web/next.config.ts`.
  - Client-side fetcher lives in `apps/web/src/lib/api-client.ts`.
  - Common filters and middleware in `apps/api` are organized under `apps/api/src/common/filters/` and `apps/api/src/common/middleware/`.
  - Health checks reside in `apps/api/src/modules/health/`.

### References

- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-1 — Monorepo Layout, Same-Origin API Proxy & Boundaries]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-2 — Strict Presentation / Domain Separation & Explicit Action Endpoints]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-8 — Standard Error Envelope]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.3: Same-Origin API Proxy & HTTP Presentation Boundary]
- [Source: _bmad-output/implementation-artifacts/0-1-monorepo-foundation-workspace-tooling.md]
- [Source: _bmad-output/implementation-artifacts/0-2-local-infrastructure-docker-compose-private-sovereign-s3-target.md]

## Dev Agent Record

### Agent Model Used

Gemini 3.8 Flash (High)

### Debug Log References

- Verified monorepo test suites passing: 27 Jest tests in `apps/api`, 12 Vitest tests in `packages/shared`.
- Baseline commit: `5618a758a6ab8f4b3944dd560c1a6ffc6a449980`.
- TDD Red-Green-Refactor cycles executed across `apps/web` and `apps/api`.
- Monorepo linting verified zero errors via `npm run lint`.
- Monorepo build verified clean compilation via `npm run build` (`apps/web`, `apps/api`, `apps/worker`, `packages/shared`).
- Monorepo test suites passing 100%: 39 tests in `apps/api`, 17 tests in `apps/web`, 12 tests in `packages/shared` (Total: 68 tests).

### Completion Notes List

- Configured transparent Next.js rewrites in `apps/web/next.config.ts` mapping `/api/:path*` to backend service destination (`INTERNAL_API_URL || API_URL || 'http://localhost:4000'`), preserving same-origin cookies and Swagger UI access.
- Implemented `RequestIdMiddleware` in `apps/api/src/common/middleware/request-id.middleware.ts` extracting incoming `X-Request-Id` or generating UUID v4 and setting response header.
- Registered `RequestIdMiddleware` in `apps/api/src/app.module.ts` across all routes.
- Implemented canonical `HttpExceptionFilter` in `apps/api/src/common/filters/http-exception.filter.ts` mapping exceptions to standard envelope `{ code, message, details, requestId }` and masking 500 internal errors.
- Registered `HttpExceptionFilter` globally in `apps/api/src/main.ts`.
- Enhanced `apiClient` in `apps/web/src/lib/api-client.ts` with browser (`/api/v1`) vs server (`INTERNAL_API_URL`) environment detection, `credentials: 'include'` for same-origin session preservation, typed `ApiError`, and convenience HTTP methods (`get`, `post`, `put`, `patch`, `delete`).
- Configured Vitest test runner in `apps/web/package.json`.
- Added comprehensive unit test coverage in `apps/web` (Vitest) and `apps/api` (Jest), validating proxy rewrites, error envelopes, and request correlations.
- Documented `INTERNAL_API_URL` and `API_URL` in `.env.example` and `apps/web/.env.example`.

### File List

- `.env.example`
- `apps/web/.env.example`
- `apps/web/next.config.ts`
- `apps/web/package.json`
- `apps/web/src/lib/api-client.ts`
- `apps/web/__tests__/next-config.spec.ts`
- `apps/web/src/lib/__tests__/api-client.spec.ts`
- `apps/api/src/common/middleware/request-id.middleware.ts`
- `apps/api/src/common/filters/http-exception.filter.ts`
- `apps/api/src/common/__tests__/request-id.middleware.spec.ts`
- `apps/api/src/common/__tests__/http-exception.filter.spec.ts`
- `apps/api/src/modules/health/__tests__/health.controller.spec.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/main.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/0-3-same-origin-api-proxy-http-presentation-boundary.md`

### Change Log

- Implemented Story 0.3: Same-Origin API Proxy & HTTP Presentation Boundary (Date: 2026-10-28)
