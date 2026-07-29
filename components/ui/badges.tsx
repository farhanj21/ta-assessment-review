import {
  ASSESSMENT_STATUS_LABELS,
  RECOMMENDATION_LABELS,
  STAGE_LABELS,
  type AssessmentStatusKey,
  type RecommendationKey,
  type StageKey,
} from '@/lib/enums';

/**
 * Presentational badges. Server Components — they take plain props and have no
 * interactivity, so there is no reason to ship them to the browser.
 *
 * Accessibility note that drove the colour choices: status is never encoded in
 * colour alone. Every badge carries its label as text, so the palette is
 * decoration rather than information, and the app is fully usable in greyscale
 * or with any form of colour blindness. All combinations below are 4.5:1 or
 * better against their own background.
 */

const STAGE_STYLES: Record<StageKey, string> = {
  APPLIED: 'bg-slate-100 text-slate-700 border-slate-300',
  SCREENING: 'bg-slate-100 text-slate-700 border-slate-300',
  ASSESSMENT: 'bg-blue-50 text-blue-800 border-blue-300',
  INTERVIEW: 'bg-violet-50 text-violet-800 border-violet-300',
  OFFER: 'bg-amber-50 text-amber-900 border-amber-300',
  HIRED: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  REJECTED: 'bg-rose-50 text-rose-800 border-rose-300',
};

const STATUS_STYLES: Record<AssessmentStatusKey, string> = {
  NOT_SENT: 'bg-slate-100 text-slate-700 border-slate-300',
  INVITED: 'bg-sky-50 text-sky-800 border-sky-300',
  IN_PROGRESS: 'bg-indigo-50 text-indigo-800 border-indigo-300',
  SUBMITTED: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  EXPIRED: 'bg-orange-50 text-orange-900 border-orange-300',
};

const RECOMMENDATION_STYLES: Record<RecommendationKey, string> = {
  STRONG_YES: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  YES: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  NEUTRAL: 'bg-slate-100 text-slate-700 border-slate-300',
  NO: 'bg-rose-50 text-rose-800 border-rose-300',
  STRONG_NO: 'bg-rose-50 text-rose-800 border-rose-300',
};

const BASE =
  'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap';

export function StageBadge({ stage }: { stage: StageKey }) {
  return (
    <span className={`${BASE} ${STAGE_STYLES[stage]}`}>
      <span className="sr-only">Stage: </span>
      {STAGE_LABELS[stage]}
    </span>
  );
}

export function AssessmentStatusBadge({ status }: { status: AssessmentStatusKey }) {
  return (
    <span className={`${BASE} ${STATUS_STYLES[status]}`}>
      <span className="sr-only">Assessment: </span>
      {ASSESSMENT_STATUS_LABELS[status]}
    </span>
  );
}

export function RecommendationBadge({ recommendation }: { recommendation: RecommendationKey }) {
  return (
    <span className={`${BASE} ${RECOMMENDATION_STYLES[recommendation]}`}>
      {RECOMMENDATION_LABELS[recommendation]}
    </span>
  );
}

/**
 * Score pill. `score` is nullable throughout the data model — a candidate whose
 * assessment has not been sent has no score, which is different from a score of
 * zero — so the null case renders an explicit em dash with a screen-reader
 * explanation rather than "0".
 */
export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-sm font-medium text-slate-500">
        <span aria-hidden="true">—</span>
        <span className="sr-only">No score yet</span>
      </span>
    );
  }

  const tone =
    score >= 80
      ? 'bg-emerald-50 text-emerald-800'
      : score >= 60
        ? 'bg-blue-50 text-blue-800'
        : score >= 45
          ? 'bg-amber-50 text-amber-900'
          : 'bg-rose-50 text-rose-800';

  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums ${tone}`}>
      <span className="sr-only">Score: </span>
      {score}
      <span className="sr-only"> out of 100</span>
    </span>
  );
}
