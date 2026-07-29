import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { Session } from '@/lib/auth';

/**
 * The review Server Action, tested against a real SQLite database.
 *
 * Only two things are faked, and both are boundaries rather than behaviour:
 *
 *   - `getSession`, so a test can act as any role. This is what makes the
 *     authorization path testable at all.
 *   - `revalidatePath`, which needs Next's request context and would throw
 *     outside it. It is a spy, so tests can still assert it was called — cache
 *     invalidation is part of the action's contract, not an implementation
 *     detail.
 *
 * The database is real, so the transaction, the upsert key and the derived
 * `Candidate.score` are all genuinely exercised. Mocking Prisma here would have
 * tested that the code calls the functions we wrote, which is not the same as
 * testing that a review is saved.
 */

const currentSession: { value: Session } = {
  value: { userId: 'usr_reviewer', name: 'Sam Okafor', role: 'REVIEWER' },
};

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return {
    ...actual, // keep the real canReview/canSeeInternalNotes predicates
    getSession: vi.fn(async () => currentSession.value),
  };
});

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

const { saveReview, initialReviewFormState } = await import('@/app/candidates/actions');

const db = new PrismaClient();

function formData(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

async function seedCandidate(overrides: { score?: number | null; withSubmission?: boolean } = {}) {
  const suffix = Math.random().toString(36).slice(2, 10);
  const candidate = await db.candidate.create({
    data: {
      fullName: `Test Candidate ${suffix}`,
      email: `test-${suffix}@example.com`,
      city: 'Berlin',
      role: 'BACKEND_ENGINEER',
      stage: 'ASSESSMENT',
      assessmentStatus: overrides.withSubmission ? 'SUBMITTED' : 'INVITED',
      score: overrides.score ?? null,
      cvObjectKey: `cvs/2026/test-${suffix}.pdf`,
      cvFileName: 'Test-CV.pdf',
      internalNotes: 'Recruiter-only note.',
    },
  });

  if (overrides.withSubmission) {
    const assessment = await db.assessment.create({
      data: {
        slug: `brief-${suffix}`,
        title: 'Idempotent payments webhook',
        role: 'BACKEND_ENGINEER',
        brief: 'Process each event exactly once.',
        durationMinutes: 180,
      },
    });
    await db.submission.create({
      data: {
        candidateId: candidate.id,
        assessmentId: assessment.id,
        workUrl: 'https://github.com/example/work',
        submittedAt: new Date(),
        timeTakenMinutes: 150,
      },
    });
  }

  return candidate;
}

const validFields = {
  score: '82',
  recommendation: 'YES',
  comment: 'Handles replays with a unique constraint rather than an application-level check.',
};

beforeEach(async () => {
  vi.clearAllMocks();
  currentSession.value = { userId: 'usr_reviewer', name: 'Sam Okafor', role: 'REVIEWER' };
  await db.review.deleteMany();
  await db.submission.deleteMany();
  await db.screeningAnswer.deleteMany();
  await db.candidate.deleteMany();
  await db.assessment.deleteMany();
});

afterAll(async () => {
  await db.$disconnect();
});

describe('saveReview', () => {
  it('saves a review and moves the candidate score with it', async () => {
    const candidate = await seedCandidate({ score: 40, withSubmission: true });

    const state = await saveReview(
      initialReviewFormState,
      formData({ candidateId: candidate.id, ...validFields }),
    );

    expect(state.status).toBe('success');

    const review = await db.review.findFirstOrThrow({ where: { candidateId: candidate.id } });
    expect(review).toMatchObject({
      score: 82,
      recommendation: 'YES',
      comment: validFields.comment,
      reviewerId: 'usr_reviewer',
      // Denormalised from the session so the detail pane can show a name
      // without a join to a users table we do not have.
      reviewerName: 'Sam Okafor',
    });

    // The derived column must move in the same transaction, or the list would
    // show a different number from the detail pane.
    const updated = await db.candidate.findUniqueOrThrow({ where: { id: candidate.id } });
    expect(updated.score).toBe(82);
  });

  it('links the review to the candidate latest submission', async () => {
    const candidate = await seedCandidate({ withSubmission: true });
    await saveReview(initialReviewFormState, formData({ candidateId: candidate.id, ...validFields }));

    const review = await db.review.findFirstOrThrow({ where: { candidateId: candidate.id } });
    expect(review.submissionId).not.toBeNull();
  });

  it('allows reviewing a candidate who never submitted, with a null submission link', async () => {
    // Legitimate case: a reviewer can reject at the screening stage.
    const candidate = await seedCandidate({ withSubmission: false });
    const state = await saveReview(
      initialReviewFormState,
      formData({ candidateId: candidate.id, ...validFields }),
    );

    expect(state.status).toBe('success');
    const review = await db.review.findFirstOrThrow({ where: { candidateId: candidate.id } });
    expect(review.submissionId).toBeNull();
  });

  it('updates the existing review instead of creating a second one', async () => {
    // This is the @@unique([candidateId, reviewerId]) upsert path, and it is
    // what makes the optimistic UI correct on a second submit.
    const candidate = await seedCandidate({ withSubmission: true });

    await saveReview(initialReviewFormState, formData({ candidateId: candidate.id, ...validFields }));
    await saveReview(
      initialReviewFormState,
      formData({
        candidateId: candidate.id,
        score: '35',
        recommendation: 'NO',
        comment: 'Revisited this with fresh eyes — the concurrency handling does not hold up.',
      }),
    );

    const reviews = await db.review.findMany({ where: { candidateId: candidate.id } });
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({ score: 35, recommendation: 'NO' });

    const updated = await db.candidate.findUniqueOrThrow({ where: { id: candidate.id } });
    expect(updated.score).toBe(35);
  });

  it('keeps reviews from different reviewers side by side', async () => {
    const candidate = await seedCandidate({ withSubmission: true });

    await saveReview(initialReviewFormState, formData({ candidateId: candidate.id, ...validFields }));

    currentSession.value = { userId: 'usr_admin', name: 'Priya Raman', role: 'ADMIN' };
    await saveReview(
      initialReviewFormState,
      formData({
        candidateId: candidate.id,
        score: '60',
        recommendation: 'NEUTRAL',
        comment: 'Reading this less generously than my colleague did.',
      }),
    );

    const reviews = await db.review.findMany({ where: { candidateId: candidate.id } });
    expect(reviews).toHaveLength(2);
  });

  it('revalidates the candidates subtree so the list cannot serve a stale score', async () => {
    const candidate = await seedCandidate({ withSubmission: true });
    await saveReview(initialReviewFormState, formData({ candidateId: candidate.id, ...validFields }));

    // 'layout' scope, because one write changes both the detail pane and the
    // row back on the list.
    expect(revalidatePath).toHaveBeenCalledWith('/candidates', 'layout');
  });

  describe('authorization', () => {
    it('refuses a VIEWER and writes nothing', async () => {
      const candidate = await seedCandidate({ score: 40, withSubmission: true });
      currentSession.value = { userId: 'usr_viewer', name: 'Jo Lindqvist', role: 'VIEWER' };

      const state = await saveReview(
        initialReviewFormState,
        formData({ candidateId: candidate.id, ...validFields }),
      );

      expect(state.status).toBe('unauthorized');
      expect(await db.review.count()).toBe(0);
      // The derived score must be untouched too — a refused write that still
      // moved the score would be worse than no check at all.
      const unchanged = await db.candidate.findUniqueOrThrow({ where: { id: candidate.id } });
      expect(unchanged.score).toBe(40);
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it('checks permission before validating input', async () => {
      // A VIEWER posting garbage should be told they lack permission, not
      // handed a field-level validation map that leaks what the form expects.
      currentSession.value = { userId: 'usr_viewer', name: 'Jo Lindqvist', role: 'VIEWER' };
      const state = await saveReview(initialReviewFormState, formData({ candidateId: 'x' }));

      expect(state.status).toBe('unauthorized');
      expect(state.fieldErrors).toBeUndefined();
    });
  });

  describe('validation', () => {
    it('rejects an out-of-range score without writing', async () => {
      const candidate = await seedCandidate({ score: 40, withSubmission: true });

      const state = await saveReview(
        initialReviewFormState,
        formData({ ...validFields, candidateId: candidate.id, score: '250' }),
      );

      expect(state.status).toBe('error');
      expect(state.fieldErrors?.score).toMatch(/between 0 and 100/);
      expect(await db.review.count()).toBe(0);
    });

    it('rejects a comment too short to be a review', async () => {
      const candidate = await seedCandidate({ withSubmission: true });

      const state = await saveReview(
        initialReviewFormState,
        formData({ ...validFields, candidateId: candidate.id, comment: 'ok' }),
      );

      expect(state.status).toBe('error');
      expect(state.fieldErrors?.comment).toBeDefined();
      expect(await db.review.count()).toBe(0);
    });

    it('rejects a recommendation outside the allowed set', async () => {
      // SQLite has no enum type, so this zod check is the only thing standing
      // between a crafted POST and a junk value in the column.
      const candidate = await seedCandidate({ withSubmission: true });

      const state = await saveReview(
        initialReviewFormState,
        formData({ ...validFields, candidateId: candidate.id, recommendation: 'DEFINITELY_MAYBE' }),
      );

      expect(state.status).toBe('error');
      expect(state.fieldErrors?.recommendation).toBeDefined();
      expect(await db.review.count()).toBe(0);
    });
  });
});
