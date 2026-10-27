---
baseline_commit: b82bf73b1735cc53c26e7353a56955c56c198c8e
---

# Story 0.2: Local Infrastructure, Docker Compose & Private Sovereign S3 Target

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a local Docker Compose setup orchestrating PostgreSQL 16, MinIO private S3 storage, and Mailpit SMTP, alongside a dedicated `StorageService` in `apps/api`,
So that local development and testing mirror production sovereign storage and database constraints without external cloud dependencies.

## Acceptance Criteria

1. **Docker Compose Infrastructure & Service Health Checks:**
   - **Given** Docker daemon is running on the developer workstation
   - **When** `docker compose up -d` (or `npm run docker:up`) is executed from the repository root
   - **Then** PostgreSQL 16 is accessible on port `5432` with automated health check (`pg_isready`) and volume persistence (`postgres_data`)
   - **And** MinIO S3-compatible object storage is accessible on API port `9000` with web console on port `9001` and volume persistence (`minio_data`)
   - **And** Mailpit SMTP server is accessible on port `1025` (SMTP) and web inspection UI on port `8025` (HTTP)
   - **And** a containerized bucket initialization service (`minio-init` via `minio/mc`) in `docker-compose.yml` automatically creates the default private bucket `elmasaif-private-documents` if it does not already exist.

2. **In-Kingdom Sovereign Storage Configuration & Fallback Guardrails:**
   - **Given** environment configurations in `apps/api/.env`, `.env`, and `.env.example`
   - **When** the environment variables are parsed by NestJS `ConfigModule`
   - **Then** the application accepts both standard sovereign keys and legacy/S3 fallbacks:
     - `STORAGE_ENDPOINT` (fallback to `S3_ENDPOINT`, default `http://localhost:9000` for MinIO)
     - `STORAGE_REGION` (fallback to `S3_REGION`, default `us-east-1` for local MinIO; designated AWS Saudi region or interim `me-south-1` with PDPL compliance)
     - `STORAGE_ACCESS_KEY` (fallback to `S3_ACCESS_KEY`, default `minioadmin`)
     - `STORAGE_SECRET_KEY` (fallback to `S3_SECRET_KEY`, default `miniopassword`)
     - `STORAGE_BUCKET_PRIVATE` (fallback to `S3_BUCKET_PRIVATE`, default `elmasaif-private-documents`)
     - `STORAGE_FORCE_PATH_STYLE` (boolean flag, default `true` for MinIO path-style routing `http://endpoint/bucket/key`)
   - **And** region and endpoint definitions remain strictly external configuration, never hardcoded in source code (per NFR2).

3. **Dedicated StorageModule & StorageService Implementation (AWS SDK v3):**
   - **Given** a modular NestJS service located in `apps/api/src/modules/storage/storage.service.ts`
   - **When** the service is instantiated
   - **Then** it initializes an `S3Client` from `@aws-sdk/client-s3` with credentials and configuration injected from `ConfigService`
   - **And** direct public URLs are strictly prohibited (all objects remain private in private sovereign buckets)
   - **And** generating a download URL via `getPresignedDownloadUrl(key, expiresInSeconds?)` enforces:
     - Hard expiration ceiling: maximum allowed expiration is $\le 300$ seconds (5 minutes); any requested expiry $> 300$ seconds is clamped to 300 seconds (per NFR2, AR7).
     - Returns a signed HTTP GET URL generated via `@aws-sdk/s3-request-presigner`.
   - **And** generating an upload URL via `getPresignedUploadUrl(key, contentType, expiresInSeconds?)` enforces:
     - Hard expiration ceiling: $\le 300$ seconds (clamped).
     - Content-Type restriction to validated document/image MIME types (`application/pdf`, `image/jpeg`, `image/png`). Rejects unsupported MIME types with a descriptive error.
     - Content-Length constraints enforcing maximum file size of 10 MB (10,485,760 bytes) per NFR2.
   - **And** helper operations are implemented for object lifecycle:
     - `checkObjectExists(key: string): Promise<boolean>` using `HeadObjectCommand`
     - `deleteObject(key: string): Promise<void>` using `DeleteObjectCommand`
     - `copyObject(sourceKey: string, destinationKey: string): Promise<void>` using `CopyObjectCommand` (required for promoting verified files from quarantine to operational buckets)
     - `ensureBucketExists(bucketName?: string): Promise<void>` to verify/create the target bucket in non-production.

