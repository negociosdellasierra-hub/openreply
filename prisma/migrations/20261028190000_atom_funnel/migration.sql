-- CreateTable
CREATE TABLE "FunnelContact" (
    "id" TEXT NOT NULL,
    "instagramAccountId" TEXT NOT NULL,
    "igsid" TEXT NOT NULL,
    "username" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT,
    "awaiting" TEXT,
    "runId" TEXT,
    "pausedUntil" TIMESTAMP(3),
    "lastUserAt" TIMESTAMP(3),
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FunnelContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FunnelContact_instagramAccountId_idx" ON "FunnelContact"("instagramAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "FunnelContact_instagramAccountId_igsid_key" ON "FunnelContact"("instagramAccountId", "igsid");
