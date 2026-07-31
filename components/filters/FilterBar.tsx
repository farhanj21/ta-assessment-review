'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import {
  ASSESSMENT_STATUSES,
  ASSESSMENT_STATUS_LABELS,
  ROLES,
  ROLE_LABELS,
  STAGES,
  STAGE_LABELS,
} from '@/lib/enums';
import {
  SORT_LABELS,
  SORT_OPTIONS,
  activeFilterCount,
  buildQueryString,
  type CandidateFilters,
} from '@/lib/filters';

/**
 * The filter bar — a Client Component, and one of only three in the app.
 *
 * It is a Client Component for exactly one reason: it needs event handlers and
 * `useTransition` to show a pending state during navigation. It does *no* data
 * fetching and holds no filter state of its own. The URL is the state; this
 * component only writes to it, and the server reads it back. That is what makes
 * a filtered view shareable, correct under back/forward, and re-runnable on the
 * server with no hydration mismatch.
 *
 * It is wrapped in a real <form> so the whole thing still works with JavaScript
 * disabled or not yet loaded: the browser will GET `/candidates?...` with the
 * same param names the server already parses.
 */
export function FilterBar({
  filters,
  cities,
}: {
  filters: CandidateFilters;
  cities: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const id = useId();

  /*
   * The search box is the one control with local state, because a controlled
   * input driven straight off the URL would lose characters while the server
   * round-trips. It is re-synced below whenever the URL changes underneath us
   * (back button, "Clear all"), so the two never drift.
   */
  const [query, setQuery] = useState(filters.q ?? '');
  useEffect(() => setQuery(filters.q ?? ''), [filters.q]);

  function applyPatch(patch: Record<string, string | number | null>) {
    const queryString = buildQueryString(searchParams, patch);
    startTransition(() => {
      // `push`, not `replace`: each filter change should be its own history
      // entry so the back button steps back through the user's narrowing.
      router.push(queryString ? `/candidates?${queryString}` : '/candidates');
    });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    applyPatch({
      q: (data.get('q') as string)?.trim() || null,
      role: (data.get('role') as string) || null,
      city: (data.get('city') as string) || null,
      stage: (data.get('stage') as string) || null,
      status: (data.get('status') as string) || null,
      scoreMin: (data.get('scoreMin') as string) || null,
      scoreMax: (data.get('scoreMax') as string) || null,
      sort: (data.get('sort') as string) || null,
    });
  }

  // Selects apply immediately — a dropdown that needs a second click to take
  // effect feels broken. Free-text and number inputs wait for submit, because
  // applying mid-typing would fire a query per keystroke.
  const submitNow = () => formRef.current?.requestSubmit();

  const count = activeFilterCount(filters);

  const selectClass =
    'w-full rounded-lg border border-surface-200 bg-white px-2.5 py-2 text-sm text-slate-900 ' +
    'shadow-card hover:border-brand-300 transition-colors';
  const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-slate-500';

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      method="get"
      action="/candidates"
      // aria-busy tells assistive tech the region is updating during the
      // transition, matching the visual pending treatment below.
      aria-busy={isPending}
      className="rounded-2xl border border-surface-200 bg-white p-3 shadow-card sm:p-4"
    >
      {/*
        A fieldset+legend groups the controls so a screen reader announces
        "Filter candidates" as context before each individual label.
      */}
      <fieldset className="space-y-3">
        <legend className="sr-only">Filter candidates</legend>

        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            Filters
            {count > 0 && (
              <span className="ml-2 rounded-full bg-accent-100 px-2 py-0.5 text-xs font-semibold text-accent-800">
                {count} active
              </span>
            )}
          </h2>

          {count > 0 && (
            <button
              type="button"
              onClick={() =>
                applyPatch({
                  q: null,
                  role: null,
                  city: null,
                  stage: null,
                  status: null,
                  scoreMin: null,
                  scoreMax: null,
                })
              }
              className="rounded text-xs font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-500 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        <div>
          <label htmlFor={`${id}-q`} className={labelClass}>
            Search by name
          </label>
          <input
            id={`${id}-q`}
            name="q"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. Amara"
            className="mt-1 w-full rounded-lg border border-surface-200 px-2.5 py-2 text-sm shadow-card placeholder:text-slate-400 hover:border-brand-300 transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${id}-role`} className={labelClass}>
              Role
            </label>
            <select
              id={`${id}-role`}
              name="role"
              defaultValue={filters.role ?? ''}
              onChange={submitNow}
              className={`mt-1 ${selectClass}`}
            >
              <option value="">All roles</option>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${id}-city`} className={labelClass}>
              City
            </label>
            <select
              id={`${id}-city`}
              name="city"
              defaultValue={filters.city ?? ''}
              onChange={submitNow}
              className={`mt-1 ${selectClass}`}
            >
              <option value="">All cities</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${id}-stage`} className={labelClass}>
              Stage
            </label>
            <select
              id={`${id}-stage`}
              name="stage"
              defaultValue={filters.stage ?? ''}
              onChange={submitNow}
              className={`mt-1 ${selectClass}`}
            >
              <option value="">All stages</option>
              {STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {STAGE_LABELS[stage]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${id}-status`} className={labelClass}>
              Assessment status
            </label>
            <select
              id={`${id}-status`}
              name="status"
              defaultValue={filters.status ?? ''}
              onChange={submitNow}
              className={`mt-1 ${selectClass}`}
            >
              <option value="">Any status</option>
              {ASSESSMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {ASSESSMENT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/*
          The score range is its own nested fieldset: "Minimum"/"Maximum" are
          only meaningful under the heading "Score range", and this is how that
          relationship is exposed to assistive tech.
        */}
        <fieldset>
          <legend className={labelClass}>Score range (0–100)</legend>
          <div className="mt-1 flex items-center gap-2">
            <label htmlFor={`${id}-min`} className="sr-only">
              Minimum score
            </label>
            <input
              id={`${id}-min`}
              name="scoreMin"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              defaultValue={filters.scoreMin ?? ''}
              placeholder="Min"
              className="w-full rounded-lg border border-surface-200 px-2.5 py-2 text-sm shadow-card placeholder:text-slate-400 hover:border-brand-300 transition-colors"
            />
            <span aria-hidden="true" className="text-slate-400">
              –
            </span>
            <label htmlFor={`${id}-max`} className="sr-only">
              Maximum score
            </label>
            <input
              id={`${id}-max`}
              name="scoreMax"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              defaultValue={filters.scoreMax ?? ''}
              placeholder="Max"
              className="w-full rounded-lg border border-surface-200 px-2.5 py-2 text-sm shadow-card placeholder:text-slate-400 hover:border-brand-300 transition-colors"
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Candidates without a score are excluded when a range is set.
          </p>
        </fieldset>

        <div>
          <label htmlFor={`${id}-sort`} className={labelClass}>
            Sort by
          </label>
          <select
            id={`${id}-sort`}
            name="sort"
            defaultValue={filters.sort}
            onChange={submitNow}
            className={`mt-1 ${selectClass}`}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {SORT_LABELS[option]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-gradient-to-r from-brand-600 to-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-card
                       hover:from-brand-500 hover:to-brand-600 disabled:opacity-60 transition-all"
            disabled={isPending}
          >
            Apply filters
          </button>
          {isPending && (
            <span className="text-xs text-slate-600" role="status">
              Updating results…
            </span>
          )}
        </div>
      </fieldset>
    </form>
  );
}
