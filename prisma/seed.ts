/**
 * Seed data.
 *
 * Goal: every filter and every UI state is reachable without hand-editing the
 * database. Concretely the data below guarantees at least one candidate for
 * each of the 8 roles, 10 cities, 7 stages and 5 assessment statuses, plus:
 *
 *   - candidates with no submission (NOT_SENT / INVITED / IN_PROGRESS / EXPIRED)
 *   - candidates with a submission but no review yet  → the empty review form
 *   - candidates already reviewed by *this* demo reviewer → the edit/upsert path
 *   - candidates reviewed by someone else → review history from another person
 *   - candidates with a null score → exercises `nulls: 'last'` in the sort
 *   - at least one over-time submission → the "over the time budget" flag
 *
 * Randomness is seeded, so `npm run seed` twice produces byte-identical data
 * and screenshots/tests don't drift. `Math.random()` is never used.
 */
import { PrismaClient } from '@prisma/client';
import {
  ASSESSMENT_STATUSES,
  CITIES,
  RECOMMENDATIONS,
  ROLES,
  ROLE_LABELS,
  STAGES,
  type AssessmentStatusKey,
  type RoleKey,
  type StageKey,
} from '../lib/enums';

const db = new PrismaClient();

/** mulberry32 — tiny deterministic PRNG. Fixed seed = reproducible dataset. */
function makeRng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = makeRng(20260729);

const pick = <T,>(items: readonly T[]): T => items[Math.floor(rng() * items.length)];
const intBetween = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

const FIRST_NAMES = [
  'Amara', 'Bilal', 'Clara', 'Dmitri', 'Elena', 'Farid', 'Grace', 'Hugo',
  'Ines', 'Jonas', 'Kavya', 'Lukas', 'Mira', 'Noor', 'Otto', 'Petra',
  'Quentin', 'Rania', 'Sofia', 'Tomas', 'Ulrike', 'Viktor', 'Wafa', 'Xavi',
  'Yusuf', 'Zoe', 'Aoife', 'Bruno', 'Chiara', 'Daan', 'Eero', 'Freja',
  'Gabor', 'Hana', 'Ivan', 'Julia', 'Karim', 'Lena', 'Marek', 'Nadia',
];
const LAST_NAMES = [
  'Okonkwo', 'Haddad', 'Novak', 'Petrov', 'Marino', 'Bensaid', 'Whitfield', 'Lindqvist',
  'Ferreira', 'Andersen', 'Iyer', 'Brandt', 'Kaplan', 'Rahman', 'Voss', 'Kowalski',
  'Dubois', 'Ziani', 'Almeida', 'Silva', 'Keller', 'Horvath', 'Ben Ali', 'Puig',
  'Demir', 'Papadakis', 'Byrne', 'Costa', 'Rossi', 'Visser', 'Virtanen', 'Nilsen',
  'Szabo', 'Takacs', 'Sokolov', 'Wagner', 'Mansour', 'Fischer', 'Zielinski', 'Aziz',
];

/** One brief per role. Assessments are shared across candidates by design. */
const ASSESSMENT_BRIEFS: Record<RoleKey, { title: string; brief: string; durationMinutes: number }> = {
  FRONTEND_ENGINEER: {
    title: 'Accessible data table',
    brief:
      'Build a sortable, filterable table of 500 rows. Requirements: keyboard-operable column sorting, an accessible name on every control, no layout shift while data loads, and a documented decision on virtualisation. Ship a short README explaining what you would do differently with 50,000 rows.',
    durationMinutes: 180,
  },
  BACKEND_ENGINEER: {
    title: 'Idempotent payments webhook',
    brief:
      'Implement a webhook receiver that processes payment events exactly once under at-least-once delivery. Cover: replay handling, out-of-order events, a partial-failure path, and the database constraints that make your guarantee real rather than best-effort.',
    durationMinutes: 180,
  },
  FULLSTACK_ENGINEER: {
    title: 'Team availability planner',
    brief:
      'A small app where a team declares weekly availability and a manager sees overlap. Model timezones properly. We care most about the data model and where you draw the client/server boundary.',
    durationMinutes: 240,
  },
  DATA_ANALYST: {
    title: 'Funnel drop-off investigation',
    brief:
      'Given three months of anonymised signup events, find where the funnel leaks and quantify the opportunity. Deliver SQL plus a one-page memo aimed at a non-technical stakeholder. State your assumptions explicitly.',
    durationMinutes: 150,
  },
  PRODUCT_DESIGNER: {
    title: 'Redesign the rejection email flow',
    brief:
      'Rework how candidates are told they were unsuccessful. Provide flows, two key screens, and a written rationale covering tone, timing and what you deliberately chose not to build.',
    durationMinutes: 240,
  },
  PRODUCT_MANAGER: {
    title: 'Prioritise a broken onboarding',
    brief:
      'Given support tickets, retention data and three competing stakeholder asks, produce a one-page plan for the next quarter. Show your prioritisation reasoning and what you are explicitly saying no to.',
    durationMinutes: 120,
  },
  QA_ENGINEER: {
    title: 'Test plan for a checkout rewrite',
    brief:
      'Write the test strategy for replacing a live checkout. Include risk ranking, what you automate versus explore manually, and how you would verify the rollout without a full staging environment.',
    durationMinutes: 150,
  },
  DEVOPS_ENGINEER: {
    title: 'Zero-downtime schema migration',
    brief:
      'Plan and script the migration of a hot 200M-row table to a new column type. Cover rollback, observability during the change, and how you would prove the migration is safe before running it in production.',
    durationMinutes: 180,
  },
};

