# Architecture & Design Decisions

> Every section covers a design choice, **why** it was made, and what to say if challenged on it.

---

## 1. Next.js App Router with Parallel Routes

**What:** The `/candidates` route uses parallel routes (`@list` and `@detail` slots) in `app/candidates/layout.tsx` to show a master-detail layout. Both panes render independently inside a shared layout.

**Why:**
- The list and detail are **independent data concerns** — selecting a candidate shouldn't re-fetch the entire list, and filtering shouldn't wipe the detail pane.
- Parallel routes let each slot have its own `loading.tsx`, `error.tsx`, and `not-found.tsx` — errors in one pane don't crash the other.
- The layout stays mounted across navigations, so the header and shell never flash.

**If asked "why not just client-side state?":**
- URL-driven state means every view is **shareable and bookmarkable** — you can send someone a link to a specific candidate with specific filters applied.
- Back/forward browser navigation works correctly for free.
- Data fetching happens on the server, so there's no loading waterfall of client → API → DB.

---

## 2. Server Components as the Default

**What:** Almost everything is a Server Component. Only a few components are Client Components:
- `FilterBar` — needs `useRouter` / `useSearchParams` / `useTransition` for interactive filtering
- `ReviewForm` — needs `useActionState` and `useOptimistic` for form handling
- `PaneSwitch` — needs `usePathname` for mobile pane toggling
- `ScrollToTop` — needs `useEffect` to reset scroll position

**Why:**
- Server Components ship **zero JavaScript** to the browser. The list, detail panel, badges, and sections are all pure HTML streamed from the server.
- Data fetching happens directly in the component via Prisma — no API layer, no `useEffect`, no loading spinners for the initial render.
- Sensitive data (internal notes, CV storage keys) is **never serialized** into the client bundle.

**If asked "how do you decide what's a Client Component?":**
- If it needs browser APIs, hooks, or event handlers → Client Component.
- Everything else stays on the server. The boundary is drawn as **low in the tree as possible** — e.g., `ReviewForm` is a client component inside `CandidateDetailPanel` (server component), not the other way around.

---

## 3. `server-only` Enforcement

**What:** Both `lib/auth.ts` and `lib/candidates.ts` import `server-only`, which causes a **build-time error** if any Client Component tries to import them.

**Why:**
- This is a compile-time guardrail, not a runtime one. It makes it impossible to accidentally import auth logic, Prisma queries, or sensitive data access code into a `'use client'` component.
- Without it, a developer could `import { getSession } from '@/lib/auth'` in a Client Component and the secret handling logic would silently end up in the browser bundle.

**If asked "isn't that overkill?":**
- It's zero-cost — just one import line. It prevents an entire class of security bugs at compile time rather than in code review.

---

## 4. Authentication & Authorization Model

**What:** Auth is in `lib/auth.ts`. The session is resolved via environment variables (demo mode). Three roles: `ADMIN`, `REVIEWER`, `VIEWER`.

**Key decisions:**
- **Authorization is checked server-side in two places:**
  1. In the Server Component (`@detail/[id]/page.tsx`) — decides whether to show the review form and internal notes.
  2. In the Server Action (`actions.ts`) — re-checks the role before writing. This is critical because a malicious client could call the action directly.
- **Data-level filtering**: `ADMIN`-only fields (`internalNotes`, `phone`) are conditionally selected from the database using dynamic booleans in Prisma's `select` — they aren't fetched and hidden; they literally **don't exist** in the RSC payload for non-admins.
- **Request-scoped caching**: `getSession()` is wrapped in React `cache()`, so even though both `@list` and `@detail` slots call it, only one session resolution runs per request.
- **Predicate functions**: `canReview(session)`, `canSeeInternalNotes(session)`, `canViewCv(session)` — each check is a named function, not an inline role comparison, so the authorization rules are readable and centralized.

**If asked "why check auth twice?":**
- The UI check is for UX (don't show a form you can't submit). The server action check is the **real security boundary**. Never trust the client.

---

## 5. Server Actions with Atomic Transactions

**What:** Review submission uses a Server Action (`saveReview` in `actions.ts`) instead of an API route.

**Why:**
- Server Actions are called like functions but execute on the server. No need to define a REST endpoint, serialize/deserialize, or handle CORS.
- They integrate with React's `useActionState` hook for **progressive enhancement** — the form works even before JavaScript loads.
- They support returning structured validation errors back to the form.

**How it works:**
1. Re-checks authorization (`getSession()` + `canReview()`)
2. Validates all fields with **Zod** (`ReviewSchema`)
3. Wraps the mutation in `db.$transaction` — upserts the `Review` record **and** updates `Candidate.score` atomically, so the list score and detail score never diverge
4. Calls `revalidatePath('/candidates', 'layout')` to purge the Next.js Router Cache across the entire parallel route tree