4. **Object Key Partitioning & Quarantine Staging Support:**
   - **Given** requests to persist files across different domain contexts
   - **When** object keys are generated through helper method `createObjectKey(partition, filename, contextId?)`
   - **Then** object keys follow standardized hierarchical prefix partitions:
     - `quarantine/{uuid}-{sanitizedFilename}` (for incoming unverified files before malware scan per NFR13)
     - `identity/{userId}/{uuid}-{sanitizedFilename}` (for National ID / Iqama documents)
     - `payments/{dealId}/{paymentId}/{uuid}-{sanitizedFilename}` (for dual bank transfer receipts)
     - `contracts/{contractId}/{uuid}-{sanitizedFilename}` (for electronic signed contracts)
     - `licenses/{userId}/{uuid}-{sanitizedFilename}` (for Marketer Fal certificates)
   - **And** paths contain cryptographically secure random tokens (UUID v4 or nanoid) to prevent enumeration or collision.

5. **Unit & Integration Verification:**
   - **Given** test suites in `apps/api/src/modules/storage/__tests__/storage.service.spec.ts`
   - **When** `npm run test --workspace=apps/api` (or `npm test`) is executed
   - **Then** 100% of tests pass, verifying:
     - Presigned download URL generation correctly signs URLs and clamps expiration to 300 seconds.
     - Presigned upload URL generation sets appropriate metadata and rejects disallowed MIME types or sizes $> 10$ MB.
     - S3Client error handling gracefully handles connectivity errors without leaking internal credentials.
     - Key generation produces expected hierarchical paths with UUID isolation.
     - `copyObject` and `deleteObject` dispatch valid AWS SDK v3 commands.

## Tasks / Subtasks

- [x] Task 1: Docker Compose Local Infrastructure Enhancement (AC: 1)
  - [x] 1.1 Verify and update `docker-compose.yml` to ensure `postgres`, `minio`, and `mailpit` services have robust health checks and network definitions.
  - [x] 1.2 Add an automated bucket initialization service `minio-init` using `minio/mc:latest` to automatically create the `elmasaif-private-documents` bucket and set default private policy.
  - [x] 1.3 Add convenience root scripts in `package.json`: `"docker:up": "docker compose up -d"`, `"docker:down": "docker compose down"`, `"docker:logs": "docker compose logs -f"`.
  - [x] 1.4 Test `docker compose up -d` execution (if docker daemon available) or verify configuration syntax.

- [x] Task 2: Install AWS SDK v3 & Test Dependencies (AC: 2, AC: 3, AC: 5)
  - [x] 2.1 Install `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` as production dependencies in `apps/api/package.json`.
  - [x] 2.2 Configure testing in `apps/api/package.json` with Jest dependencies (`jest`, `@types/jest`, `ts-jest`) and `"test": "jest"` script configured for TypeScript.
  - [x] 2.3 Verify and harmonize environment variables across `.env`, `.env.example`, and `apps/api/.env` supporting both `STORAGE_*` and `S3_*` conventions with defaults for local MinIO.
  - [x] 2.4 Verify `apps/api/tsconfig.json` and build scripts compile cleanly with AWS SDK v3.

- [x] Task 3: Implement Dedicated `StorageModule` & `StorageService` (AC: 2, AC: 3, AC: 4)
  - [x] 3.1 Create `apps/api/src/modules/storage/storage.service.ts`:
    - Inject `ConfigService` to read endpoint, region, credentials, bucket name, and path-style option with dual variable fallback.
    - Initialize private `S3Client` instance with `forcePathStyle: true` for MinIO and standard AWS signing.
    - Implement `getPresignedDownloadUrl(key: string, expiresInSeconds = 300): Promise<string>` enforcing `Math.min(expiresInSeconds, 300)`.
    - Implement `getPresignedUploadUrl(key: string, contentType: string, expiresInSeconds = 300): Promise<{ uploadUrl: string; key: string }>` enforcing MIME type validation (`application/pdf`, `image/jpeg`, `image/png`) and 300s expiry limit.
    - Implement `deleteObject(key: string): Promise<void>` for cleaning up orphaned or rejected files.
    - Implement `copyObject(sourceKey: string, destinationKey: string): Promise<void>` for promoting quarantined files.
    - Implement `checkObjectExists(key: string): Promise<boolean>` using `HeadObjectCommand`.
    - Implement `createObjectKey(partition, filename, contextId?)` helper ensuring UUID isolation.
    - Implement `ensureBucketExists(bucketName?: string): Promise<void>` with error catch for idempotent creation.
  - [x] 3.2 Create `apps/api/src/modules/storage/storage.module.ts` exporting `StorageService`.
  - [x] 3.3 Register `StorageModule` in `apps/api/src/app.module.ts`.

