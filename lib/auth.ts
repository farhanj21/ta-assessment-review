import 'server-only';

import { cache } from 'react';
import type { UserRole } from './enums';
import { USER_ROLES } from './enums';

/**
 * Mocked auth.
 *
 * There is no identity provider in this project, but the *boundary* is real:
 * every server entry point (page, Server Action, Route Handler) calls
 * `getSession()` and every privileged read or write is gated on the result.
 * Swapping this file for NextAuth/Clerk/an internal SSO is a one-function
 * change — nothing downstream knows where the session came from.
 *
 * Two properties worth noting:
 *
 *  - `import 'server-only'` makes it a *build error* to import this module
 *    from a Client Component. The role check cannot be accidentally moved to
 *    the browser, where it would be advisory at best.
 *
 *  - Role is read from an env var rather than a cookie so that a reviewer can
 *    flip it in .env and see all three authorization states without a login
 *    screen. It is read per-request (not module-scope) so editing .env and
 *    reloading takes effect.
 */

export type Session = {
  userId: string;
  name: string;
  role: UserRole;
};

const DEMO_USERS: Record<UserRole, Session> = {
  ADMIN: { userId: 'usr_admin', name: 'Amir Shahzad', role: 'ADMIN' },
  REVIEWER: { userId: 'usr_reviewer', name: 'Farhan Jafri', role: 'REVIEWER' },
  VIEWER: { userId: 'usr_viewer', name: 'Hammad Raza', role: 'VIEWER' },
};

function isUserRole(value: string | undefined): value is UserRole {
  return !!value && (USER_ROLES as readonly string[]).includes(value);
}

/**
 * `cache()` dedupes this within a single request/render pass. The list and the
 * detail pane both need the session; without it, a real auth backend would be
 * hit twice per navigation.
 */
export const getSession = cache(async (): Promise<Session> => {
  const configured = process.env.DEMO_USER_ROLE;
  const role: UserRole = isUserRole(configured) ? configured : 'REVIEWER';
  return DEMO_USERS[role];
});

/** Who may submit or update a review. VIEWER deliberately may not. */
export function canReview(session: Session): boolean {
  return session.role === 'ADMIN' || session.role === 'REVIEWER';
}

/** Who may see recruiter-only fields (Candidate.internalNotes, phone). */
export function canSeeInternalNotes(session: Session): boolean {
  return session.role === 'ADMIN';
}

/**
 * Who may open a CV. Everyone signed in can here, but this stays a named
 * predicate rather than an inline `true` so the CV route has one obvious place
 * to tighten later (e.g. only reviewers assigned to that candidate's role).
 */
export function canViewCv(session: Session): boolean {
  return USER_ROLES.includes(session.role);
}

/** Thrown by Server Actions when the session lacks the required permission. */
export class UnauthorizedError extends Error {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}
