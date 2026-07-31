'use client';

import { useActionState, useEffect, useId, useOptimistic, useRef, useState } from 'react';
import { RECOMMENDATIONS, RECOMMENDATION_LABELS, type RecommendationKey } from '@/lib/enums';
import { initialReviewFormState, saveReview } from '@/app/candidates/actions';
import { RecommendationBadge } from '@/components/ui/badges';

/**
 * The review form — a Client Component, because it needs `useActionState`,
 * `useOptimistic` and focus management. It is one of only three Client
 * Components in the app.
 *
 * Note what it does *not* do: it never fetches, and it never decides
 * permissions. `canSubmit` arrives as a prop already resolved on the server,
 * and the Server Action re-checks it independently — this component could be
 * fully bypassed and the write would still be refused.
 */

export type MyReview = {
  score: number;
  recommendation: RecommendationKey;
  comment: string;
  updatedAt: string;
} | null;

export function ReviewForm({
  candidateId,
  candidateName,
  myReview,
  canSubmit,
  reviewerName,
  viewerRole,
}: {
  candidateId: string;
  candidateName: string;
  myReview: MyReview;
  canSubmit: boolean;
  reviewerName: string;
  viewerRole: string;
}) {
  const id = useId();
  const [state, formAction, isPending] = useActionState(saveReview, initialReviewFormState);
  const statusRef = useRef<HTMLDivElement>(null);

  /*
   * OPTIMISTIC UPDATE
   *
   * `myReview` is server state — it changes only when the action revalidates.
   * `useOptimistic` layers a provisional value on top for the duration of the
   * submit, so the reviewer sees their verdict applied instantly instead of
   * watching a spinner over a round trip plus a revalidation.
   *
   * The rollback is automatic and is the reason to use this hook rather than
   * `useState`: when the action settles, React discards the optimistic value
   * and re-renders from whatever the server actually returned. If the write
   * failed, the old review reappears on its own — there is no rollback branch
   * to write, and therefore no rollback branch to get wrong.
   */
  const [optimisticReview, applyOptimisticReview] = useOptimistic(
    myReview,
    (_current: MyReview, next: MyReview) => next,
  );

  // Controlled so the fields survive a validation round trip. Without this a
  // rejected submit would clear a long comment — the classic way to lose
  // someone's writing.
  const [score, setScore] = useState(myReview?.score ?? 70);
  const [recommendation, setRecommendation] = useState<RecommendationKey>(
    myReview?.recommendation ?? 'NEUTRAL',
  );
  const [comment, setComment] = useState(myReview?.comment ?? '');

  // Move focus to the result message after a submit settles, so a keyboard or
  // screen-reader user is told the outcome instead of being left in the
  // textarea with no feedback.
  useEffect(() => {
    if (state.status !== 'idle') statusRef.current?.focus();
  }, [state]);

  if (!canSubmit) {
    /*
     * UNAUTHORIZED STATE.
     *
     * Rendered instead of the form, not as a disabled form: a disabled form
     * implies "you could do this if you filled it in correctly", which is the
     * wrong message. The existing reviews stay visible — read access is not
     * what is being withheld.
     */
    return (
      <div
        role="note"
        className="rounded-lg border border-amber-300 bg-amber-50 p-4"
        aria-labelledby={`${id}-unauth`}
      >
        <h3 id={`${id}-unauth`} className="text-sm font-semibold text-amber-900">
          You cannot review this candidate
        </h3>
        <p className="mt-1 text-sm text-amber-900">
          Your role is <strong>{viewerRole}</strong>, which has read-only access. Ask an
          administrator for reviewer access to score submissions.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-4 shadow-card">
      <h3 className="text-sm font-semibold text-slate-900">
        {optimisticReview ? 'Your review' : 'Add your review'}
      </h3>
      <p className="mt-0.5 text-xs text-slate-600">
        Reviewing as {reviewerName}
        {optimisticReview && ' · submitting again updates your existing review'}
      </p>

      {/* The optimistic value renders here the instant the form is submitted. */}
      {optimisticReview && (
        <div
          // A labelled group, so a screen reader announces what this strip is
          // before reading the numbers in it — and so the summary is
          // addressable independently of the identically-worded <option>s in
          // the Recommendation select below.
          role="group"
          aria-label="Your current verdict"
          className={`mt-3 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 ${
            isPending ? 'opacity-70' : ''
          }`}
        >
          <span className="text-sm font-semibold tabular-nums text-slate-900">
            <span className="sr-only">Score </span>
            <span>{optimisticReview.score}</span>
            <span className="font-normal text-slate-500">/100</span>
          </span>
          <RecommendationBadge recommendation={optimisticReview.recommendation} />
          {isPending && (
            <span className="text-xs text-slate-600" role="status">
              Saving…
            </span>
          )}
        </div>
      )}

      <form
        action={(formData) => {
          // Applying the optimistic value inside the action callback is what
          // keeps it inside React's transition — outside one it would throw.
          applyOptimisticReview({
            score,
            recommendation,
            comment,
            updatedAt: new Date().toISOString(),
          });
          formAction(formData);
        }}
        className="mt-4 space-y-4"
      >
        <input type="hidden" name="candidateId" value={candidateId} />

        <div>
          <label htmlFor={`${id}-score`} className="block text-sm font-medium text-slate-800">
            {/*
              The explicit {' '} matters: JSX strips the newline between text
              and an adjacent tag, so without it the computed accessible name
              would be "Score(0–100)" — the visual `ml-1` gap is not read out.
            */}
            Score{' '}
            <span className="font-normal text-slate-500">(0–100)</span>
          </label>
          <div className="mt-1 flex items-center gap-3">
            {/*
              A range input plus a number input, both wired to the same state.
              The range is fast with a mouse; the number input is what makes the
              control usable for keyboard entry and screen readers, which is why
              both exist rather than the slider alone.
            */}
            <input
              id={`${id}-score`}
              name="score"
              type="range"
              min={0}
              max={100}
              value={score}
              onChange={(event) => setScore(Number(event.target.value))}
              aria-describedby={state.fieldErrors?.score ? `${id}-score-error` : undefined}
              aria-invalid={state.fieldErrors?.score ? true : undefined}
              className="h-2 w-full cursor-pointer accent-brand-700"
            />
            <label htmlFor={`${id}-score-number`} className="sr-only">
              Score as a number
            </label>
            <input
              id={`${id}-score-number`}
              type="number"
              min={0}
              max={100}
              value={score}
              onChange={(event) => setScore(Number(event.target.value))}
              className="w-20 rounded-lg border border-surface-200 px-2 py-1.5 text-sm tabular-nums shadow-card"
            />
          </div>
          {state.fieldErrors?.score && (
            <p id={`${id}-score-error`} className="mt-1 text-sm text-rose-700">
              {state.fieldErrors.score}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={`${id}-recommendation`}
            className="block text-sm font-medium text-slate-800"
          >
            Recommendation
          </label>
          <select
            id={`${id}-recommendation`}
            name="recommendation"
            value={recommendation}
            onChange={(event) => setRecommendation(event.target.value as RecommendationKey)}
            aria-describedby={
              state.fieldErrors?.recommendation ? `${id}-recommendation-error` : undefined
            }
            aria-invalid={state.fieldErrors?.recommendation ? true : undefined}
            className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-2.5 py-2 text-sm shadow-card"
          >
            {RECOMMENDATIONS.map((option) => (
              <option key={option} value={option}>
                {RECOMMENDATION_LABELS[option]}
              </option>
            ))}
          </select>
          {state.fieldErrors?.recommendation && (
            <p id={`${id}-recommendation-error`} className="mt-1 text-sm text-rose-700">
              {state.fieldErrors.recommendation}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={`${id}-comment`} className="block text-sm font-medium text-slate-800">
            Comment
          </label>
          <p id={`${id}-comment-hint`} className="mt-0.5 text-xs text-slate-600">
            What did you see in the work? Visible to the hiring team, not to {candidateName}.
          </p>
          <textarea
            id={`${id}-comment`}
            name="comment"
            rows={5}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            // Both the hint and any error are referenced, so the guidance is
            // announced along with the field rather than being visual-only.
            aria-describedby={
              state.fieldErrors?.comment
                ? `${id}-comment-hint ${id}-comment-error`
                : `${id}-comment-hint`
            }
            aria-invalid={state.fieldErrors?.comment ? true : undefined}
            className="mt-1 w-full rounded-lg border border-surface-200 px-2.5 py-2 text-sm shadow-card
                       placeholder:text-slate-400"
            placeholder="Strong data modelling; the README is honest about tradeoffs…"
          />
          {state.fieldErrors?.comment && (
            <p id={`${id}-comment-error`} className="mt-1 text-sm text-rose-700">
              {state.fieldErrors.comment}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-gradient-to-r from-brand-600 to-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-card
                       hover:from-brand-500 hover:to-brand-600 disabled:cursor-not-allowed disabled:opacity-60 transition-all"
          >
            {isPending ? 'Saving…' : optimisticReview ? 'Update review' : 'Submit review'}
          </button>
        </div>

        {/*
          Single live region for the submit outcome. tabIndex={-1} so the effect
          above can move focus here; role="status" announces it politely for
          success, and the error case is rendered with role="alert" to interrupt.
        */}
        <div
          ref={statusRef}
          tabIndex={-1}
          role={state.status === 'success' ? 'status' : 'alert'}
          aria-live={state.status === 'success' ? 'polite' : 'assertive'}
          className="min-h-[1.25rem] outline-none"
        >
          {state.status === 'success' && (
            <p className="text-sm font-medium text-emerald-800">✓ {state.message}</p>
          )}
          {(state.status === 'error' || state.status === 'unauthorized') && (
            <p className="text-sm font-medium text-rose-700">{state.message}</p>
          )}
        </div>
      </form>
    </div>
  );
}
