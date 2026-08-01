import Link from 'next/link';
import type { CandidateDetail } from '@/lib/candidates';
import type { Session } from '@/lib/auth';
import { ROLE_LABELS } from '@/lib/enums';
import {
  AssessmentStatusBadge,
  RecommendationBadge,
  ScoreBadge,
  StageBadge,
} from '@/components/ui/badges';
import { ReviewForm, type MyReview } from './ReviewForm';
import { ScrollToTop } from './ScrollToTop';

/**
 * The candidate detail panel — a Server Component.
 *
 * Everything here is read-only presentation of data already fetched on the
 * server, so it stays on the server. The single Client Component in this
 * subtree is ReviewForm, and it receives only what it needs to render the form:
 * no CV key, no internal notes, no session object.
 */

function formatDate(iso: string) {
  // en-GB with an explicit UTC timezone: without pinning both, the server and
  // the browser can format the same timestamp differently and React reports a
  // hydration mismatch.
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso));
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

export function CandidateDetailPanel({
  candidate,
  session,
  canSubmitReview,
  backHref,
}: {
  candidate: CandidateDetail;
  session: Session;
  canSubmitReview: boolean;
  backHref: string;
}) {
  const myReviewRecord = candidate.reviews.find((review) => review.reviewerId === session.userId);
  const otherReviews = candidate.reviews.filter((review) => review.reviewerId !== session.userId);

  const myReview: MyReview = myReviewRecord
    ? {
        score: myReviewRecord.score,
        recommendation: myReviewRecord.recommendation,
        comment: myReviewRecord.comment,
        updatedAt: myReviewRecord.updatedAt,
      }
    : null;

  return (
    <article className="space-y-4 pb-8" aria-labelledby="candidate-name">
      <ScrollToTop />
      {/* Mobile-only escape hatch. On desktop the list is always on screen. */}
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 rounded text-sm font-medium text-brand-700 hover:text-brand-600 lg:hidden"
      >
        <span aria-hidden="true">←</span> Back to candidates
      </Link>

      <header className="rounded-2xl border border-surface-200 bg-white p-4 shadow-card sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 id="candidate-name" className="text-xl font-semibold tracking-tight text-slate-900">
              {candidate.fullName}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {ROLE_LABELS[candidate.role]} · {candidate.city}
            </p>
            <p className="mt-0.5 text-sm text-slate-600">
              <a
                href={`mailto:${candidate.email}`}
                className="rounded underline underline-offset-2 hover:text-slate-900"
              >
                {candidate.email}
              </a>
            </p>
          </div>
          <ScoreBadge score={candidate.score} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StageBadge stage={candidate.stage} />
          <AssessmentStatusBadge status={candidate.assessmentStatus} />
          <span className="text-xs text-slate-600">Applied {formatDate(candidate.appliedAt)}</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {/*
            CV link.
            `cvHref` is /api/cv/<id> — our own route, not the file's location.
            The storage object key never leaves the server, so there is no
            durable URL in the HTML, in the RSC payload, or in a copied link
            that would still resolve after this person's access is revoked.
            The route re-checks the session and mints a short-lived URL.
          */}
          <a
            href={candidate.cvHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-sm font-medium
                       text-slate-800 shadow-card hover:bg-brand-50 hover:border-brand-300 transition-colors"
          >
            View CV
            <span className="ml-1 text-slate-500">({candidate.cvFileName})</span>
            <span className="sr-only"> — opens in a new tab</span>
          </a>

          {candidate.submission && (
            <a
              href={candidate.submission.workUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-sm font-medium
                         text-slate-800 shadow-card hover:bg-brand-50 hover:border-brand-300 transition-colors"
            >
              Submitted work
              <span className="sr-only"> — opens in a new tab</span>
            </a>
          )}
        </div>
      </header>

      {/*
        Recruiter-only block. This is not conditionally *hidden* — for a
        non-ADMIN session the field is never selected from the database, so it
        is absent from the RSC payload entirely. See lib/candidates.ts.
      */}
      {candidate.internalNotes !== undefined && candidate.internalNotes && (
        <Section title="Internal notes" badge="Admin only">
          <p className="whitespace-pre-line text-sm text-slate-700">{candidate.internalNotes}</p>
          {candidate.phone && (
            <p className="mt-2 text-sm text-slate-600">Phone: {candidate.phone}</p>
          )}
        </Section>
      )}

      <Section title="Screening answers">
        {candidate.screeningAnswers.length === 0 ? (
          <p className="text-sm text-slate-600">No screening answers on file.</p>
        ) : (
          <dl className="space-y-3">
            {candidate.screeningAnswers.map((answer) => (
              <div key={answer.id}>
                <dt className="text-sm font-medium text-slate-900">{answer.question}</dt>
                <dd className="mt-0.5 text-sm text-slate-700">{answer.answer}</dd>
              </div>
            ))}
          </dl>
        )}
      </Section>

      <Section title="Assessment">
        {candidate.assessment ? (
          <>
            <h3 className="text-sm font-medium text-slate-900">{candidate.assessment.title}</h3>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
              {candidate.assessment.brief}
            </p>
            <p className="mt-2 text-xs text-slate-600">
              Expected time budget: {formatDuration(candidate.assessment.durationMinutes)}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-600">
            No assessment brief is configured for {ROLE_LABELS[candidate.role]} yet.
          </p>
        )}

        <div className="mt-4 border-t border-slate-200 pt-3">
          {candidate.submission ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-slate-600">Submitted</dt>
                <dd className="text-slate-900">{formatDate(candidate.submission.submittedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-600">Time taken</dt>
                <dd className="text-slate-900">
                  {formatDuration(candidate.submission.timeTakenMinutes)}
                  {candidate.submission.overTime && (
                    <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-900">
                      Over budget
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          ) : (
            // Not an error — most candidates in the pipeline legitimately have
            // no submission yet. The message says which of those cases it is.
            <p className="text-sm text-slate-600">
              Nothing submitted yet. Assessment status is{' '}
              <strong className="font-medium text-slate-800">
                {candidate.assessmentStatus.toLowerCase().replace('_', ' ')}
              </strong>
              .
            </p>
          )}
        </div>
      </Section>

      <ReviewForm
        candidateId={candidate.id}
        candidateName={candidate.fullName}
        myReview={myReview}
        canSubmit={canSubmitReview}
        reviewerName={session.name}
        viewerRole={session.role}
      />

      <Section title={`Other reviews (${otherReviews.length})`}>
        {otherReviews.length === 0 ? (
          <p className="text-sm text-slate-600">No one else has reviewed this candidate yet.</p>
        ) : (
          <ul className="space-y-3">
            {otherReviews.map((review) => (
              <li key={review.id} className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{review.reviewerName}</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-700">
                    {review.score}
                    <span className="font-normal text-slate-500">/100</span>
                  </span>
                  <RecommendationBadge recommendation={review.recommendation} />
                  <span className="text-xs text-slate-500">{formatDate(review.createdAt)}</span>
                </div>
                <p className="mt-1.5 text-sm text-slate-700">{review.comment}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </article>
  );
}

function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-surface-200 bg-white p-4 shadow-card sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {badge && (
          <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
            {badge}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}
