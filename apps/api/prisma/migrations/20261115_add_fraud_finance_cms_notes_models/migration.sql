-- CreateEnum
CREATE TYPE "FraudEventType" AS ENUM ('REPEATED_REJECTED_PROOFS', 'REPEATED_IBAN_CHANGES', 'REPEATED_CANCELLATIONS', 'SUSPICIOUS_MESSAGING', 'UNAUTHORIZED_BROKER_ACTIVITY', 'MANUAL_SUSPICIOUS_REPORT');

-- CreateEnum
CREATE TYPE "FraudSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FraudStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "NoteEntityType" AS ENUM ('LISTING', 'DEAL', 'USER', 'DISPUTE', 'CONTRACT');

-- CreateEnum
CREATE TYPE "CmsPageCategory" AS ENUM ('LEGAL_TERMS', 'PRIVACY_POLICY', 'FAQ', 'GUIDE', 'ANNOUNCEMENT');

-- CreateTable
CREATE TABLE "fraud_logs" (
    "id" TEXT NOT NULL,
    "case_number" TEXT NOT NULL,
    "event_type" "FraudEventType" NOT NULL,
    "severity" "FraudSeverity" NOT NULL DEFAULT 'LOW',
    "status" "FraudStatus" NOT NULL DEFAULT 'OPEN',
    "target_user_id" TEXT,
    "target_listing_id" TEXT,
    "target_deal_id" TEXT,
    "detected_reasons" TEXT[] NOT NULL,
    "description" TEXT NOT NULL,
    "penalty_sar" DECIMAL(12,2),
    "penalty_reason" TEXT,
    "marketer_suspended" BOOLEAN NOT NULL DEFAULT false,
    "logged_by_admin_id" TEXT,
    "resolved_by_admin_id" TEXT,
    "resolution_notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fraud_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_internal_notes" (
    "id" TEXT NOT NULL,
    "entity_type" "NoteEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "content" VARCHAR(1000) NOT NULL,
    "author_admin_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operational_internal_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_pages" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "CmsPageCategory" NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMP(3),
    "author_admin_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_banners" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "banner_type" TEXT NOT NULL DEFAULT 'INFO',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "action_url" TEXT,
    "action_text" TEXT,
    "created_by_admin_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcement_banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_items" (
    "id" TEXT NOT NULL,
    "question_ar" TEXT NOT NULL,
    "answer_ar" TEXT NOT NULL,
    "question_en" TEXT,
    "answer_en" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fraud_logs_case_number_key" ON "fraud_logs"("case_number");

-- CreateIndex
CREATE INDEX "fraud_logs_event_type_status_idx" ON "fraud_logs"("event_type", "status");

-- CreateIndex
CREATE INDEX "fraud_logs_target_user_id_idx" ON "fraud_logs"("target_user_id");

-- CreateIndex
CREATE INDEX "fraud_logs_created_at_idx" ON "fraud_logs"("created_at");

-- CreateIndex
CREATE INDEX "operational_internal_notes_entity_type_entity_id_created_at_idx" ON "operational_internal_notes"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "cms_pages_slug_key" ON "cms_pages"("slug");

-- CreateIndex
CREATE INDEX "cms_pages_category_is_published_display_order_idx" ON "cms_pages"("category", "is_published", "display_order");

-- CreateIndex
CREATE INDEX "announcement_banners_is_active_start_at_end_at_idx" ON "announcement_banners"("is_active", "start_at", "end_at");

-- CreateIndex
CREATE INDEX "faq_items_category_is_published_display_order_idx" ON "faq_items"("category", "is_published", "display_order");

-- AddForeignKey
ALTER TABLE "fraud_logs" ADD CONSTRAINT "fraud_logs_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fraud_logs" ADD CONSTRAINT "fraud_logs_logged_by_admin_id_fkey" FOREIGN KEY ("logged_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fraud_logs" ADD CONSTRAINT "fraud_logs_resolved_by_admin_id_fkey" FOREIGN KEY ("resolved_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_internal_notes" ADD CONSTRAINT "operational_internal_notes_author_admin_id_fkey" FOREIGN KEY ("author_admin_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_pages" ADD CONSTRAINT "cms_pages_author_admin_id_fkey" FOREIGN KEY ("author_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_banners" ADD CONSTRAINT "announcement_banners_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

