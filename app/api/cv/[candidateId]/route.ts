import { NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';
import { db } from '@/lib/db';
import { canViewCv, getSession } from '@/lib/auth';

/**
 * Server-gated CV access.
 *
 * THE PROBLEM THIS SOLVES
 *
 * The naive version is to put the CV's storage URL on the candidate object and
 * render `<a href={candidate.cvUrl}>`. That leaks in three ways at once:
 *
 *  1. The URL is in the HTML and in the RSC payload, so it is readable by
 *     anyone who can see the page source — including for candidates whose rows
 *     merely appear in a list the user is allowed to see.
 *  2. It is copyable and permanent. Someone who saw it once keeps access after
 *     they leave the company, because the object store never learns about that.
 *  3. It is unauditable. The file is fetched directly from storage, so the app
 *     never observes the access and cannot log it.
 *
 * THE APPROACH
 *
 * The client only ever receives `/api/cv/<candidateId>` — a reference to a
 * route, not a location. `Candidate.cvObjectKey` never crosses the network. On
 * request this route re-checks the session, then mints a URL that expires, and
 * redirects. A copied link is therefore useless twice over: it points at our
 * route, which will re-authorize the next visitor, and the signed URL it hands
 * out dies in five minutes.
 *
 * WHY A ROUTE HANDLER AND NOT A SERVER ACTION
 *
 * This is a GET that must produce a redirect the browser follows in a new tab.
 * Server Actions are POSTs invoked from React — they cannot be the target of a
 * plain link. This is precisely the case where a Route Handler is correct and
 * the Server Action is not, which is the mirror image of the reasoning in
 * app/candidates/actions.ts.
 */

const URL_TTL_SECONDS = 300;

/**
 * Stands in for `S3.getSignedUrl` / `getSignedUrl(blobClient)`. The important
 * properties are reproduced honestly: the signature covers the object key and
 * an expiry, so the URL cannot be edited to reach a different file or to last
 * longer. Only the storage backend is fake.
 */
function signObjectUrl(objectKey: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + URL_TTL_SECONDS;

  // In a real deployment this secret comes from the environment. The fallback
  // exists so a clean clone runs without any configuration; it is only ever
  // used against the mock storage host below.
  const secret = process.env.CV_SIGNING_SECRET ?? 'dev-only-not-a-real-secret';
  const signature = createHmac('sha256', secret)
    .update(`${objectKey}:${expiresAt}`)
    .digest('hex');

  const url = new URL(`https://cv-storage.example.com/${objectKey}`);
  url.searchParams.set('expires', String(expiresAt));
  url.searchParams.set('signature', signature);
  return url.toString();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ candidateId: string }> },
) {
  const session = await getSession();

  // 401 before the database is touched — an unauthorized caller should not be
  // able to use response timing to learn whether a candidate id exists.
  if (!canViewCv(session)) {
    return NextResponse.json(
      { error: 'Not authorized to view candidate CVs.' },
      { status: 401 },
    );
  }

  const { candidateId } = await params;

  const candidate = await db.candidate.findUnique({
    where: { id: candidateId },
    // Only the two columns this route needs. The key is used and discarded; it
    // is never returned to the caller.
    select: { cvObjectKey: true, fullName: true },
  });

  if (!candidate) {
    return NextResponse.json({ error: 'Candidate not found.' }, { status: 404 });
  }

  // Where an audit trail belongs: who opened whose CV, and when. Reviewing
  // someone's CV is a privacy-relevant event and this is the only chokepoint
  // through which it can happen.
  console.info(
    `[audit] cv.access user=${session.userId} role=${session.role} candidate=${candidateId}`,
  );

  // 302, not 301: the signed URL is short-lived, so it must never be cached as
  // a permanent redirect by the browser or an intermediary.
  return NextResponse.redirect(signObjectUrl(candidate.cvObjectKey), {
    status: 302,
    headers: {
      // Belt and braces — this response contains a credential in the Location
      // header and must not be stored anywhere.
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
