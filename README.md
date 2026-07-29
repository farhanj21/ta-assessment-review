# ta-assessment-review

An internal HR tool for reviewing candidates and their assessment submissions. Server-rendered candidate list with URL-driven filters, a detail panel, and a review action with optimistic UI.

Built with Next.js 15 (App Router) + TypeScript, Prisma + SQLite, Tailwind, and Vitest + React Testing Library.

---

## Setup

From a clean clone:

```bash
npm install
cp .env.example .env          # Windows: copy .env.example .env
npx prisma migrate dev        # creates prisma/dev.db and applies the migration
npm run seed                  # 40 candidates covering every filter and state
npm run dev                   # http://localhost:3000
```

```bash
npm test          # 48 tests across 5 files
npm run typecheck
npm run build
```

`.env` holds no secrets — just the SQLite path and a demo role. It is gitignored because a checked-in `.env` is a habit worth not forming, even when this particular one is harmless.

### Seeing the three authorization states

There is no login screen. Set `DEMO_USER_ROLE` in `.env` and restart the dev server:

| Role | What changes |
|---|---|
| `ADMIN` | Sees the recruiter-only **Internal notes** block (and phone number) on the detail panel. |
| `REVIEWER` *(default)* | Can submit reviews. Internal notes are absent from the payload entirely. |
| `VIEWER` | Review form is replaced by an explanation. Existing reviews stay readable. |

---

## Architecture

### Route structure

```
app/
├─ layout.tsx                    Server · header, skip link, resolves session
├─ page.tsx                      Server · redirect → /candidates
│
├─ candidates/
│  ├─ layout.tsx                 Server · two-pane grid, renders both slots
│  ├─ PaneSwitch.tsx             Client · ~20 lines, mobile pane visibility
│  ├─ actions.ts                 'use server' · saveReview()
│  │
│  ├─ @list/                     ── parallel route slot ──
│  │  ├─ ListPane.tsx            Server · shared implementation
│  │  ├─ page.tsx                /candidates
│  │  ├─ [id]/page.tsx           /candidates/:id — same list, row selected
│  │  ├─ loading.tsx             skeleton rows
│  │  └─ error.tsx               Client · list-scoped boundary
│  │
│  └─ @detail/                   ── parallel route slot ──
│     ├─ default.tsx             "Select a candidate"
│     ├─ page.tsx                same, at /candidates
│     └─ [id]/
│        ├─ page.tsx             Server · profile, brief, submission, reviews
│        ├─ loading.tsx          skeleton panel
│        ├─ error.tsx            Client · detail-scoped boundary
│        └─ not-found.tsx        unknown candidate id
│
└─ api/cv/[candidateId]/route.ts Route Handler · authorize → sign → 302
```

**Why parallel routes.** The obvious structure is: render the list in `candidates/layout.tsx`, the detail in `[id]/page.tsx`. That does not work here, for a reason worth being precise about — **layouts do not receive `searchParams`**. Layouts are deliberately not re-rendered on a search-param-only navigation, so they are never given them. Since every filter lives in the query string, the list has to be a *page*. A parallel-route slot's `page.tsx` does receive `searchParams`, which is what makes this structure work at all.

The second reason is boundaries. Each slot gets its own `loading.tsx` and `error.tsx`, so:

- Selecting a candidate streams a skeleton into the right pane while the list stays rendered and clickable.
- A failed detail fetch shows an error in the detail pane only — your filters survive.
- A failed list query leaves the detail pane usable.

**The cost, stated honestly.** `@list/[id]/page.tsx` re-renders the list when you select someone. `listCandidates` is wrapped in React `cache()`, so that is one DB query per request rather than two. There is also a known wrinkle: when the detail slot calls `notFound()`, the *document* status stays 200 because the list slot rendered successfully. The correct not-found UI shows, but a strict 404 status would require the detail to be the route-level page. For an authenticated internal tool with no SEO surface, I took the boundary isolation over the status code — but it is a real tradeoff, not an oversight.