const SCREENING_QUESTIONS = [
  'Why are you interested in this role?',
  'Describe a project you are proud of and your specific contribution.',
  'What is your notice period and earliest start date?',
  'Do you have the right to work in the EU or UK?',
];

const SCREENING_ANSWERS: string[][] = [
  [
    'I have spent three years on internal tooling and want to work on a product where the users are outside the company.',
    'Your engineering blog post on incremental migration matched how I already like to work, which is rare.',
    'I want to move from an agency to a product team where I own something past launch.',
    'The role is the first I have seen that treats accessibility as a requirement rather than a phase-two item.',
  ],
  [
    'I led the migration of our billing service off a shared monolith. I owned the data model and the cutover plan; the rollback path was never needed but was tested weekly.',
    'I rebuilt our design system component library. My contribution was the audit that cut 140 components to 32 and the codemod that migrated consumers.',
    'I built the analytics pipeline for our mobile app. I did the schema design and the backfill; a colleague handled the dashboards.',
    'I ran the accessibility remediation of our checkout. I did the audit, wrote the fixes for the form and focus management, and set up the CI gate that keeps it from regressing.',
  ],
  [
    'One month.',
    'Two months, though it can likely be shortened to six weeks.',
    'Immediately available.',
    'Three months — it is contractual, but I would push for an earlier release.',
  ],
  ['Yes — EU citizen.', 'Yes — UK settled status.', 'Yes — permanent residence in the Netherlands.', 'I would need visa sponsorship.'],
];

const OTHER_REVIEWERS = [
  { reviewerId: 'usr_admin', reviewerName: 'Priya Raman' },
  { reviewerId: 'usr_lead_eng', reviewerName: 'Marcus Adeyemi' },
  { reviewerId: 'usr_hiring_mgr', reviewerName: 'Elin Dahl' },
];
/** Matches lib/auth.ts DEMO_USERS.REVIEWER so the "edit my review" path is seeded. */
const DEMO_REVIEWER = { reviewerId: 'usr_reviewer', reviewerName: 'Sam Okafor' };

const REVIEW_COMMENTS = [
  'Strong submission. The data model handles the timezone edge cases correctly and the README is honest about what was left out. Would move to a technical interview.',
  'Solid but unremarkable. Everything asked for is present; nothing shows judgement beyond the brief. Worth a call to probe depth.',
  'Went well over the time budget and it shows in the scope, not the quality. I would ask about estimation in the interview rather than reject on this.',
  'Missed the core requirement — the idempotency guarantee relies on application-level checks with no supporting constraint, so it breaks under concurrency. Discussed with a second reviewer to be sure.',
  'Excellent written reasoning. The section on what they deliberately did not build is the best I have read this cycle.',
  'Fine work, wrong level. This reads as mid rather than senior; the architectural choices are unexplained. Would consider for the mid opening.',
  'Clear communication, weak technical depth. The memo is genuinely good; the SQL does not survive scrutiny on the join.',
];

/**
 * Weighted status pool. A uniform draw across the five statuses leaves only
 * ~8 submitted candidates out of 40, which is too thin to exercise the review
 * UI. This skews toward SUBMITTED, which also matches a real funnel: most
 * people who are sent an assessment eventually hand something in.
 */
