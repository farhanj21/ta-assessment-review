import type { Prisma } from '@prisma/client';
import {
  ASSESSMENT_STATUSES,
  ROLES,
  STAGES,
  type AssessmentStatusKey,
  type RoleKey,
  type StageKey,
} from './enums';

/**
 * Filter parsing and query building.
 *
 * This module is deliberately pure and free of React, Prisma runtime and Next
 * imports (the one Prisma import is a *type*). That is what makes the filter
 * behaviour cheap to unit-test without a database or a renderer — see
 * tests/filters.test.ts.
 *
 * The URL is the single source of truth for filter state. There is no
 * `useState` mirror of it anywhere: the filter form writes to the URL, the
 * server reads the URL. That is what makes filtered views shareable, correct
 * under back/forward, and re-runnable on the server without hydration.
 */

export const SORT_OPTIONS = ['score_desc', 'score_asc', 'applied_desc', 'name_asc'] as const;
export type SortKey = (typeof SORT_OPTIONS)[number];

export const SORT_LABELS: Record<SortKey, string> = {
  score_desc: 'Score (high to low)',
  score_asc: 'Score (low to high)',
  applied_desc: 'Newest applicants',
  name_asc: 'Name (A–Z)',
};

export const DEFAULT_SORT: SortKey = 'score_desc';

export const SCORE_MIN = 0;
export const SCORE_MAX = 100;

export type CandidateFilters = {
  q?: string;
  role?: RoleKey;
  city?: string;
  stage?: StageKey;
  status?: AssessmentStatusKey;
  scoreMin?: number;
  scoreMax?: number;
  sort: SortKey;
};

/**
 * Anything that behaves like a read-only search-params bag: Next's
 * `searchParams` object, a real `URLSearchParams`, or a plain object in a test.
 */
export type SearchParamsInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

function readParam(input: SearchParamsInput, key: string): string | undefined {
  const raw = input instanceof URLSearchParams ? input.get(key) : input[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readEnum<T extends string>(
  input: SearchParamsInput,
  key: string,
  allowed: readonly T[],
): T | undefined {
  const value = readParam(input, key);
  // Unknown values are dropped rather than thrown on: a stale or hand-edited
  // URL should degrade to "no filter", not to an error page.
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

function readScore(input: SearchParamsInput, key: string): number | undefined {
  const value = readParam(input, key);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, Math.round(parsed)));
}

/**
 * URL → typed filters. Total: every input produces a valid filter object, so
 * callers never have to handle a parse failure.
 */
export function parseFilters(input: SearchParamsInput): CandidateFilters {
  let scoreMin = readScore(input, 'scoreMin');
  let scoreMax = readScore(input, 'scoreMax');

  // An inverted range is a user slip (typing 80 into "min" before fixing
  // "max"), not an error. Swapping beats returning zero rows with no
  // explanation.
  if (scoreMin !== undefined && scoreMax !== undefined && scoreMin > scoreMax) {
    [scoreMin, scoreMax] = [scoreMax, scoreMin];
  }

  const sort = readEnum(input, 'sort', SORT_OPTIONS) ?? DEFAULT_SORT;

  return {
    q: readParam(input, 'q'),
    role: readEnum(input, 'role', ROLES),
    city: readParam(input, 'city'),
    stage: readEnum(input, 'stage', STAGES),
    status: readEnum(input, 'status', ASSESSMENT_STATUSES),
    scoreMin,
    scoreMax,
    sort,
  };
}

/** True when no narrowing filter is active (sort alone doesn't count). */
export function hasActiveFilters(filters: CandidateFilters): boolean {
  return Boolean(
    filters.q ||
      filters.role ||
      filters.city ||
      filters.stage ||
      filters.status ||
      filters.scoreMin !== undefined ||
      filters.scoreMax !== undefined,
  );
}

export function activeFilterCount(filters: CandidateFilters): number {
  const scoreActive = filters.scoreMin !== undefined || filters.scoreMax !== undefined;
  return (
    (filters.q ? 1 : 0) +
    (filters.role ? 1 : 0) +
    (filters.city ? 1 : 0) +
    (filters.stage ? 1 : 0) +
    (filters.status ? 1 : 0) +
    (scoreActive ? 1 : 0)
  );
}

/**
 * Filters → Prisma `where`.
 *
 * Every clause here is an indexed column on Candidate (see the index comments
 * in schema.prisma). Nothing filters through a relation, which is the reason
 * `stage`, `score` and `assessmentStatus` live on Candidate at all.
 */
export function toPrismaWhere(filters: CandidateFilters): Prisma.CandidateWhereInput {
  const where: Prisma.CandidateWhereInput = {};

  if (filters.role) where.role = filters.role;
  if (filters.city) where.city = filters.city;
  if (filters.stage) where.stage = filters.stage;
  if (filters.status) where.assessmentStatus = filters.status;

  if (filters.scoreMin !== undefined || filters.scoreMax !== undefined) {
    where.score = {
      ...(filters.scoreMin !== undefined ? { gte: filters.scoreMin } : {}),
      ...(filters.scoreMax !== undefined ? { lte: filters.scoreMax } : {}),
    };
  }

  if (filters.q) {
    // Name only. Email is searchable server-side in principle, but it is a
    // contact detail we don't surface in the list, so we don't let it be
    // probed through the URL either.
    where.fullName = { contains: filters.q };
  }

  return where;
}

/**
 * Filters → Prisma `orderBy`.
 *
 * `nulls: 'last'` matters: candidates with no score yet (assessment not sent or
 * still in progress) must not occupy the top of a "highest score first" list.
 * The secondary key keeps pagination stable when scores tie.
 */
export function toPrismaOrderBy(
  filters: CandidateFilters,
): Prisma.CandidateOrderByWithRelationInput[] {
  switch (filters.sort) {
    case 'score_asc':
      return [{ score: { sort: 'asc', nulls: 'last' } }, { appliedAt: 'desc' }];
    case 'applied_desc':
      return [{ appliedAt: 'desc' }];
    case 'name_asc':
      return [{ fullName: 'asc' }];
    case 'score_desc':
    default:
      return [{ score: { sort: 'desc', nulls: 'last' } }, { appliedAt: 'desc' }];
  }
}

/**
 * Build the next URL query string from the current one plus a patch.
 *
 * Used by the filter form and by every candidate link, so that selecting a
 * candidate preserves the active filters and the back button returns to the
 * exact filtered view. `null` clears a param; empty strings are treated as
 * cleared so a reset select doesn't leave `?role=` in the URL.
 */
export function buildQueryString(
  current: SearchParamsInput,
  patch: Record<string, string | number | null | undefined>,
): string {
  const next =
    current instanceof URLSearchParams
      ? new URLSearchParams(current)
      : new URLSearchParams(
          Object.entries(current).flatMap(([key, value]) => {
            const single = Array.isArray(value) ? value[0] : value;
            return single ? [[key, single] as [string, string]] : [];
          }),
        );

  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined || value === '') next.delete(key);
    else next.set(key, String(value));
  }

  next.sort(); // stable ordering → identical filter sets produce identical URLs
  return next.toString();
}
