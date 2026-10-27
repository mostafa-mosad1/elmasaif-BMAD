---
baseline_commit: 69d82ac29823790ae05aed9fccf4d361b8922b68
---

# Story 0.1: Monorepo Foundation & Workspace Tooling

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a software engineer,
I want a configured npm workspaces monorepo structure with `apps/web`, `apps/api`, `apps/worker`, and `packages/shared`,
So that development can proceed with shared TypeScript types, schemas, and consistent tooling across all tiers.

## Acceptance Criteria

1. **Workspace Package Recognition & Dependency Linking:**
   - **Given** an initialized repository root with `package.json` workspaces configured for `apps/*` and `packages/*`
   - **When** the workspace configuration is inspected (`npm query :scope` or `npm run --workspaces`)
   - **Then** `apps/web` (Next.js 15, React 19, TypeScript), `apps/api` (NestJS 10, TypeScript), `apps/worker` (standalone Node.js worker), and `packages/shared` are recognized as active npm workspace packages without resolution or symlink errors.

2. **Shared Package Compilation & Artifact Exports:**
   - **Given** `packages/shared` containing TypeScript sources under `src/` (`enums`, `constants`, `schemas`, `types`)
   - **When** `npm run build:shared` (or `npm run build --workspace=packages/shared`) is executed
   - **Then** TypeScript emits compiled JavaScript to `dist/index.js` and type declarations to `dist/index.d.ts` (with source maps and declaration maps)
   - **And** `package.json` in `packages/shared` correctly exposes `main: "./dist/index.js"` and `types: "./dist/index.d.ts"`
   - **And** consuming packages (`apps/web`, `apps/api`, `apps/worker`) can import symbols cleanly via `@elmasaif/shared` without runtime or build errors.

3. **Strict Architectural Import Boundaries & Monorepo Linting:**
   - **Given** source files across all applications (`apps/web`, `apps/api`, `apps/worker`, `packages/shared`)
   - **When** code imports and syntax are analyzed via `npm run lint` from the monorepo root
   - **Then** imports from `@elmasaif/shared` are permitted across all workspace packages
   - **And** direct app-to-app imports (e.g. `apps/web` importing from `apps/api` or `apps/worker`, or relative paths reaching across app boundaries) are strictly prohibited and trigger ESLint errors
   - **And** Next.js components in `apps/web` are strictly prohibited from importing `@prisma/client` or server database connection modules (per AD-1 / AD-2).

4. **Shared Contract Validation & Unit Testing:**
   - **Given** domain validation functions in `packages/shared/src/schemas`
   - **When** unit tests (`npm test --workspace=packages/shared` or root `npm test:shared`) are executed
   - **Then** 100% of test suites pass, verifying:
     - ISO 7064 Mod-97 Saudi IBAN validator (`validateSaudiIban`): valid Saudi IBANs pass; invalid checksums, wrong lengths, or non-Saudi prefixes fail.
     - Saudi mobile schema (`saudiMobileSchema`): validates `05XXXXXXXX`, `5XXXXXXXX`, and `+9665XXXXXXXX`.
     - Saudi National ID / Iqama schema (`saudiNationalIdSchema`): validates 10 digits starting with 1 or 2.

## Tasks / Subtasks

- [x] Task 1: Complete Monorepo Workspace Configuration & Scaffold `apps/worker` (AC: 1)
  - [x] 1.1 Verify root `package.json` workspace globbing (`"workspaces": ["apps/*", "packages/*"]`) and add workspace scripts (`dev:worker`, `build:worker`, `test:shared`).
  - [x] 1.2 Update root `build` script to guarantee dependency build order (`npm run build:shared && npm run --workspaces --if-present build`).
  - [x] 1.3 Scaffold `apps/worker` directory with:
    - `apps/worker/package.json` (`name: "@elmasaif/worker"`, `"dependencies": { "@elmasaif/shared": "*" }`, scripts: `build`, `dev`, `start`).
    - `apps/worker/tsconfig.json` extending root `tsconfig.base.json` with `"outDir": "./dist"`.
    - `apps/worker/src/main.ts` with standalone bootstrapping, logging, and graceful shutdown signal listeners (`SIGTERM`, `SIGINT`).
  - [x] 1.4 Run `npm install` from root to link workspace symlinks and confirm all 4 packages (`@elmasaif/web`, `@elmasaif/api`, `@elmasaif/worker`, `@elmasaif/shared`) resolve cleanly.