const STATUS_POOL: AssessmentStatusKey[] = [
  ...Array<AssessmentStatusKey>(5).fill('SUBMITTED'),
  ...Array<AssessmentStatusKey>(2).fill('INVITED'),
  ...Array<AssessmentStatusKey>(2).fill('IN_PROGRESS'),
  ...Array<AssessmentStatusKey>(2).fill('NOT_SENT'),
  'EXPIRED',
];

/** Deterministic status→stage pairing so the data stays internally coherent. */
function stageForStatus(status: AssessmentStatusKey): StageKey {
  switch (status) {
    case 'NOT_SENT':
      return pick(['APPLIED', 'SCREENING'] as const);
    case 'INVITED':
    case 'IN_PROGRESS':
      return 'ASSESSMENT';
    case 'EXPIRED':
      return pick(['ASSESSMENT', 'REJECTED'] as const);
    case 'SUBMITTED':
      return pick(['ASSESSMENT', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'] as const);
  }
}

async function main() {
  console.log('Clearing existing data…');
  // Order matters: children before parents. `onDelete: Cascade` would handle
  // candidates, but being explicit keeps this readable and provider-agnostic.
  await db.review.deleteMany();
  await db.submission.deleteMany();
  await db.screeningAnswer.deleteMany();
  await db.candidate.deleteMany();
  await db.assessment.deleteMany();

  console.log('Creating assessments…');
  const assessments = new Map<RoleKey, string>();
  for (const role of ROLES) {
    const spec = ASSESSMENT_BRIEFS[role];
    const created = await db.assessment.create({
      data: {
        slug: role.toLowerCase().replace(/_/g, '-'),
        title: spec.title,
        role,
        brief: spec.brief,
        durationMinutes: spec.durationMinutes,
      },
    });
    assessments.set(role, created.id);
  }

  console.log('Creating candidates…');

  // 40, not more: names are drawn as FIRST_NAMES[i % 40] + LAST_NAMES[(7i+3) % 40],
  // and because 7 is coprime with 40 that pairing is unique for i < 40 — which
  // is what keeps the `email` unique constraint satisfied without appending
  // numbers to people's addresses. Raising TOTAL past 40 silently collides, so
  // the assert below fails loudly instead.
  const TOTAL = 40;
  if (TOTAL > Math.min(FIRST_NAMES.length, LAST_NAMES.length)) {
    throw new Error(
      `TOTAL (${TOTAL}) exceeds the name pools; emails would collide. Extend FIRST_NAMES/LAST_NAMES first.`,
    );
  }

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  let submissionCount = 0;
  let reviewCount = 0;
  let demoReviewerCount = 0;

  for (let i = 0; i < TOTAL; i++) {
    // Cycle through the enums for the first N candidates so every filter value
    // is guaranteed present; the rest are random for realistic distribution.
    const role: RoleKey = i < ROLES.length ? ROLES[i] : pick(ROLES);
    const city = i < CITIES.length ? CITIES[i] : pick(CITIES);
    const status: AssessmentStatusKey =
      i < ASSESSMENT_STATUSES.length ? ASSESSMENT_STATUSES[i] : pick(STATUS_POOL);
    const stage: StageKey = i < STAGES.length ? STAGES[i] : stageForStatus(status);

    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[(i * 7 + 3) % LAST_NAMES.length];
    const fullName = `${firstName} ${lastName}`;
    const slug = `${firstName}.${lastName}`.toLowerCase().replace(/[^a-z.]/g, '');

    const hasSubmission = status === 'SUBMITTED';

    // Score exists only once there is work to score. NOT_SENT / INVITED /
    // IN_PROGRESS / EXPIRED candidates keep a null score, which is exactly what
    // the `nulls: 'last'` ordering is there to handle.
    const score = hasSubmission ? intBetween(38, 96) : null;

    const appliedAt = new Date(now - intBetween(1, 75) * DAY);

    const candidate = await db.candidate.create({
      data: {
        fullName,
        email: `${slug}@example.com`,
        city,
        role,
        stage,
        assessmentStatus: status,
        score,
        appliedAt,
        // Storage object key, not a URL — nothing resolvable ships to the client.
        cvObjectKey: `cvs/2026/${slug}-${i}.pdf`,
        cvFileName: `${firstName}-${lastName}-CV.pdf`,
        phone: `+44 7${intBetween(100, 999)} ${intBetween(100000, 999999)}`,
        // Recruiter-only. ADMIN sees these; REVIEWER and VIEWER never receive them.
        internalNotes:
          i % 3 === 0
            ? `Sourced via ${pick(['referral (Marcus A.)', 'LinkedIn outreach', 'careers page', 'a returning applicant from Q1'])}. Salary expectation £${intBetween(52, 95)}k. ${pick(['Flagged as a strong fit by the hiring manager.', 'Second application this year — first was for a more junior role.', 'Available for interviews only after 6pm.', 'Currently interviewing elsewhere; expect a compressed timeline.'])}`
            : null,
        screeningAnswers: {
          create: SCREENING_QUESTIONS.map((question, position) => ({
            question,
            answer: SCREENING_ANSWERS[position][(i + position) % SCREENING_ANSWERS[position].length],
            position,
          })),
        },
      },
    });

    if (!hasSubmission) continue;

    // Everything below counts off `submissionCount`, not the loop index. Only
    // some candidates reach SUBMITTED, so index parity (`i % 2`) would gate on
    // whichever i values happened to draw that status and leave states like
    // "reviewed by the demo reviewer" almost unreachable in the seeded data.
    const nth = submissionCount;

    const durationMinutes = ASSESSMENT_BRIEFS[role].durationMinutes;
    // Every 4th submitter blows past the budget so the over-time flag is visible.
    const timeTakenMinutes =
      nth % 4 === 1
        ? Math.round(durationMinutes * 1.6)
        : intBetween(Math.round(durationMinutes * 0.5), Math.round(durationMinutes * 1.1));

    const submission = await db.submission.create({
      data: {
        candidateId: candidate.id,
        assessmentId: assessments.get(role)!,
        workUrl: `https://github.com/${slug.replace('.', '-')}/${ASSESSMENT_BRIEFS[role].title
          .toLowerCase()
          .replace(/[^a-z]+/g, '-')}`,
        submittedAt: new Date(appliedAt.getTime() + intBetween(2, 10) * DAY),
        timeTakenMinutes,
      },
    });
    submissionCount++;

    // Two in every three submissions are already reviewed, so the list shows
    // both "awaiting review" and "reviewed" rows.
    if (nth % 3 === 2) continue;

    // Every other reviewed candidate is reviewed by the demo reviewer, which is
    // what makes the form's edit/upsert path reachable in the UI.
    const reviewer = nth % 2 === 0 ? DEMO_REVIEWER : pick(OTHER_REVIEWERS);
    if (reviewer.reviewerId === DEMO_REVIEWER.reviewerId) demoReviewerCount++;

    const reviewScore = score!;
    const recommendation =
      reviewScore >= 85
        ? 'STRONG_YES'
        : reviewScore >= 70
          ? 'YES'
          : reviewScore >= 58
            ? 'NEUTRAL'
            : reviewScore >= 46
              ? 'NO'
              : 'STRONG_NO';

    await db.review.create({
      data: {
        candidateId: candidate.id,
        submissionId: submission.id,
        reviewerId: reviewer.reviewerId,
        reviewerName: reviewer.reviewerName,
        score: reviewScore,
        recommendation,
        comment: REVIEW_COMMENTS[nth % REVIEW_COMMENTS.length],
      },
    });
    reviewCount++;

    // A couple of candidates get a second, dissenting review so the detail pane
    // shows reviewer disagreement — the reason Review is history, not a
    // single mutable row.
    if (nth % 5 === 1) {
      const second = OTHER_REVIEWERS.find((r) => r.reviewerId !== reviewer.reviewerId)!;
      await db.review.create({
        data: {
          candidateId: candidate.id,
          submissionId: submission.id,
          reviewerId: second.reviewerId,
          reviewerName: second.reviewerName,
          score: Math.max(0, Math.min(100, reviewScore + intBetween(-22, -12))),
          recommendation: RECOMMENDATIONS[intBetween(2, 4)],
          comment:
            'Reading this less generously than my colleague. The work is competent but the brief asked for reasoning about tradeoffs and there is very little of it.',
        },
      });
      reviewCount++;
    }
  }

  const summary = await db.candidate.groupBy({
    by: ['assessmentStatus'],
    _count: true,
  });

  console.log(`\nSeeded ${TOTAL} candidates across ${ROLES.length} roles and ${CITIES.length} cities.`);
  console.log(`  ${submissionCount} submissions, ${reviewCount} reviews`);
  console.log(`  ${demoReviewerCount} already reviewed by the demo reviewer (Sam Okafor)`);
  console.log('  by assessment status:');
  for (const row of summary.sort((a, b) => a.assessmentStatus.localeCompare(b.assessmentStatus))) {
    console.log(`    ${row.assessmentStatus.padEnd(12)} ${row._count}`);
  }
  console.log('\nRoles seeded:', ROLES.map((r) => ROLE_LABELS[r]).join(', '));
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
