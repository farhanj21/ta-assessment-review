import { redirect } from 'next/navigation';

/**
 * There is one product surface, so `/` is not a landing page — it redirects.
 * Doing this server-side avoids rendering-then-bouncing and keeps `/candidates`
 * as the single canonical URL that filter links are built against.
 */
export default function Home() {
  redirect('/candidates');
}
