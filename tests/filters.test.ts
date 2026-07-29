import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SORT,
  activeFilterCount,
  buildQueryString,
  hasActiveFilters,
  parseFilters,
  toPrismaOrderBy,
  toPrismaWhere,
} from '@/lib/filters';

/**
 * Filter logic.
 *
 * These run against the real module with no database and no renderer, which is
 * the payoff of keeping lib/filters.ts pure. The cases below are the ones that
 * actually bite in production: hostile URLs, and the translation from URL to
 * query.
 */
describe('parseFilters', () => {
  it('reads every filter from the URL', () => {
    const filters = parseFilters(
      new URLSearchParams(
        'q=Amara&role=BACKEND_ENGINEER&city=Berlin&stage=INTERVIEW&status=SUBMITTED&scoreMin=40&scoreMax=90&sort=name_asc',
      ),
    );

    expect(filters).toEqual({
      q: 'Amara',
      role: 'BACKEND_ENGINEER',
      city: 'Berlin',
      stage: 'INTERVIEW',
      status: 'SUBMITTED',
      scoreMin: 40,
      scoreMax: 90,
      sort: 'name_asc',
    });
  });

  it('drops unknown enum values instead of throwing', () => {
    // A hand-edited or stale URL must degrade to "no filter", never to an
    // error page — this is the guarantee the list page relies on.
    const filters = parseFilters({
      role: 'CHIEF_VIBES_OFFICER',
      stage: 'ABDUCTED',
      status: 'NOPE',
      sort: 'by_vibes',
    });

    expect(filters.role).toBeUndefined();
    expect(filters.stage).toBeUndefined();
    expect(filters.status).toBeUndefined();
    expect(filters.sort).toBe(DEFAULT_SORT);
  });

  it('swaps an inverted score range rather than returning nothing', () => {
    // Typing 80 into "min" before fixing "max" is a slip, not a query for zero
    // rows. Silently returning an empty list would look like a bug.
    const filters = parseFilters({ scoreMin: '80', scoreMax: '20' });
    expect(filters.scoreMin).toBe(20);
    expect(filters.scoreMax).toBe(80);
  });

  it('clamps out-of-range scores and ignores non-numeric ones', () => {
    expect(parseFilters({ scoreMin: '-50', scoreMax: '9999' })).toMatchObject({
      scoreMin: 0,
      scoreMax: 100,
    });
    expect(parseFilters({ scoreMin: 'abc' }).scoreMin).toBeUndefined();
  });

  it('treats blank and whitespace-only params as absent', () => {
    const filters = parseFilters({ q: '   ', role: '', city: undefined });
    expect(filters.q).toBeUndefined();
    expect(filters.role).toBeUndefined();
    expect(hasActiveFilters(filters)).toBe(false);
  });

  it('takes the first value when a param is repeated', () => {
    // ?role=A&role=B is legal in a URL; the parser must not hand an array to
    // Prisma, where it would silently mean something else.
    expect(parseFilters({ role: ['FRONTEND_ENGINEER', 'BACKEND_ENGINEER'] }).role).toBe(
      'FRONTEND_ENGINEER',
    );
  });

  it('does not count sort as an active filter', () => {
    // Sorting narrows nothing, so it must not light up "1 active" or the
    // "Clear all" affordance.
    const filters = parseFilters({ sort: 'name_asc' });
    expect(hasActiveFilters(filters)).toBe(false);
    expect(activeFilterCount(filters)).toBe(0);
  });

  it('counts a score range as one filter, not two', () => {
    expect(activeFilterCount(parseFilters({ scoreMin: '10', scoreMax: '90' }))).toBe(1);
    expect(activeFilterCount(parseFilters({ role: 'QA_ENGINEER', scoreMin: '10' }))).toBe(2);
  });
});

describe('toPrismaWhere', () => {
  it('builds an equality clause per facet', () => {
    const where = toPrismaWhere(
      parseFilters({ role: 'DATA_ANALYST', city: 'Lisbon', stage: 'OFFER', status: 'SUBMITTED' }),
    );

    expect(where).toEqual({
      role: 'DATA_ANALYST',
      city: 'Lisbon',
      stage: 'OFFER',
      // Note the column name differs from the URL param — this mapping is
      // exactly the kind of thing worth pinning down in a test.
      assessmentStatus: 'SUBMITTED',
    });
  });

  it('emits a bounded range only for the bounds that were given', () => {
    expect(toPrismaWhere(parseFilters({ scoreMin: '60' })).score).toEqual({ gte: 60 });
    expect(toPrismaWhere(parseFilters({ scoreMax: '60' })).score).toEqual({ lte: 60 });
    expect(toPrismaWhere(parseFilters({ scoreMin: '10', scoreMax: '60' })).score).toEqual({
      gte: 10,
      lte: 60,
    });
  });

  it('produces an empty where clause when nothing is filtered', () => {
    expect(toPrismaWhere(parseFilters({}))).toEqual({});
  });

  it('searches names but never emails', () => {
    // Email is a contact detail we do not surface in the list, so it must not
    // be probeable through the URL either.
    const where = toPrismaWhere(parseFilters({ q: 'okonkwo' }));
    expect(where.fullName).toEqual({ contains: 'okonkwo' });
    expect(where.email).toBeUndefined();
  });
});

describe('toPrismaOrderBy', () => {
  it('sorts unscored candidates last in both score directions', () => {
    // A candidate whose assessment was never sent has a null score. They must
    // not sit at the top of "highest score first" — nor at the top of "lowest
    // score first", where SQL would otherwise put them.
    expect(toPrismaOrderBy(parseFilters({ sort: 'score_desc' }))[0]).toEqual({
      score: { sort: 'desc', nulls: 'last' },
    });
    expect(toPrismaOrderBy(parseFilters({ sort: 'score_asc' }))[0]).toEqual({
      score: { sort: 'asc', nulls: 'last' },
    });
  });

  it('adds a tiebreaker to score sorts so ordering is stable', () => {
    expect(toPrismaOrderBy(parseFilters({ sort: 'score_desc' }))).toHaveLength(2);
  });
});

describe('buildQueryString', () => {
  it('merges a patch over the current params', () => {
    const result = buildQueryString(new URLSearchParams('role=QA_ENGINEER&city=Paris'), {
      city: 'Dublin',
    });
    expect(new URLSearchParams(result).get('role')).toBe('QA_ENGINEER');
    expect(new URLSearchParams(result).get('city')).toBe('Dublin');
  });

  it('removes params cleared to null or an empty string', () => {
    // A reset <select> submits '', which must clear the param rather than
    // leave `?role=` behind.
    const result = buildQueryString(new URLSearchParams('role=QA_ENGINEER&city=Paris&q=amara'), {
      role: null,
      city: '',
    });
    expect(result).toBe('q=amara');
  });

  it('is order-independent, so equivalent filters share a URL', () => {
    // Stable ordering means the same filter set produces the same string, which
    // is what makes these URLs comparable and cacheable.
    expect(buildQueryString({ city: 'Berlin', role: 'QA_ENGINEER' }, {})).toBe(
      buildQueryString({ role: 'QA_ENGINEER', city: 'Berlin' }, {}),
    );
  });

  it('returns an empty string when everything is cleared', () => {
    // The list page relies on this to link to a bare /candidates.
    expect(buildQueryString({ role: 'QA_ENGINEER' }, { role: null })).toBe('');
  });
});