### Server vs Client components

Three Client Components in the entire app. Everything else is a Server Component.

| Component | Why it's a Client Component |
|---|---|
| `FilterBar` | Needs event handlers and `useTransition` for the pending state. |
| `ReviewForm` | Needs `useActionState`, `useOptimistic`, and focus management. |
| `PaneSwitch` | Needs `usePathname` to decide which pane is visible on mobile. |
| `error.tsx` ×2 | React error boundaries are inherently client-side; `reset` is a callback. |

The rule I applied: **a component becomes a Client Component only when it needs browser state or an event handler, and it never becomes one to fetch data.** All fetching lives in `lib/candidates.ts` and is called from Server Components.

This is not just about bundle size. A Server Component's props are serialised into the RSC payload and shipped to the browser — so any field on an object passed to a Client Component is readable in devtools *even if it is never rendered*. That is why `ReviewForm` receives `canSubmit: boolean` rather than a `Session`, and why the query layer uses explicit `select` allowlists rather than `include`.

A pleasant side effect: because `CandidateList` is a synchronous function of its props with no fetching, it is testable with plain React Testing Library despite being a Server Component.

### Server Action over a Route Handler

`saveReview` in `app/candidates/actions.ts` is a Server Action because:

- **It removes a layer.** A `POST /api/reviews` would need request parsing, a response shape, a client fetch wrapper, and manual loading/error plumbing. This is one function, imported directly by the form and type-checked end to end — a renamed field is a compile error, not a runtime 400.
- **Mutation and invalidation are colocated.** `revalidatePath` runs inside the same call that writes, so there is no window where the write landed but the UI is stale, and no "remember to invalidate" burden on callers.
- **It degrades without JavaScript.** The form posts natively, so a review can be submitted before hydration finishes.
- **`useActionState` gives pending state and returned errors for free**, which is what keeps the optimistic UI short instead of a hand-rolled state machine.

The mirror case is in the same repo: `app/api/cv/[candidateId]/route.ts` **is** a Route Handler, because it is a GET that must produce a redirect the browser follows in a new tab. Server Actions are POSTs invoked from React and cannot be the target of a plain link. Different tools, different jobs.

> **Security note.** A Server Action is a public HTTP endpoint — Next assigns it an ID and anyone can POST to it. The role check inside `saveReview` is therefore not a duplicate of the UI check. The UI check is cosmetic; this one is real. Inputs are re-validated with zod for the same reason.

### UI states

| State | Where |
|---|---|
| Loading | `@list/loading.tsx`, `@detail/[id]/loading.tsx` — skeletons that mirror the real layout so content doesn't jump |
| Empty | `components/list/EmptyResults.tsx` — says *why* it's empty and offers the one-click escape |
| Error | `@list/error.tsx`, `@detail/[id]/error.tsx` — scoped per pane, `error.message` never rendered |
| Not found | `@detail/[id]/not-found.tsx` — distinct from error; "try again" would be useless for a 404 |
| Optimistic | `ReviewForm` — verdict appears instantly, rolls back automatically on failure |
| Unauthorized | `ReviewForm` when `canSubmit` is false — an explanation, not a disabled form |

On the optimistic update specifically: `useOptimistic` rather than `useState` because **the rollback is the hard part**. When the action settles, React discards the optimistic value and re-renders from server state on its own. There is no rollback branch in the component, and therefore no rollback branch to get wrong. `tests/ReviewForm.test.tsx` holds the action open mid-flight and asserts both the optimistic display and the automatic revert.

### Caching and revalidation

The explicit position:

**The candidate list can tolerate brief staleness.** Someone else's review landing a second ago does not change what this reviewer is doing. The list is dynamically rendered per request (it depends entirely on `searchParams`), but no effort is spent guaranteeing cross-user freshness.

