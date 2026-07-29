'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { canReview, getSession } from '@/lib/auth';
import { RECOMMENDATIONS } from '@/lib/enums';

/**
 * Save a review.
 *
 * WHY A SERVER ACTION RATHER THAN A ROUTE HANDLER
 *
 *  - It removes an entire layer. A POST /api/reviews endpoint would need its
 *    own request parsing, its own response shape, a client-side fetch wrapper,
 *    and manual error/loading plumbing. This is one function, imported by the
 *    form, type-checked end to end — a renamed field is a compile error rather
 *    than a 400 at runtime.
 *
 *  - Mutation and cache invalidation happen in the same place. `revalidatePath`
 *    below runs in the same call that writes, so there is no window where the
 *    write has landed but the UI still shows stale data, and no "remember to
 *    invalidate" step on the caller.
 *
 *  - It degrades without JavaScript. The form posts to this action natively, so
 *    a review can still be submitted before hydration completes.
 *
 *  - `useActionState` gives pending state and returned errors for free, which
 *    is what makes the optimistic UI in ReviewForm short instead of a
 *    hand-rolled state machine.
 *
 * A Route Handler would be the right call if this needed to be consumed by
 * something that is not this app — a mobile client, a webhook, an integration.
 * It is not, so it isn't one.
 *
 * SECURITY: a Server Action is a public HTTP endpoint. Next generates an ID for
 * it and anyone can POST to that ID. So the authorization check below is not a
 * duplicate of the UI check — the UI check is cosmetic and this one is real.
 * Inputs are likewise re-validated here regardless of any client-side
 * constraint.
 */

const ReviewSchema = z.object({
  candidateId: z.string().min(1, 'Missing candidate.'),
  // Coerce because FormData values are always strings.
  score: z.coerce
    .number({ invalid_type_error: 'Score must be a number.' })
    .int('Score must be a whole number.')
    .min(0, 'Score must be between 0 and 100.')
    .max(100, 'Score must be between 0 and 100.'),
  recommendation: z.enum(RECOMMENDATIONS, {
    errorMap: () => ({ message: 'Choose a recommendation.' }),
  }),
  comment: z
    .string()
    .trim()
    .min(10, 'Add at least a sentence — a score with no reasoning is not reviewable.')
    .max(4000, 'Comment is too long (4000 characters max).'),
});

export type ReviewFormState = {
  status: 'idle' | 'success' | 'error' | 'unauthorized';
  message?: string;
  /** Keyed by field name so inputs can wire up aria-describedby. */
  fieldErrors?: Partial<Record<'score' | 'recommendation' | 'comment', string>>;
};

export const initialReviewFormState: ReviewFormState = { status: 'idle' };

export async function saveReview(
  _prevState: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const session = await getSession();

  // Authorization first — before parsing, before touching the database.
  if (!canReview(session)) {
    return {
      status: 'unauthorized',
      message: `Your role (${session.role}) can view candidates but cannot submit reviews.`,
    };
  }

  const parsed = ReviewSchema.safeParse({
    candidateId: formData.get('candidateId'),
    score: formData.get('score'),
    recommendation: formData.get('recommendation'),
    comment: formData.get('comment'),
  });

  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    return {
      status: 'error',
      message: 'Please fix the highlighted fields.',
      fieldErrors: {
        score: flattened.score?.[0],
        recommendation: flattened.recommendation?.[0],
        comment: flattened.comment?.[0],
      },
    };
  }

  const { candidateId, score, recommendation, comment } = parsed.data;

  // Attach the review to the candidate's latest submission when there is one,
  // so a review is traceable to the specific work it judged. Reviews of
  // candidates who never submitted are allowed and simply have a null link.
  const latestSubmission = await db.submission.findFirst({
    where: { candidateId },
    orderBy: { submittedAt: 'desc' },
    select: { id: true },
  });

  try {
    /*
     * One transaction, two writes. Candidate.score is derived state (see
     * schema.prisma), so it must not be possible to persist a review without
     * the list's score moving with it — that would show a reviewer one number
     * on the detail pane and a different one in the list.
     */
    await db.$transaction([
      db.review.upsert({
        // Matches @@unique([candidateId, reviewerId]) — one verdict per
        // reviewer, so re-submitting edits rather than duplicating.
        where: { candidateId_reviewerId: { candidateId, reviewerId: session.userId } },
        create: {
          candidateId,
          submissionId: latestSubmission?.id ?? null,
          reviewerId: session.userId,
          reviewerName: session.name,
          score,
          recommendation,
          comment,
        },
        update: {
          score,
          recommendation,
          comment,
          submissionId: latestSubmission?.id ?? null,
        },
      }),
      db.candidate.update({
        where: { id: candidateId },
        data: { score },
      }),
    ]);
  } catch (error) {
    // A failed write must not look like a success. The optimistic UI in
    // ReviewForm rolls back when this state comes back non-success.
    console.error('saveReview failed:', error);
    return {
      status: 'error',
      message: 'Could not save your review. Nothing was changed — please try again.',
    };
  }

  /*
   * CACHE INVALIDATION
   *
   * 'layout' scope, not 'page': this one write changes two things at two URLs —
   * the review history on /candidates/<id>, and the score and review count of
   * that row back on /candidates. Revalidating the layout segment covers the
   * whole subtree, including both parallel-route slots.
   *
   * The important target is the client-side Router Cache. Without this, a user
   * who submits a review and navigates back to the list can be served the
   * previously-rendered list from memory and see their own change missing —
   * the single most confusing possible outcome. This is the "must be fresh"
   * half of the caching story in the README; the list tolerating brief
   * staleness is the other half.
   */
  revalidatePath('/candidates', 'layout');

  return { status: 'success', message: 'Review saved.' };
}
