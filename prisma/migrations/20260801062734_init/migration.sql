-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessmentStatus" TEXT NOT NULL,
    "score" INTEGER,
    "cvObjectKey" TEXT NOT NULL,
    "cvFileName" TEXT NOT NULL,
    "phone" TEXT,
    "internalNotes" TEXT,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "workUrl" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "timeTakenMinutes" INTEGER NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreeningAnswer" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "ScreeningAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "submissionId" TEXT,
    "reviewerId" TEXT NOT NULL,
    "reviewerName" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "recommendation" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_email_key" ON "Candidate"("email");

-- CreateIndex
CREATE INDEX "Candidate_stage_score_idx" ON "Candidate"("stage", "score");

-- CreateIndex
CREATE INDEX "Candidate_role_city_idx" ON "Candidate"("role", "city");

-- CreateIndex
CREATE INDEX "Candidate_assessmentStatus_appliedAt_idx" ON "Candidate"("assessmentStatus", "appliedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_slug_key" ON "Assessment"("slug");

-- CreateIndex
CREATE INDEX "Assessment_role_idx" ON "Assessment"("role");

-- CreateIndex
CREATE INDEX "Submission_candidateId_idx" ON "Submission"("candidateId");

-- CreateIndex
CREATE INDEX "Submission_assessmentId_idx" ON "Submission"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_candidateId_assessmentId_key" ON "Submission"("candidateId", "assessmentId");

-- CreateIndex
CREATE INDEX "ScreeningAnswer_candidateId_position_idx" ON "ScreeningAnswer"("candidateId", "position");

-- CreateIndex
CREATE INDEX "Review_candidateId_createdAt_idx" ON "Review"("candidateId", "createdAt");

-- CreateIndex
CREATE INDEX "Review_submissionId_idx" ON "Review"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_candidateId_reviewerId_key" ON "Review"("candidateId", "reviewerId");

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningAnswer" ADD CONSTRAINT "ScreeningAnswer_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
