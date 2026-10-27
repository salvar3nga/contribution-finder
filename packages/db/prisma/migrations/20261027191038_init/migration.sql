-- CreateEnum
CREATE TYPE "IssueState" AS ENUM ('open', 'closed');

-- CreateTable
CREATE TABLE "Repo" (
    "id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT,
    "stars" INTEGER NOT NULL,
    "topics" TEXT[],
    "lastCommitAt" TIMESTAMP(3),
    "medianFirstResponseHours" DOUBLE PRECISION,
    "firstTimePrsTotal" INTEGER NOT NULL DEFAULT 0,
    "firstTimePrsMerged" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "ingestedAt" TIMESTAMP(3),

    CONSTRAINT "Repo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "labels" TEXT[],
    "claimed" BOOLEAN NOT NULL,
    "state" "IssueState" NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestRun" (
    "id" SERIAL NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "reposIngested" INTEGER NOT NULL,
    "issuesIngested" INTEGER NOT NULL,
    "errors" INTEGER NOT NULL,
    "stoppedForRateLimit" BOOLEAN NOT NULL,

    CONSTRAINT "IngestRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Repo_ingestedAt_idx" ON "Repo"("ingestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Repo_owner_name_key" ON "Repo"("owner", "name");

-- CreateIndex
CREATE INDEX "Issue_repoId_state_idx" ON "Issue"("repoId", "state");

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
