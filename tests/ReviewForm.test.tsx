// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReviewFormState } from '@/app/candidates/actions';

/**
 * The review form: optimistic update and the unauthorized state.
 *
 * The Server Action is mocked here on purpose — what it does with the database
 * is already covered against a real one in saveReview.test.ts. What this file
 * tests is the half that lives in the browser: that the reviewer sees their
 * verdict immediately, that a failed write rolls back on its own, and that a
 * read-only user is shown a form-shaped explanation rather than a form.
 */

/** Lets a test hold the action open and assert what the UI shows mid-flight. */
let resolveAction: (state: ReviewFormState) => void;
let actionPromise: Promise<ReviewFormState>;

const saveReview = vi.fn((_state: ReviewFormState, _formData: FormData) => actionPromise);

vi.mock('@/app/candidates/actions', () => ({
  saveReview: (state: ReviewFormState, formData: FormData) => saveReview(state, formData),
  initialReviewFormState: { status: 'idle' } as ReviewFormState,
}));

const { ReviewForm } = await import('@/components/detail/ReviewForm');

/**
 * The optimistic summary strip. Scoped by its accessible name because the
 * recommendation labels ("Strong yes") also appear as <option>s in the select.
 */
const verdict = () => within(screen.getByRole('group', { name: 'Your current verdict' }));

const baseProps = {
  candidateId: 'cand_1',
  candidateName: 'Amara Okonkwo',
  myReview: null,
  canSubmit: true,
  reviewerName: 'Farhan Jafri',
  viewerRole: 'REVIEWER',
};

beforeEach(() => {
  vi.clearAllMocks();
  actionPromise = new Promise<ReviewFormState>((resolve) => {
    resolveAction = resolve;
  });
});

describe('ReviewForm', () => {
  it('shows the new score optimistically before the action resolves', async () => {
    const user = userEvent.setup();
    render(<ReviewForm {...baseProps} />);

    // Nothing to show before the first submit.
    expect(screen.queryByRole('group', { name: 'Your current verdict' })).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText('Score as a number'));
    await user.type(screen.getByLabelText('Score as a number'), '91');
    await user.selectOptions(screen.getByLabelText('Recommendation'), 'STRONG_YES');
    await user.type(
      screen.getByLabelText('Comment'),
      'Best written reasoning in the batch — the tradeoffs section is genuinely good.',
    );
    await user.click(screen.getByRole('button', { name: 'Submit review' }));

    // The action is still in flight (resolveAction has not been called), yet
    // the verdict is already on screen. This is the whole point of the
    // optimistic update — no spinner over a round trip plus a revalidation.
    await waitFor(() => {
      expect(verdict().getByText('91')).toBeInTheDocument();
    });
    expect(verdict().getByText('Strong yes')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Saving…');

    resolveAction({ status: 'success', message: 'Review saved.' });
    await waitFor(() => {
      expect(screen.getByText(/Review saved/)).toBeInTheDocument();
    });
  });

  it('rolls back the optimistic value when the write fails', async () => {
    const user = userEvent.setup();
    // An existing review, so there is a previous value to roll back *to*.
    render(
      <ReviewForm
        {...baseProps}
        myReview={{
          score: 40,
          recommendation: 'NO',
          comment: 'Did not hold up under concurrency.',
          updatedAt: '2026-07-01T00:00:00.000Z',
        }}
      />,
    );

    expect(verdict().getByText('40')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Score as a number'));
    await user.type(screen.getByLabelText('Score as a number'), '95');
    await user.click(screen.getByRole('button', { name: 'Update review' }));

    await waitFor(() => expect(verdict().getByText('95')).toBeInTheDocument());

    resolveAction({ status: 'error', message: 'Could not save your review.' });

    // React discards the optimistic value on settle and re-renders from the
    // server prop, which still says 40. There is no rollback branch in the
    // component — that is why useOptimistic is used instead of useState.
    await waitFor(() => {
      expect(verdict().getByText('40')).toBeInTheDocument();
    });
    expect(verdict().queryByText('95')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save your review.');
  });

  it('surfaces field errors returned by the action and keeps what was typed', async () => {
    const user = userEvent.setup();
    render(<ReviewForm {...baseProps} />);

    const comment = 'Too short';
    await user.type(screen.getByLabelText('Comment'), comment);
    await user.click(screen.getByRole('button', { name: 'Submit review' }));

    resolveAction({
      status: 'error',
      message: 'Please fix the highlighted fields.',
      fieldErrors: { comment: 'Add at least a sentence.' },
    });

    await waitFor(() => {
      expect(screen.getByText('Add at least a sentence.')).toBeInTheDocument();
    });

    const field = screen.getByLabelText('Comment');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    // The error is referenced by the input, so it is announced with the field
    // rather than being a visual-only red line.
    expect(field.getAttribute('aria-describedby')).toContain('comment-error');
    // A rejected submit must never eat the reviewer's writing.
    expect(field).toHaveValue(comment);
  });

  it('renders an explanation instead of a form for a read-only role', async () => {
    render(<ReviewForm {...baseProps} canSubmit={false} viewerRole="VIEWER" />);

    expect(screen.getByText('You cannot review this candidate')).toBeInTheDocument();
    // Not a disabled form: a disabled form implies "fill this in correctly and
    // it will work", which is the wrong message.
    expect(screen.queryByRole('button', { name: /review/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Comment')).not.toBeInTheDocument();
  });

  it('labels every field and offers a keyboard-accessible score input', () => {
    render(<ReviewForm {...baseProps} />);

    expect(screen.getByLabelText('Recommendation')).toBeInTheDocument();
    expect(screen.getByLabelText('Comment')).toBeInTheDocument();
    // The slider alone would be awkward for keyboard and screen-reader users,
    // so a paired number input exists and is labelled.
    expect(screen.getByLabelText('Score (0–100)')).toHaveAttribute('type', 'range');
    expect(screen.getByLabelText('Score as a number')).toHaveAttribute('type', 'number');
  });
});
