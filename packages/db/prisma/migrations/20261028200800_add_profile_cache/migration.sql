-- CreateEnum
CREATE TYPE "ProfileOutcome" AS ENUM ('profile', 'not_found');

-- CreateTable
CREATE TABLE "Profile" (
    "username" TEXT NOT NULL,
    "outcome" "ProfileOutcome" NOT NULL,
    "languageShare" JSONB,
    "topics" TEXT[],
    "emptyProfile" BOOLEAN NOT NULL DEFAULT false,
    "builtAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("username")
);

-- CreateIndex
CREATE INDEX "Profile_builtAt_idx" ON "Profile"("builtAt");
