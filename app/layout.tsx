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

        <header className="sticky top-0 z-40 border-b border-brand-700/10 bg-brand-950 shadow-header">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link
              href="/candidates"
              className="group flex items-center gap-2.5 rounded text-base font-semibold tracking-tight text-white"
            >
              {/* Brand icon — a stylized HR shield */}
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-sm font-bold text-white shadow-sm transition-shadow group-hover:shadow-md">
                HR
              </span>
              <span className="hidden sm:inline">Assessment Review</span>
            </Link>

            <div className="flex items-center gap-3 text-sm">
              <span className="hidden text-brand-200 sm:inline">{session.name}</span>
              {/*
                The active role is surfaced in the header because it changes what
                the UI allows (VIEWER cannot review, only ADMIN sees internal
                notes). Hiding it would make the authorization states look like
                bugs. Change DEMO_USER_ROLE in .env to switch.
              */}
              <span
                className="rounded-full border border-brand-500/30 bg-brand-800/50 px-2.5 py-1 text-xs
                           font-medium uppercase tracking-wide text-brand-200 backdrop-blur-sm"
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