**A review you just submitted must be fresh, always.** Seeing your own change missing is the single most confusing possible outcome — it reads as data loss. So `saveReview` calls:

```ts
revalidatePath('/candidates', 'layout');
```

`'layout'` scope, not `'page'`, because one write changes two things at two URLs: the review history on `/candidates/<id>`, and the score and review count of that row back on `/candidates`. Layout scope covers the whole subtree including both parallel-route slots.

The important target is the **client-side Router Cache**. Without this call, a user who submits a review and navigates back to the list can be served the previously-rendered list from memory, with their own change missing.

Note what is deliberately *not* here: no `unstable_cache`, no `revalidate` tags on the read path. Every page reads live from SQLite. Adding a cache layer without a measured problem would mean inventing invalidation bugs to solve a latency issue this app does not have. The place a tagged cache would earn its keep is called out in the 50,000-applicant section below.

### Accessibility

Treated as a requirement, and asserted in tests rather than promised here:

- **Keyboard navigation** — every list row is a real `<a>`. Tabbable, Enter-activated, Ctrl/Cmd-clickable, announced as a link. A roving-tabindex listbox would cut tab stops but break all of that, so the tab-stop cost is paid off with a **skip link** (first focusable element in the document) that jumps straight to the results.
- **Labels** — every filter and every form field has a real `<label>`. `tests/FilterBar.test.tsx` resolves all eight controls via `getByLabelText`, which uses the same accessible-name computation a screen reader does, so a decorative-only label would fail the test.
- **Grouping** — `<fieldset>`/`<legend>` for the filter set and for the score range, so "Minimum"/"Maximum" are announced under the heading that gives them meaning.
- **Focus states** — a 2px `:focus-visible` outline set once in `globals.css`. Tailwind's reset removes the UA outline; not replacing it would leave keyboard users with no indicator at all. `:focus-visible` (not `:focus`) means it can be high-contrast without firing on mouse clicks.
- **Live regions** — the result count is `role="status" aria-live="polite"`, so changing a filter announces the new count. Without it, a screen-reader user gets no signal the list changed.
- **Selection** — `aria-current="true"` on the open row. The blue ring communicates nothing to a screen reader.
- **Status is never colour-only** — every badge carries its label as text, so the app is fully usable in greyscale or with any colour vision deficiency. All badge combinations are ≥4.5:1 against their own background; nothing lighter than `slate-600` is ever used for text.
- **Form errors** — wired via `aria-describedby` + `aria-invalid`, and focus moves to the result message after a submit settles so the outcome is announced rather than silent.
- **Reduced motion** — `prefers-reduced-motion` disables the skeleton animations and smooth scrolling.

### Responsive layout

Desktop (`lg` and up): a fixed-width list rail beside a fluid detail pane, each independently scrollable so a long reviewer comment never pushes the filters off screen.

Mobile: a single column. `PaneSwitch` shows the list at `/candidates` and the detail at `/candidates/:id`, with a "Back to candidates" link that preserves the active filters. It is CSS-only — both panes stay mounted, so going back doesn't refetch and the browser keeps the list's scroll position. It is presentation only and never gates data; anything a user must not see is removed on the server.

---

## Database

### Schema

`Candidate` · `Assessment` · `Submission` · `ScreeningAnswer` · `Review` — full schema with inline reasoning at `prisma/schema.prisma`.

Four decisions worth defending:

**No enums, by force.** Prisma does not support `enum` on SQLite. Every enum-like column is a `String`, with allowed values declared once in `lib/enums.ts`, enforced by zod at write boundaries, and used to build the filter UI options. On Postgres these become native enums.

**`assessmentStatus` lives on `Candidate`, and this is not denormalization.** The states `NOT_SENT` / `INVITED` / `IN_PROGRESS` / `EXPIRED` have no `Submission` row to live on. A `Submission` exists **if and only if** work was submitted — absence is meaningful. One source of truth, nothing to keep in sync.