- [x] Task 4: Author Unit Tests & Verify Storage Service (AC: 5)
  - [x] 4.1 Author comprehensive unit test suite in `apps/api/src/modules/storage/__tests__/storage.service.spec.ts`:
    - Test `getPresignedDownloadUrl` clamps any duration exceeding 300s down to 300s.
    - Test `getPresignedUploadUrl` generates valid signed upload URLs for valid MIME types and throws `BadRequestException` for unsupported types.
    - Test `createObjectKey` creates properly formatted hierarchical paths.
    - Test `copyObject` and `deleteObject` dispatch expected AWS SDK v3 commands.
    - Test error handling when client fails or credentials are missing.
  - [x] 4.2 Run `npm run test --workspace=apps/api` (or `npx jest`) and confirm all tests pass.
  - [x] 4.3 Run full monorepo build `npm run build` to confirm zero compilation or type errors.

## Dev Notes

### Architecture Patterns & Technical Guardrails

- **Data Residency & Sovereign S3 Target (NFR2, AR2, AR7, AD-6):**
  - Storage must be configuration-only. In production, storage targets in-Kingdom S3 infrastructure (e.g. AWS Saudi Arabia region announced for December 2026 or verified in-Kingdom provider; `me-south-1` Bahrain as interim with legal sign-off).
  - In local development, MinIO acts as an S3-compatible sovereign substitute.
  - **Signed URLs Expiry Invariant (NFR2, AR7):** Signed URLs for document downloads MUST have a maximum expiration duration of $\le 5$ minutes (300 seconds). Direct public S3 bucket access is strictly prohibited.
  - **File Size & Type Constraints (NFR2, NFR13):** Uploads are strictly capped at 10 MB (10,485,760 bytes). Validated formats are limited to `application/pdf`, `image/jpeg`, and `image/png`.

- **Library & Version Standards:**
  - MUST use `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` (AWS SDK v3 modular packages).
  - DO NOT use deprecated `aws-sdk` v2.
  - NestJS 10 `@nestjs/config` for environment variable injection.

- **MinIO Local Configuration Quirks:**
  - MinIO requires `forcePathStyle: true` in the `S3ClientConfig` when interacting with `http://localhost:9000` because DNS-style bucket subdomains (`bucket.localhost:9000`) do not resolve locally on Windows/Linux without custom `/etc/hosts` entries.
  - MinIO root credentials default to `minioadmin` / `miniopassword`.

- **Automated Bucket Initialization in `docker-compose.yml`:**
  ```yaml
  minio-init:
    image: minio/mc:latest
    depends_on:
      - minio
    entrypoint: >
      /bin/sh -c "
      /usr/bin/mc alias set local http://minio:9000 minioadmin miniopassword;
      /usr/bin/mc mb local/elmasaif-private-documents;
      exit 0;
      "
  ```

- **Object Key Hierarchical Partitions:**
  - Standard partition prefixes:
    - `quarantine/` — staging before malware scan hook (Story 0.7 / NFR13).
    - `identity/{userId}/` — National ID / Iqama scans (Story 1.4 / FR4).
    - `payments/{dealId}/{paymentId}/` — Wire transfer receipts for platform commission and seller payout (Story 5.2 / FR30).
    - `licenses/{userId}/` — Fal broker certificates and commercial registers (Story 6.1 / FR6).
    - `contracts/{contractId}/` — Owner signed listing agreements (Story 7.2 / FR9).

- **Jest Setup Pattern in `apps/api`:**
  - Add to `apps/api/package.json`:
    ```json
    "jest": {
      "moduleFileExtensions": ["js", "json", "ts"],
      "rootDir": "src",
      "testRegex": ".*\\.spec\\.ts$",
      "transform": {
        "^.+\\.(t|j)s$": "ts-jest"
      },
      "collectCoverageFrom": ["**/*.(t|j)s"],
      "coverageDirectory": "../coverage",
      "testEnvironment": "node"
    }
    ```

### Source Tree Components to Touch / Create

- **Create:**
  - `apps/api/src/modules/storage/storage.module.ts`
  - `apps/api/src/modules/storage/storage.service.ts`
  - `apps/api/src/modules/storage/__tests__/storage.service.spec.ts`

