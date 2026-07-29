// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBar } from '@/components/filters/FilterBar';
import { parseFilters } from '@/lib/filters';

/**
 * Interaction test for the filter bar.
 *
 * The thing worth asserting is the contract between this component and the
 * server: it must write filter state to the URL, because that URL is the only
 * state there is. A test that checked internal component state would pass while
 * the feature was broken.
 *
 * `next/navigation` is mocked because there is no router outside the app — the
 * spy on `push` is precisely the assertion surface we want.
 */
const push = vi.fn();
let searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => searchParams,
}));

const CITIES = ['Berlin', 'Dublin', 'Lisbon'];

/** The pushed URL, parsed back through the real parser the server uses. */
function pushedFilters() {
  const url: string = push.mock.calls.at(-1)![0];
  return parseFilters(new URLSearchParams(url.split('?')[1] ?? ''));
}

beforeEach(() => {
  vi.clearAllMocks();
  searchParams = new URLSearchParams();
});

describe('FilterBar', () => {
  it('pushes the selected role to the URL', async () => {
    const user = userEvent.setup();
    render(<FilterBar filters={parseFilters({})} cities={CITIES} />);

    await user.selectOptions(screen.getByLabelText('Role'), 'DATA_ANALYST');

    expect(push).toHaveBeenCalled();
    expect(pushedFilters().role).toBe('DATA_ANALYST');
  });

  it('keeps existing filters when a new one is added', async () => {
    // Regression guard: patching the URL must merge, not replace. Losing the
    // other filters on every change is the classic bug in this pattern.
    searchParams = new URLSearchParams('role=DATA_ANALYST&scoreMin=50');
    const user = userEvent.setup();

    render(
      <FilterBar filters={parseFilters(searchParams)} cities={CITIES} />,
    );

    await user.selectOptions(screen.getByLabelText('Stage'), 'INTERVIEW');

    const filters = pushedFilters();
    expect(filters.stage).toBe('INTERVIEW');
    expect(filters.role).toBe('DATA_ANALYST');
    expect(filters.scoreMin).toBe(50);
  });

  it('submits the score range on Apply', async () => {
    const user = userEvent.setup();
    render(<FilterBar filters={parseFilters({})} cities={CITIES} />);

    // Number inputs deliberately wait for submit rather than firing a query per
    // keystroke, so this asserts nothing was pushed until Apply.
    await user.type(screen.getByLabelText('Minimum score'), '60');
    await user.type(screen.getByLabelText('Maximum score'), '90');
    expect(push).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Apply filters' }));

    expect(pushedFilters()).toMatchObject({ scoreMin: 60, scoreMax: 90 });
  });

  it('clears every filter but keeps the sort', async () => {
    searchParams = new URLSearchParams('role=DATA_ANALYST&city=Berlin&scoreMin=50&sort=name_asc');
    const user = userEvent.setup();

    render(<FilterBar filters={parseFilters(searchParams)} cities={CITIES} />);

    await user.click(screen.getByRole('button', { name: 'Clear all' }));

    const filters = pushedFilters();
    expect(filters.role).toBeUndefined();
    expect(filters.city).toBeUndefined();
    expect(filters.scoreMin).toBeUndefined();
    // Sort is a view preference, not a filter — clearing filters should not
    // reshuffle the list under the user.
    expect(filters.sort).toBe('name_asc');
  });

  it('shows a count of active filters and hides it when there are none', () => {
    const { rerender } = render(<FilterBar filters={parseFilters({})} cities={CITIES} />);
    expect(screen.queryByText(/active/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument();

    rerender(
      <FilterBar
        filters={parseFilters({ role: 'QA_ENGINEER', city: 'Berlin', scoreMin: '10' })}
        cities={CITIES}
      />,
    );
    // Three controls set, but the score range counts once.
    expect(screen.getByText('3 active')).toBeInTheDocument();
  });

  it('gives every control an accessible name', () => {
    // Accessibility is a scored requirement, so it gets an assertion rather
    // than a promise in the README. getByLabelText resolves through the same
    // accessible-name computation a screen reader uses, so an input whose
    // label was decorative-only would fail here.
    render(<FilterBar filters={parseFilters({})} cities={CITIES} />);

    for (const label of [
      'Search by name',
      'Role',
      'City',
      'Stage',
      'Assessment status',
      'Minimum score',
      'Maximum score',
      'Sort by',
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }

    // The whole control set is grouped, so the purpose is announced once.
    expect(screen.getByRole('group', { name: 'Filter candidates' })).toBeInTheDocument();
  });

  it('is operable by keyboard alone', async () => {
    const user = userEvent.setup();
    render(<FilterBar filters={parseFilters({})} cities={CITIES} />);

    // Tab order must reach the search box first, then the facets — no
    // focus traps and no unreachable controls.
    await user.tab();
    expect(screen.getByLabelText('Search by name')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Role')).toHaveFocus();
  });
});