**`Candidate.score` genuinely is derived state** — the one place I traded write cost for read speed. The list filters a *range* on score and *sorts* by it; expressing that as `reviews: { some: { score: ... } }` would defeat every index. Exactly one writer maintains it: a single transaction in `actions.ts` that upserts the review and updates the score together, so the list and the detail pane can never disagree. `tests/saveReview.test.ts` asserts both halves move together, and that a refused write moves neither.

**`Review` is history, not a mutable row.** `@@unique([candidateId, reviewerId])` means one verdict per reviewer, so the Server Action is a clean upsert — which is also what makes optimistic UI correct on a *second* submit. Keeping past reviews lets a hiring manager see disagreement between reviewers; the seed includes dissenting pairs.

### Indexes

Five, each tied to a specific query:

| Index | Query it serves | Why |
|---|---|---|
| `Candidate(stage, score)` | `WHERE stage = ? AND score BETWEEN ? AND ? ORDER BY score DESC` | The hottest query in the app. `stage` is an equality predicate so it leads; `score` follows, so one index satisfies both the range filter **and** the sort — no filesort. |
| `Candidate(role, city)` | `WHERE role = ? AND city = ?` | The facet filters. `role` leads because it's more selective (8 roles vs 10 cities, and far more skewed in a real funnel) and because role-only filtering is the common case — a left-prefix scan still uses this index. |
| `Candidate(assessmentStatus, appliedAt)` | Status facet + "newest first" within a status | Same equality-then-sort shape as the first index. |
| `Submission(candidateId)` | `WHERE candidateId = ?` on the detail panel | **Neither SQLite nor Postgres indexes a foreign key automatically.** Without it, the detail page's nested read full-scans submissions. |
| `Review(candidateId, createdAt)` | Reviews newest-first on the detail panel | The `@@unique(candidateId, reviewerId)` cannot satisfy an ordering by `createdAt`. |

I stopped at five deliberately. Every index is a tax on writes, and I couldn't name a sixth query that justified one.

### Avoiding N+1

**List — one round trip.** `listCandidates` uses a single `findMany` with an explicit `select`, and gets review counts via `_count`, which Prisma folds into the same statement as a correlated subquery. Rendering 50 rows with their review counts costs **one query, not 1 + 50**. The `where`/`orderBy` touch only indexed `Candidate` columns — nothing filters through a relation, which is precisely why `stage`, `score` and `assessmentStatus` live on `Candidate`.

**Detail — two round trips, and never more.** One nested `select` fetches the candidate with screening answers, latest submission (+ its assessment) and all reviews as batched relation loads, so it does not degrade to 1 + N as the review count grows. A second query runs **only** when the candidate has not submitted, to fetch the role's brief — which has nothing to hang off in the first query, and which reviewers still need to see.

### Seed

`prisma/seed.ts` — 40 candidates, 14 submissions, 12 reviews. Deterministic (seeded `mulberry32` PRNG, never `Math.random()`), so re-seeding produces identical data and nothing drifts between runs.

It guarantees at least one candidate for every role, city, stage and assessment status, plus: candidates with no submission, submissions with no review, candidates reviewed *by the demo reviewer* (so the edit/upsert path is reachable in the UI), candidates reviewed only by others, dissenting review pairs, null scores (exercising `nulls: 'last'`), and over-time submissions.

Two things it does on purpose: statuses after the coverage pass are drawn from a **weighted** pool skewed toward `SUBMITTED`, because a uniform draw left only ~8 reviewable candidates out of 40; and review assignment counts off the **submitter counter**, not the loop index, so coverage doesn't depend on which indices happened to draw which status.

### Migration

`prisma/migrations/20260729112603_init/` is committed. `npx prisma migrate dev` applies it to a fresh clone.

---

## Privacy and security