- [x] Task 2: Build, Export, and Verify Shared Contracts (`packages/shared`) (AC: 2, AC: 4)
  - [x] 2.1 Verify `packages/shared/tsconfig.json` contains `"outDir": "./dist"`, `"declaration": true`, `"declarationMap": true`, and `"rootDir": "./src"`.
  - [x] 2.2 Configure test runner (Vitest) in `packages/shared/package.json` with devDependencies (`vitest`, `@types/node`) and `"test": "vitest run"`.
  - [x] 2.3 Author unit tests in `packages/shared/src/schemas/__tests__/schemas.spec.ts`:
    - `validateSaudiIban` (valid SA IBANs, invalid checksum digits, invalid lengths, foreign IBANs).
    - `saudiMobileSchema` (standard Saudi numbers, edge cases).
    - `saudiNationalIdSchema` (citizen 1XXXXXXXXX, resident 2XXXXXXXXX, invalid formats).
  - [x] 2.4 Run `npm run build:shared` and confirm `dist/index.js` and `dist/index.d.ts` are generated with full barrel exports.
  - [x] 2.5 Run `npm test --workspace=packages/shared` and verify all tests pass.

- [x] Task 3: Establish ESLint Architectural Import Boundaries & Monorepo Tooling (AC: 3)
  - [x] 3.1 Configure ESLint across the monorepo root to enforce architectural boundary rules:
    - Forbid app-to-app imports (e.g. `apps/web` cannot import from `apps/api` or `apps/worker`).
    - Forbid `apps/web` from importing `@prisma/client` or relative paths outside its own directory.
    - Permit importing from `@elmasaif/shared`.
  - [x] 3.2 Add boundary lint check in `apps/web` using `no-restricted-imports` in ESLint configuration:
    ```json
    {
      "rules": {
        "no-restricted-imports": ["error", {
          "patterns": [
            { "group": ["@elmasaif/api", "@elmasaif/worker", "@prisma/*", "**/apps/api/**", "**/apps/worker/**"], "message": "Violates AD-1 / AD-2: Direct app-to-app imports and Prisma in web are prohibited." }
          ]
        }]
      }
    }
    ```
  - [x] 3.3 Ensure root `npm run lint` executes across all workspace packages and passes cleanly.
  - [x] 3.4 Verify full monorepo build with `npm run build` from root succeeds with zero errors.

## Dev Notes

### Architecture Patterns & Technical Guardrails

- **Modular Monorepo Layout (AD-1, AR1):**
  - **Workspaces:**
    - `apps/web`: Next.js 15 (App Router, React 19, TypeScript), port 3000.
    - `apps/api`: NestJS 10 (TypeScript REST backend), port 3001.
    - `apps/worker`: Standalone Node.js process dedicated to background jobs (`pg-boss` in Story 0.6).
    - `packages/shared`: Shared contracts (`@elmasaif/shared`), Zod schemas, constants, enums, types.
  - **Strict Architectural Invariants (AD-1, AD-2):**
    - Code imports flow strictly into `packages/shared`.
    - Cross-app imports (`apps/web` <-> `apps/api` <-> `apps/worker`) are strictly forbidden.
    - Next.js in `apps/web` is strictly forbidden from importing `@prisma/client`, executing raw SQL, or initiating database connections. All state changes and data reads flow through `/api/v1` REST endpoints.
  - **Build Ordering:**
    - `packages/shared` must be compiled first (`build:shared`) before `apps/api`, `apps/web`, or `apps/worker` build, as the consuming packages depend on `packages/shared/dist`.

- **TypeScript Standards:**
  - TypeScript `>= 5.4.5`. Strict mode enabled (`"strict": true`) across all packages.
  - Sub-package `tsconfig.json` files extend `tsconfig.base.json` from the monorepo root.

- **Workspace Dependencies:**
  - All apps declare dependency on shared package via `"@elmasaif/shared": "*"` in their respective `package.json`.

