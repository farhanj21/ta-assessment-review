// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { CandidateList } from '@/components/list/CandidateList';
import type { CandidateListItem, CandidateListResult } from '@/lib/candidates';

/**
 * Rendering test for the results list.
 *
 * CandidateList is a Server Component, but it is a synchronous function of its
 * props with no data fetching of its own — which is exactly what makes it
 * testable with plain React Testing Library. That is a design consequence
 * worth noting: fetching lives in lib/candidates.ts, so the component that
 * renders it stays trivially testable.
 */

function candidate(overrides: Partial<CandidateListItem> = {}): CandidateListItem {
  return {
    id: 'cand_1',
    fullName: 'Amara Okonkwo',
    role: 'FRONTEND_ENGINEER',
    city: 'Berlin',
    stage: 'ASSESSMENT',
    assessmentStatus: 'SUBMITTED',
    score: 82,
    appliedAt: '2026-06-01T00:00:00.000Z',
    reviewCount: 1,
    ...overrides,
  };
}

function result(items: CandidateListItem[], total = items.length): CandidateListResult {
  return { items, total, truncated: total > items.length };
}

describe('CandidateList', () => {
  it('renders a row per candidate as a link that preserves the active filters', () => {
    render(
      <CandidateList
        result={result([candidate(), candidate({ id: 'cand_2', fullName: 'Bilal Haddad' })])}
        queryString="role=FRONTEND_ENGINEER&scoreMin=50"
      />,
    );

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);

    // Carrying the query string is what makes the back button return to the
    // filtered list rather than an unfiltered one.
    expect(screen.getByRole('link', { name: /Amara Okonkwo/ })).toHaveAttribute(
      'href',
      '/candidates/cand_1?role=FRONTEND_ENGINEER&scoreMin=50',
    );
  });

  it('marks the selected candidate with aria-current', () => {
    // The blue ring means nothing to a screen reader; aria-current is what
    // actually communicates "this is the one you have open".
    render(
      <CandidateList
        result={result([candidate(), candidate({ id: 'cand_2', fullName: 'Bilal Haddad' })])}
        selectedId="cand_2"
        queryString=""
      />,
    );

    expect(screen.getByRole('link', { name: /Bilal Haddad/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('link', { name: /Amara Okonkwo/ })).not.toHaveAttribute('aria-current');
  });

  it('shows an actionable empty state rather than a bare "no results"', () => {
    render(<CandidateList result={result([], 0)} queryString="scoreMin=99" />);

    expect(screen.getByText('No candidates match these filters')).toBeInTheDocument();
    // The escape hatch matters more than the message.
    expect(screen.getByRole('link', { name: 'Clear all filters' })).toHaveAttribute(
      'href',
      '/candidates',
    );
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('distinguishes "no score yet" from a score of zero', () => {
    // A candidate whose assessment was never sent has a null score. Rendering
    // that as 0 would make them look like the worst applicant in the pipeline.
    const { rerender } = render(
      <CandidateList result={result([candidate({ score: null })])} queryString="" />,
    );
    expect(screen.getByText('No score yet')).toBeInTheDocument();

    rerender(<CandidateList result={result([candidate({ score: 0 })])} queryString="" />);
    expect(screen.queryByText('No score yet')).not.toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('announces the result count in a live region', () => {
    // Without this a screen-reader user changes a filter and gets no signal
    // that the list underneath them changed.
    render(<CandidateList result={result([candidate()], 7)} queryString="" />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('7 candidates');
  });

  it('says when the list is truncated instead of silently hiding rows', () => {
    render(<CandidateList result={result([candidate()], 250)} queryString="" />);

    expect(within(screen.getByRole('status')).getByText(/showing first 1/)).toBeInTheDocument();
    expect(screen.getByText(/Showing the first 1 of 250/)).toBeInTheDocument();
  });

  it('labels a candidate with no reviews', () => {
    render(<CandidateList result={result([candidate({ reviewCount: 0 })])} queryString="" />);
    expect(screen.getByText('Not reviewed')).toBeInTheDocument();
  });
});