**If asked "why not an API route?":**
- API routes make sense for external consumers or webhooks. For in-app mutations, Server Actions are simpler, type-safe, and avoid the boilerplate of an API layer.

**If asked "why `$transaction`?":**
- The review score and the candidate's aggregate score must stay in sync. Without a transaction, a crash between the two writes would leave the list showing a stale score. The transaction makes it atomic — both writes succeed or neither does.

---

## 6. Optimistic UI Updates (ReviewForm)

**What:** The `ReviewForm` uses React 19's `useOptimistic` hook to instantly update the displayed score and recommendation **before** the server responds.

**Why:**
- Submitting a review involves a server round-trip (action → DB write → revalidation). Without optimistic UI, the user sees a spinner for 500ms–2s before any feedback.
- With `useOptimistic`, the new score and recommendation appear immediately. If the server action fails, React automatically rolls back to the previous state — **zero rollback code needed**.

**If asked "what if the optimistic state is wrong?":**
- That's the beauty of `useOptimistic` — if the action throws or returns an error, the optimistic state is discarded and the component reverts to the last confirmed server state. The user sees the error message and their form data is preserved (controlled inputs keep the text in local state).

---

## 7. CV Download Security (Proxy Pattern)

**What:** CVs are served through an API route (`app/api/cv/[id]/route.ts`) that acts as a proxy. The actual storage key is **never exposed to the client**.

**Flow:**
1. The detail panel renders a link to `/api/cv/[candidateId]`
2. The API route re-checks the session (`canViewCv`)
3. It looks up the `cvObjectKey` from the database via a narrow `select`
4. It calls `getSignedCvUrl()` to mint a short-lived signed URL
5. It **redirects** (302) with `Cache-Control: no-store, max-age=0`
6. An audit log entry is written (`[audit] cv.access user=...`)

**Why:**
- The storage object key never appears in HTML, in the RSC payload, or in a copied link.
- If someone's access is revoked, old links stop working because the proxy re-checks auth on every request.
- The signed URL expires quickly, so even if intercepted, it's short-lived.

**Why a Route Handler instead of a Server Action:**
- This is a GET request intended to open in a new browser tab. Links can't trigger Server Actions (which require POST).

**If asked "why not just give the client the GCS URL?":**
- That URL would be permanent and unrevocable. Anyone who copies it has indefinite access to that CV, bypassing your auth system entirely.

---

## 8. Prisma with React `cache()` for Deduplication

**What:** `listCandidates`, `getCandidateDetail`, `getSession`, and `listCities` are all wrapped in React's `cache()` function.

**Why:**
- In the parallel route setup, the `@list/[id]/page.tsx` and `@detail/[id]/page.tsx` both need session data and potentially candidate data. React `cache()` ensures that within a single server render request, the same function call with the same arguments only hits the database **once**.
- This is especially important because parallel route slots render independently — without `cache()`, you'd get duplicate queries.

**If asked "is this the same as HTTP caching?":**
- No. React `cache()` is **per-request deduplication**, not cross-request caching. Each new page load still runs the query. It just prevents redundant queries within the same render pass.

---

## 9. URL-Driven Filtering with `useTransition`

**What:** All filters live in the URL query string. `FilterBar` reads from `useSearchParams()` and pushes changes via `router.push()`, wrapped in `useTransition`.

**Flow:**
1. User changes a dropdown → `FilterBar` calls `router.push` with updated query params
2. `useTransition` keeps the current UI visible while the server re-renders (no flash)
3. `isPending` flag sets `aria-busy` on the form for screen readers
4. Next.js re-renders the server components with the new `searchParams`
5. `parseFilters()` validates the raw params against enum allowlists
6. `listCandidates(filters)` runs the filtered Prisma query
7. The list re-renders with the new results

**Key FilterBar details:**
- **Progressive enhancement**: Built as a native `<form method="get" action="/candidates">` — works even without JavaScript.
- **Instant vs deferred**: Dropdowns submit immediately on change; the text search input requires explicit submit to prevent per-keystroke server requests.
- **Canonical query strings**: `buildQueryString` sorts keys to produce deterministic URLs, improving cache behavior and browser history.

**Why URL state, not local state:**
- **Shareable**: Copy the URL and someone else sees the same filtered view.
- **Bookmarkable**: Save a filtered view for later.
- **Back button works**: Undo a filter change by pressing back.
- **Server-side filtering**: The database does the work using indexes, not the client.

---

## 10. Data Model Decisions

