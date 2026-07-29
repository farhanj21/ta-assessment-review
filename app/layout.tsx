import type { Metadata } from 'next';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import './globals.css';

export const metadata: Metadata = {
  title: 'Assessment Review',
  description: 'Review candidates and their assessment submissions.',
};

/**
 * Root layout — a Server Component.
 *
 * It reads the session directly, which is the point of the App Router model:
 * the current user is resolved on the server during render, so there is no
 * auth flash, no client-side session fetch, and no window where the header
 * shows the wrong user.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <html lang="en">
      <body className="min-h-dvh">
        {/* First focusable element in the DOM — see .skip-link in globals.css. */}
        <a href="#results" className="skip-link">
          Skip to results
        </a>

        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link
              href="/candidates"
              className="rounded text-base font-semibold tracking-tight text-slate-900"
            >
              Assessment Review
            </Link>

            <div className="flex items-center gap-3 text-sm">
              <span className="hidden text-slate-600 sm:inline">{session.name}</span>
              {/*
                The active role is surfaced in the header because it changes what
                the UI allows (VIEWER cannot review, only ADMIN sees internal
                notes). Hiding it would make the authorization states look like
                bugs. Change DEMO_USER_ROLE in .env to switch.
              */}
              <span
                className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs
                           font-medium uppercase tracking-wide text-slate-700"
              >
                <span className="sr-only">Signed in as </span>
                {session.role}
              </span>
            </div>
          </div>
        </header>

        {children}
      </body>
    </html>
  );
}