### Source Tree Components to Touch / Create

- **Create:**
  - `apps/worker/package.json`
  - `apps/worker/tsconfig.json`
  - `apps/worker/src/main.ts`
  - `packages/shared/src/schemas/__tests__/schemas.spec.ts`
  - `.eslintrc.js` (or `.eslintrc.json` at root / app level enforcing boundary restrictions)

- **Modify / Verify:**
  - `package.json` (root): Add worker scripts (`dev:worker`, `build:worker`), test script (`test:shared`), and update `build` command for sequential execution.
  - `packages/shared/package.json`: Add `vitest` devDependency and `"test": "vitest run"` script.
  - `apps/api/package.json`: Ensure workspace link and scripts resolve cleanly.
  - `apps/web/package.json`: Ensure workspace link and scripts resolve cleanly.

### Testing Standards Summary

- Framework: `vitest` in `packages/shared`.
- Required Test Cases for ISO 7064 Mod-97 Saudi IBAN:
  - Valid standard Saudi IBAN (e.g. `SA0380000000608010167519`, `SA7520000001080010065432`) -> `true`.
  - Invalid checksum (e.g. `SA0080000000608010167519`) -> `false`.
  - Invalid length (< 24 or > 24 characters) -> `false`.
  - Foreign IBAN (e.g. `GB82WEST12345698765432`) -> `false`.
  - Non-numeric account portion -> `false`.
- Required Test Cases for Saudi Mobile Schema:
  - `0501234567` -> valid.
  - `501234567` -> valid.
  - `+966501234567` -> valid.
  - `0601234567` -> invalid.
- Required Test Cases for Saudi National ID Schema:
  - `1000000001` (Citizen) -> valid.
  - `2000000001` (Resident / Iqama) -> valid.
  - `3000000001` -> invalid.

### Project Structure Notes

- Alignment with unified project structure:
  - Root: `package.json`, `tsconfig.base.json`, `docker-compose.yml`, `.gitignore`.
  - `apps/web`: Next.js 15 client.
  - `apps/api`: NestJS 10 REST server.
  - `apps/worker`: Node.js background worker process.
  - `packages/shared`: Shared TypeScript types, schemas, enums, constants.
- No structural divergence from Architecture Spine.

### References

- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-1] (Monorepo Layout & Boundaries)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-2] (Strict Presentation / Domain Separation)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#Design Paradigm] (Decoupled Modular Monorepo Architecture)
- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.1] (Story 0.1: Monorepo Foundation & Workspace Tooling)
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#AR1] (Monorepo Foundation & Workspace Scaffolding)

## Dev Agent Record

### Agent Model Used

Gemini 3.8 Flash (High)

### Debug Log References

- Verified existing workspace configuration in root `package.json`.
- Identified missing workspace package `apps/worker` to be scaffolded in Task 1.
- Validated shared contracts implementation in `packages/shared/src/schemas/index.ts`.
- Outlined explicit ESLint import restriction rules preventing cross-app and direct database imports in `apps/web`.

### Completion Notes List

- Story 0.1 implementation and testing successfully completed.
- Monorepo workspace recognized with `apps/web`, `apps/api`, `apps/worker`, and `packages/shared`.
- `apps/worker` scaffolded with standalone bootstrapping and graceful shutdown handlers.
- `packages/shared` compiles cleanly (`dist/index.js`, `dist/index.d.ts`).
- Vitest suite passing 100% (12 tests) for ISO 7064 Mod-97 Saudi IBAN validator, Saudi mobile schema, and Saudi National ID/Iqama schema.
- Architectural boundary lint rules enforced forbidding direct app-to-app imports and database client imports in `apps/web`.

### File List

- `package.json`
- `apps/worker/package.json`
- `apps/worker/tsconfig.json`
- `apps/worker/src/main.ts`
- `packages/shared/package.json`
- `packages/shared/tsconfig.json`
- `packages/shared/src/schemas/index.ts`
- `packages/shared/src/schemas/__tests__/schemas.spec.ts`
- `_bmad-output/implementation-artifacts/0-1-monorepo-foundation-workspace-tooling.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