**Schema:** `prisma/schema.prisma`

**Key choices:**

| Decision | Rationale |
|----------|-----------|
| **Assessment keyed by Role, not Candidate** | All Backend Engineer candidates share the same assessment brief — models how take-home assessments actually work. |
| **`@@unique([candidateId, reviewerId])` on Review** | One review per reviewer per candidate. Enables **upsert** — same action handles create and edit. |
| **Submission is 1:1 with Candidate** | A candidate has at most one submission. `overTime` is computed (>120% of budget, with a 20% grace period). |
| **`cvObjectKey` separate from `cvFileName`** | Storage key (where the file lives) is separate from display name. Allows renaming without moving files. |
| **Composite indexes on filter columns** | `@@index([stage, score])`, `@@index([role, city])`, `@@index([assessmentStatus, appliedAt])` — each index covers a common filter+sort combination to keep list queries fast. |
| **Denormalized `score` on Candidate** | The candidate's score appears in the list. Storing it on the candidate avoids joining/aggregating reviews on every list render. Updated atomically via `$transaction` when a review is saved. |

---

## 11. Explicit TypeScript Types (Serialization Boundary)

**What:** `lib/candidates.ts` defines `CandidateListItem` and `CandidateDetail` types manually, rather than exporting Prisma's generated types.

**Why:**
- These types act as a **serialization boundary**. They define exactly what leaves the server and enters the RSC payload.
- Prisma types include everything the ORM knows — relations, internal fields, nullable types that are always populated after a query. Custom types express what the UI actually needs.
- If the database schema changes, the compiler forces you to update the mapping layer rather than silently leaking new fields to the client.

---

## 12. Error Boundaries Per Slot

**What:** Each parallel route slot has its own `error.tsx`. The detail slot also has a `not-found.tsx`.

**Why:**
- A database error loading the detail panel shouldn't crash the list. Each slot is an independent error boundary.
- `not-found.tsx` in the detail slot handles stale bookmarks or deleted candidates gracefully — it shows a message instead of crashing.
- Each error boundary has a **"Try again" button** that calls React's `reset()`, which re-renders the boundary's children without a full page reload.
- Error messages include `error.digest` in production for support reference without exposing internal DB details.

---

## 13. Accessibility Choices

**What:**
- A skip link ("Skip to results") in the root layout lets keyboard users bypass the header and filters.
- Candidate rows use `aria-current="true"` on the selected link instead of relying on visual styling alone.
- The results count uses `aria-live="polite"` so screen readers announce when the list changes after filtering.
- The filter bar uses `<fieldset>` and `<legend>` structure, `aria-busy={isPending}`, and unique IDs via `useId()`.
- Badges use `sr-only` labels so color is never the sole indicator (WCAG AA >4.5:1 contrast).
- `ScoreBadge` renders an em-dash with `sr-only` text ("No score yet") when `score === null`, preventing confusion with score 0.
- The review form has dual score inputs (syncing a `range` slider with a `number` input), `aria-describedby` for error associations, and focus management on submission.
- `globals.css` includes `@media (prefers-reduced-motion: reduce)` to disable animations for users who need it.
- `:focus-visible` rings are shown for keyboard navigation but suppressed on mouse click.

**If asked "why not a roving-tabindex listbox for the candidate list?":**
- Listbox widgets break Ctrl/Cmd-click, "open in new tab", and default link semantics. Since each row is a `<Link>`, it's already keyboard-accessible (Tab, Enter, announced as a link). The skip link offsets the tab-stop cost.

---

## 14. Mobile Responsiveness (PaneSwitch)

**What:** `PaneSwitch` is a tiny Client Component that toggles between list and detail panes on mobile.

**How:**
- On `lg+` (desktop): Both panes are always visible side-by-side via CSS grid. `PaneSwitch` is irrelevant.
- On mobile: If the URL is `/candidates` → show the list. If the URL is `/candidates/[id]` → show the detail.
- The detail panel has a "← Back to candidates" link that's `lg:hidden` — only visible on mobile.

**Why:**
- No complex state management or animations needed. The URL **is** the state. CSS handles the toggle.

---

## 15. Storage Abstraction (Strategy Pattern)

**What:** `lib/storage.ts` abstracts file storage behind a `getSignedCvUrl()` function with two backends:
- `local` — reads from disk, returns a base64 data URL
- `gcs` — generates a signed Google Cloud Storage URL (short TTL)

**Why:**
- Developers can run the app locally without a GCS bucket. Just set `STORAGE_PROVIDER=local` and drop files in a directory.
- In production, flip to `STORAGE_PROVIDER=gcs`. The rest of the app doesn't know or care where files live.
- This is the **strategy pattern** — swap implementations without changing consumers.