- **Modify / Verify:**
  - `docker-compose.yml` (add `minio-init` bucket auto-creation container)
  - `package.json` (add root docker scripts: `docker:up`, `docker:down`, `docker:logs`)
  - `apps/api/package.json` (add `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `jest`, `ts-jest`, `@types/jest`, and test script)
  - `apps/api/src/app.module.ts` (import and register `StorageModule`)
  - `.env`, `.env.example`, `apps/api/.env` (harmonize storage environment keys)

### Testing Standards Summary

- Test Framework: Jest in `apps/api`.
- Required Unit Test Cases:
  1. Clamping URL expiration: Passing 600s or 1000s to `getPresignedDownloadUrl` results in exactly 300s signed URL.
  2. Presigned upload parameters: Validates `PutObjectCommand` receives correct bucket, key, and content-type.
  3. Content-Type validation: Throws `BadRequestException` if user requests presigned URL for unsupported MIME type (e.g. `application/x-msdownload`, `text/html`).
  4. Error handling: Gracefully handles AWS client exceptions with clean NestJS logging without credentials exposure.
  5. Key generation: Verifies `createObjectKey` outputs UUID-guarded partitioned paths.
  6. Object lifecycle: Verifies `copyObject` and `deleteObject` dispatch valid commands.

### Project Structure Notes

- Module placed inside `apps/api/src/modules/storage/` conforming to NestJS modular feature architecture.
- Follows the decoupled modular monorepo layout (AD-1, AR1).
- No direct presentation imports: `apps/web` interacts with storage exclusively by requesting presigned URLs via NestJS endpoints (e.g. `/api/v1/storage/upload-url`), never through direct S3 client instantiation in browser.

### References

- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#AD-6] (S3 Object Storage In-Kingdom Residency & Signed URLs)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-elmasaif-2026-10-27/ARCHITECTURE-SPINE.md#Design Paradigm] (Infrastructure Tier with PostgreSQL 16 & MinIO S3)
- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.2] (Story 0.2: Local Infrastructure, Docker Compose & Private Sovereign S3 Target)
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#NFR2] (Private Object Storage & Signed URLs Data Residency)
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#AR2] (Docker Compose Local Infrastructure)
- [Source: _bmad-output/planning-artifacts/prds/prd-elmasaif-2026-10-26/prd.md#AR7] (Private S3 Storage & Signed URL Service)

## Dev Agent Record

### Agent Model Used

Gemini 3.8 Flash (High)

### Debug Log References

- Evaluated existing `docker-compose.yml` with PostgreSQL 16, MinIO, and Mailpit containers.
- Analyzed existing `apps/api/.env` noting storage configuration (`S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET_PRIVATE`).
- Established AWS SDK v3 modular requirements (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`).
- Specified NFR2 / AR7 guardrails for signed URLs ($\le 300$ seconds hard cap, 10 MB file size limit, private storage).
- Outlined Jest setup and missing test tooling in `apps/api/package.json` to prevent dev implementation blocking.
- Added `copyObject` and `createObjectKey` helper specs to prepare for Story 0.7 malware quarantine pipeline.

### Completion Notes List

- Added MinIO bucket auto-initialization service `minio-init` to `docker-compose.yml` with `elmasaif-network` bridge and root script `"docker:logs"`.
- Added `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` to `apps/api/package.json` with Jest and `ts-jest` test tooling.
- Harmonized environment variables across `.env`, `.env.example`, and `apps/api/.env` supporting both `STORAGE_*` and `S3_*` conventions with defaults for local MinIO.
- Implemented `StorageService` in `apps/api/src/modules/storage/storage.service.ts` injecting `ConfigService` with sovereign S3 client initialization, strict $\le 300$ seconds presigned URL expiration ceiling (NFR2, AR7), document MIME validation, partitioned key builder with UUID isolation, and object lifecycle helpers (`copyObject`, `deleteObject`, `checkObjectExists`, `ensureBucketExists`).
- Implemented and registered `StorageModule` in `apps/api/src/app.module.ts`.
- Authored 27 unit tests in `apps/api/src/modules/storage/__tests__/storage.service.spec.ts` covering all AC scenarios with 100% pass rate.
- Verified monorepo build and linting checks with zero errors.

### File List

- `.env`
- `.env.example`
- `apps/api/.env`
- `docker-compose.yml`
- `package.json`
- `package-lock.json`
- `apps/api/package.json`
- `apps/api/src/app.module.ts`
- `apps/api/src/modules/storage/storage.service.ts`
- `apps/api/src/modules/storage/storage.module.ts`
- `apps/api/src/modules/storage/__tests__/storage.service.spec.ts`
- `_bmad-output/implementation-artifacts/0-2-local-infrastructure-docker-compose-private-sovereign-s3-target.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-10-27: Completed Story 0.2 implementation — added local infrastructure MinIO init, AWS SDK v3 sovereign storage service with presigned URL generation, partitioned keys, and comprehensive Jest test suite.