The threat this design takes seriously: **a CV URL rendered into the page leaks three ways at once.** It sits in the HTML and the RSC payload where anyone with devtools can read it — including for candidates whose rows merely appear in a list. It is copyable and permanent, so whoever saw it keeps access after they leave the company, because the object store never learns about that. And it is unauditable, because the file is fetched straight from storage and the app never observes the access.

So `Candidate.cvObjectKey` is a **storage key, not a URL**, and it never leaves the server. The client receives `/api/cv/<candidateId>` — a reference to a route, not a location. That route (`app/api/cv/[candidateId]/route.ts`):

1. Re-checks the session **before touching the database**, so an unauthorized caller can't use response timing to learn whether a candidate id exists.
2. Logs the access — who opened whose CV, when. This is the only chokepoint through which it can happen.
3. Mints a signed URL that expires in 5 minutes and redirects with `302` + `Cache-Control: no-store`.

A copied link is useless twice over: it points at our route, which re-authorizes the next visitor, and the signed URL it hands out dies in minutes. The signing is a real HMAC over `(objectKey, expiry)` — only the storage backend is mocked.

**Reviewer-only fields.** `internalNotes` and `phone` are ADMIN-only. Enforcement is in the `select` itself:

```ts
phone: showInternal,
internalNotes: showInternal,
```

Prisma's `select` takes booleans, so for a non-admin **the column is never read from the database at all** — not read-then-filtered in JS. It cannot appear in the RSC payload because it was never fetched. Verified end to end: fetching the same candidate as ADMIN, REVIEWER and VIEWER shows the notes present only for ADMIN, and never the `cvObjectKey` or storage host for anyone.

**The boundary is structural, not conventional.** `lib/auth.ts` and `lib/candidates.ts` both `import 'server-only'`, which makes importing them from a Client Component a *build error*. The role check cannot drift into the browser, where it would be advisory at best.

Auth itself is mocked (`lib/auth.ts` reads a role from an env var) but every server entry point — page, Server Action, Route Handler — calls `getSession()` and gates on the result. Swapping in NextAuth/Clerk/internal SSO is a one-function change; nothing downstream knows where the session came from.

---

## Tests

```bash
npm test        # 48 tests, 5 files
```

| File | Covers |
|---|---|
| `tests/filters.test.ts` | 18 tests. URL → filters → Prisma query. Hostile URLs (unknown enums, inverted ranges, repeated params, out-of-range scores), and the `nulls: 'last'` ordering. Pure — no DB, no renderer. |
| `tests/saveReview.test.ts` | 11 tests. The Server Action **against a real SQLite database**. Saves correctly, moves the derived score in the same transaction, upserts rather than duplicating, allows multiple reviewers, revalidates. Plus authorization (a VIEWER writes nothing and the score is untouched) and validation. |
| `tests/ReviewForm.test.tsx` | 5 tests. Optimistic display mid-flight, automatic rollback on failure, field errors preserving typed input, the unauthorized state, and labelling. |
| `tests/FilterBar.test.tsx` | 7 tests. Interaction: filters write to the URL, merging rather than replacing; Apply-vs-instant behaviour; clear-all keeps sort; every control has an accessible name; keyboard operability. |
| `tests/CandidateList.test.tsx` | 7 tests. Rendering: filter-preserving links, `aria-current`, empty state, null score vs zero, live-region count, truncation notice. |

Two deliberate choices. **The Server Action test uses a real database** (a disposable `prisma/test.db`, recreated per run) with only `getSession` and `revalidatePath` mocked — both boundaries, not behaviour. Mocking Prisma would have tested that the code calls the functions we wrote, which is not the same as testing that a review is saved. **The Server Action test asserts `revalidatePath` was called** with the right scope, because cache invalidation is part of the action's contract, not an implementation detail.

`tests/stubs/server-only.ts` exists because `server-only` ships a throwing "client" build that Vitest resolves by default. It is aliased away in tests only — the guard is fully in force in `next build` and `next dev`.

### Manual check not worth automating

