-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "requestedBy" TEXT;

-- CreateIndex
CREATE INDEX "Profile_requestedBy_builtAt_idx" ON "Profile"("requestedBy", "builtAt");
