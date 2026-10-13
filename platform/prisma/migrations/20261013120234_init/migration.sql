-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('prospect', 'onboarding', 'live', 'paused', 'cancelled');

-- CreateEnum
CREATE TYPE "Component" AS ENUM ('ai_secretary', 'website', 'quotes', 'web_chat', 'reviews');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'onboarding',
    "plan" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "component_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "component" "Component" NOT NULL,
    "config" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "component_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "component_config_revisions" (
    "id" UUID NOT NULL,
    "component_config_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "updated_by" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "component_config_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "component_configs_tenant_id_component_key" ON "component_configs"("tenant_id", "component");

-- CreateIndex
CREATE UNIQUE INDEX "component_config_revisions_component_config_id_version_key" ON "component_config_revisions"("component_config_id", "version");

-- AddForeignKey
ALTER TABLE "component_configs" ADD CONSTRAINT "component_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_config_revisions" ADD CONSTRAINT "component_config_revisions_component_config_id_fkey" FOREIGN KEY ("component_config_id") REFERENCES "component_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
