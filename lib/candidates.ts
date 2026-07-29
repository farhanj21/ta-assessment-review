import 'server-only';

import { cache } from 'react';
import { db } from './db';
import { canSeeInternalNotes, type Session } from './auth';
import {
  toPrismaOrderBy,
  toPrismaWhere,
  type CandidateFilters,
} from './filters';
import type {
  AssessmentStatusKey,
  RecommendationKey,
  RoleKey,
  StageKey,
} from './enums';

/**
 * The server/client data boundary.
 *
 * Everything the UI renders comes from this module, and every query here uses
 * an explicit `select` — never a bare `include` or a naked model. That is not
 * style: a Server Component's props are serialised into the RSC payload and
 * shipped to the browser, so any field on an object handed to a Client
 * Component is readable in devtools even if it is never rendered. The
 * allowlists below are the actual enforcement mechanism for
 * `Candidate.cvObjectKey`, `phone` and `internalNotes`.
 *
 * `import 'server-only'` makes importing this file from a Client Component a
 * build error, so the boundary cannot erode by accident.
 */

/** One page of the list. Pagination is deliberately out of scope — see README. */
export const LIST_PAGE_SIZE = 50;

export type CandidateListItem = {
  id: string;
  fullName: string;
  role: RoleKey;
  city: string;
  stage: StageKey;
  assessmentStatus: AssessmentStatusKey;
  score: number | null;
  appliedAt: string; // ISO — Dates cross the RSC boundary fine, but strings
  // keep this type structurally identical in tests and in
  // Client Components, where a Date would need re-parsing.
  reviewCount: number;
};

export type CandidateListResult = {
  items: CandidateListItem[];
  total: number;
  truncated: boolean;
};

/**
 * The list query.
 *
 * One round trip, no N+1: `_count` is a correlated subquery Prisma folds into
 * the same statement, so rendering 50 rows with their review counts costs one
 * query rather than 1 + 50. The `where`/`orderBy` are built from indexed
 * Candidate columns only (see schema.prisma), so this is an index scan.
 *
 * Wrapped in `cache()` because the list renders in the `@list` slot for both
 * `/candidates` and `/candidates/[id]`; without it, selecting a candidate would
 * re-run the query for the same request.
 */
export const listCandidates = cache(
  async (filters: CandidateFilters): Promise<CandidateListResult> => {
    const where = toPrismaWhere(filters);

    const [rows, total] = await Promise.all([
      db.candidate.findMany({
        where,
        orderBy: toPrismaOrderBy(filters),
        take: LIST_PAGE_SIZE,
        select: {
          id: true,
          fullName: true,
          role: true,
          city: true,
          stage: true,
          assessmentStatus: true,
          score: true,
          appliedAt: true,
          _count: { select: { reviews: true } },
          // cvObjectKey / phone / internalNotes are absent on purpose.
        },
      }),
      db.candidate.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        fullName: row.fullName,
        role: row.role as RoleKey,
        city: row.city,
        stage: row.stage as StageKey,
        assessmentStatus: row.assessmentStatus as AssessmentStatusKey,
        score: row.score,
        appliedAt: row.appliedAt.toISOString(),
        reviewCount: row._count.reviews,
      })),
      total,
      truncated: total > rows.length,
    };
  },
);

export type CandidateDetail = {
  id: string;
  fullName: string;
  email: string;
  city: string;
  role: RoleKey;
  stage: StageKey;
  assessmentStatus: AssessmentStatusKey;
  score: number | null;
  appliedAt: string;

  /** Route to the server-gated CV redirect. Never the storage key or a raw URL. */
  cvHref: string;
  cvFileName: string;

  /** Present only for ADMIN. `undefined` for everyone else — not null, not ''. */
  internalNotes?: string | null;
  phone?: string | null;

  screeningAnswers: { id: string; question: string; answer: string }[];

  assessment: {
    title: string;
    brief: string;
    durationMinutes: number;
  } | null;

  submission: {
    workUrl: string;
    submittedAt: string;
    timeTakenMinutes: number;
    /** True when the candidate ran materially over the brief's time budget. */
    overTime: boolean;
  } | null;

  reviews: {
    id: string;
    reviewerId: string;
    reviewerName: string;
    score: number;
    recommendation: RecommendationKey;
    comment: string;
    createdAt: string;
    updatedAt: string;
  }[];
};