Switching `DEMO_USER_ROLE` requires a dev-server restart (env is read at startup), so the three-role walkthrough is manual: set the role, restart, open any candidate, confirm ADMIN sees "Internal notes / Admin only", REVIEWER does not, and VIEWER additionally sees the unauthorized notice in place of the form. I verified all three by running three servers side by side and diffing the HTML for `cvObjectKey`, the storage host, `internalNotes` and phone numbers — none leak at any role.

---

## What I'd change for 50,000 applicants

Roughly in the order I'd actually do them:

**1. Cursor pagination, not offset.** Today the list takes 50 and reports the total. `OFFSET 40000` makes the database walk and discard 40,000 rows, so page 800 is far slower than page 1 — and rows shift under a user paging through a list that is being written to. A keyset cursor on the existing `(score, id)` sort tuple is `WHERE (score, id) < (?, ?) LIMIT 50` — flat cost at any depth, stable under concurrent writes. It reuses the `(stage, score)` index directly.

**2. Postgres + connection pooling.** SQLite takes a single writer, which is fine for one reviewer and wrong for a hiring team. Postgres also unlocks what the current schema works around: native enums instead of validated strings, partial indexes, `pg_trgm` for name search, and `EXPLAIN ANALYZE` worth reading. Prisma's engine opens a connection per instance, so serverless needs PgBouncer (or Prisma Accelerate) in transaction mode — without it a traffic spike exhausts `max_connections` and the app fails in the least obvious way possible.

**3. Drop the `contains` name search.** `WHERE fullName LIKE '%amara%'` cannot use a B-tree and becomes a full scan at 50k rows. Postgres `pg_trgm` with a GIN index, or a dedicated search service if fuzzy matching and typo tolerance start to matter.

**4. Faceted counts computed server-side, not inferred.** Reviewers want "Berlin (312)" next to each filter option. Running one `COUNT` per facet value per keystroke is a stampede. A single `GROUP BY` per facet dimension, cached briefly under a tag and invalidated by `revalidateTag` on write — this is where the caching layer I deliberately left out starts to earn its keep.

**5. Move every filter server-side and keep it there.** Already true, and it's the property that must not regress. The temptation at scale is "fetch once, filter in the client" — which ships 50,000 candidate records to the browser, including fields the client should never see. The `select` allowlists make that a visible decision rather than an accident.

**6. Virtualize the list.** 50 rows is fine; 500 is not. `@tanstack/react-virtual` renders only what's on screen. This is the one item that would force a Client Component boundary I've otherwise avoided, so I'd want to see it be a real problem first — and I'd keep the rows as real anchors so keyboard navigation and the accessibility work above survive.

**7. Denormalize a little further, carefully.** `reviewCount` per row is a correlated subquery today. At 50k rows in one page load that's measurable; a counter column maintained in the same transaction as the review write would remove it. Same tradeoff as `Candidate.score`, and I'd apply the same rule: one writer, one transaction, or don't do it.

**8. Rate-limit and audit the CV route.** It is already the single chokepoint for CV access and already logs. At scale that log becomes a real audit table, and the route gets a per-user rate limit so a compromised account cannot enumerate every CV in the pipeline.

---

## Known tradeoffs

- **Slot-level `notFound()` returns HTTP 200.** The correct UI renders; the status code doesn't follow, because the list slot succeeded. Explained in the routing section above.
- **`package.json#prisma` deprecation warning** on Prisma 6.19. Still supported; migrating to `prisma.config.ts` is a Prisma 7 concern and would have added churn without changing behaviour.
- **Single-select facets.** Multi-select (`?stage=OFFER&stage=HIRED`) is a natural extension — `parseFilters` already normalizes repeated params — but I built the single-select case rather than the generality nobody asked for.
- **No pagination UI.** The list takes 50 and says so when truncated. With 40 seeded candidates this is never hit; the honest fix at scale is item 1 above, not a page-number widget.
