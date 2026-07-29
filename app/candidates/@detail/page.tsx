import NoCandidateSelected from './default';

/**
 * The detail slot at /candidates itself. Identical to default.tsx — declaring
 * both means the placeholder renders on a direct visit to /candidates as well
 * as on a slot fallback, rather than depending on which of the two Next picks.
 */
export default function DetailSlotPage() {
  return <NoCandidateSelected />;
}