/**
 * The detail query.
 *
 * Two round trips, both indexed, and never more regardless of how much the
 * candidate has:
 *
 *   1. The candidate with screening answers, submission (+ its assessment) and
 *      reviews fetched as nested `select`s — Prisma issues these as batched
 *      relation loads in one call, so this does not degrade into 1 + N as the
 *      review count grows.
 *   2. The role's assessment brief, *only* when the candidate has not submitted
 *      yet. A brief with no submission has nothing to hang off in query 1, and
 *      reviewers still need to see what was asked. Skipped entirely otherwise.
 *
 * `session` is a required argument rather than something this function fetches
 * itself, so it is impossible to call the privileged path without having
 * resolved a session first.
 */
export const getCandidateDetail = cache(
  async (id: string, session: Session): Promise<CandidateDetail | null> => {
    const showInternal = canSeeInternalNotes(session);

    const candidate = await db.candidate.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        city: true,
        role: true,
        stage: true,
        assessmentStatus: true,
        score: true,
        appliedAt: true,
        cvFileName: true,
        // Prisma's `select` takes booleans, so role-conditional fields are
        // toggled here — the column is not read from the DB at all for a
        // non-admin, rather than read and then filtered out in JS.
        phone: showInternal,
        internalNotes: showInternal,
        screeningAnswers: {
          orderBy: { position: 'asc' },
          select: { id: true, question: true, answer: true },
        },
        submissions: {
          orderBy: { submittedAt: 'desc' },
          take: 1,
          select: {
            workUrl: true,
            submittedAt: true,
            timeTakenMinutes: true,
            assessment: {
              select: { title: true, brief: true, durationMinutes: true },
            },
          },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            reviewerId: true,
            reviewerName: true,
            score: true,
            recommendation: true,
            comment: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!candidate) return null;

    const submission = candidate.submissions[0] ?? null;

    // Query 2 — only when there is no submission to carry the brief.
    const fallbackAssessment = submission
      ? null
      : await db.assessment.findFirst({
          where: { role: candidate.role },
          select: { title: true, brief: true, durationMinutes: true },
        });

    const assessment = submission?.assessment ?? fallbackAssessment;

    return {
      id: candidate.id,
      fullName: candidate.fullName,
      email: candidate.email,
      city: candidate.city,
      role: candidate.role as RoleKey,
      stage: candidate.stage as StageKey,
      assessmentStatus: candidate.assessmentStatus as AssessmentStatusKey,
      score: candidate.score,
      appliedAt: candidate.appliedAt.toISOString(),

      // The client gets a route it can link to, not a location it can fetch.
      cvHref: `/api/cv/${candidate.id}`,
      cvFileName: candidate.cvFileName,

      ...(showInternal
        ? { internalNotes: candidate.internalNotes, phone: candidate.phone }
        : {}),

      screeningAnswers: candidate.screeningAnswers,
      assessment,
      submission: submission
        ? {
            workUrl: submission.workUrl,
            submittedAt: submission.submittedAt.toISOString(),
            timeTakenMinutes: submission.timeTakenMinutes,
            // 20% grace before we call it an over-run; a hard `>` would flag
            // everyone who took 121 minutes on a 120-minute brief.
            overTime:
              !!submission.assessment &&
              submission.timeTakenMinutes > submission.assessment.durationMinutes * 1.2,
          }
        : null,
      reviews: candidate.reviews.map((review) => ({
        ...review,
        recommendation: review.recommendation as RecommendationKey,
        createdAt: review.createdAt.toISOString(),
        updatedAt: review.updatedAt.toISOString(),
      })),
    };
  },
);

/** Distinct cities actually present in the data, for the city filter options. */
export const listCities = cache(async (): Promise<string[]> => {
  const rows = await db.candidate.findMany({
    distinct: ['city'],
    orderBy: { city: 'asc' },
    select: { city: true },
  });
  return rows.map((row) => row.city);
});