---

## 16. Validation with Zod

**What:** The Server Action uses **Zod** for form validation, and `parseFilters()` uses allowlist-based validation for URL params.

**Two different approaches for two different contexts:**

| Context | Strategy | Why |
|---------|----------|-----|
| **Form data** (review submission) | Zod schema with strict validation and field-level error messages | The user needs to know exactly what's wrong. Errors are displayed inline next to each field. |
| **URL params** (filters) | Allowlist matching, invalid values silently dropped | URLs can be stale, manually edited, or shared. Throwing an error for an invalid filter would be a bad UX — just ignore it. |

**Additional defense-in-depth:**
- Candidate ID is validated as UUID format via regex — prevents passing odd strings even though Prisma parameterizes queries anyway.
- Score range inputs are clamped (0–100), and inverted ranges (`scoreMin > scoreMax`) are automatically swapped instead of returning zero results.

---

## 17. Testing Strategy

**Stack:** Vitest + React Testing Library + JSDOM

**What's tested and how:**

| Test File | What It Tests | Approach |
|-----------|---------------|----------|
| `filters.test.ts` | Search param parsing, boundary clamping, range inversion swap, Prisma where/orderBy mapping, canonical query strings | Pure unit tests, zero dependencies |
| `CandidateList.test.tsx` | List rendering, `aria-current` indicators, empty state, null score vs 0 score, live region announcements | Component tests (JSDOM) |
| `FilterBar.test.tsx` | URL query string pushes, filter merging, keyboard tab order, accessibility labels | Interaction tests with mocked `useRouter` |
| `ReviewForm.test.tsx` | Optimistic rendering, automatic rollback on error, field errors, controlled input preservation, unauthorized role view | UI tests |
| `saveReview.test.ts` | Permission enforcement, Zod validation, atomic transaction upserts, score sync, `revalidatePath` calls | Integration tests against real SQLite test DB |

**Key config decisions:**
- `server-only` is stubbed in vitest config so server modules can be imported in tests
- `fileParallelism: false` — tests run sequentially because they hit a single SQLite test DB
- Global setup re-creates the test database with `prisma db push` before each suite run

**If asked "why not E2E tests?":**
- E2E tests (Playwright/Cypress) would add value for the full flow but are slower and more complex to set up. The Server Action is the most critical piece (it writes to the DB), so testing it first gives the highest value per effort. The component tests cover the interactive UI layer. E2E would be the next investment.

---

## 18. Prisma Singleton Pattern

**What:** `lib/prisma.ts` (or `lib/db.ts`) caches the Prisma client on `globalThis` in development.

**Why:**
- Next.js hot module replacement creates a new module scope on every code change. Without the singleton, each reload creates a new Prisma client and a new database connection pool. After a few saves you'd exhaust the database's connection limit.
- In production this isn't an issue (modules are loaded once), but the pattern is harmless there.

---

## Quick-Fire Q&A

| Question | Answer |
|----------|--------|
| **Why Next.js App Router over Pages Router?** | Server Components, parallel routes, streaming, Server Actions — none of these exist in Pages Router. The App Router is the recommended approach for new Next.js projects. |
| **Why Tailwind?** | Utility-first CSS avoids naming classes and keeps styles co-located with markup. The custom `brand`/`accent`/`surface` tokens in `tailwind.config.ts` ensure visual consistency. |
| **Why PostgreSQL?** | Relational data (candidates → reviews, candidates → submissions) maps naturally to a relational DB. Prisma's type generation gives compile-time safety. (Dev uses SQLite for simplicity.) |
| **Why no state management library (Redux, Zustand)?** | There's no client-side state to manage. The URL is the state for filters/selection. Server Components fetch data directly. The review form uses React's built-in `useActionState` + `useOptimistic`. |
| **Why `revalidatePath` instead of `revalidateTag`?** | The review count appears in the list, and the review section appears in the detail. Both are under `/candidates`, so revalidating the whole path is simpler and correct. Using `'layout'` as the second argument ensures the entire parallel route tree is refreshed. |
| **Why Zod in the action but not in filters?** | Different error tolerances. Form submissions need precise field-level errors. URL params should degrade gracefully (a stale filter in a shared URL shouldn't crash the page). |
| **How does the `overTime` flag work?** | Compares `timeTakenMinutes` against `durationMinutes × 1.2` (20% grace period). Displayed as an "Over budget" badge, not a hard block. |
| **What would you change for production?** | Real auth (NextAuth/Clerk), rate limiting on the review action, cursor-based pagination for the list, E2E tests, CDN for static assets, and observability (structured logging, error tracking). |
