/**
 * Single source of truth for every enum-like column.
 *
 * SQLite (via Prisma) has no native enum type, so these columns are `String` in
 * schema.prisma. Rather than let that become "any string goes", the allowed
 * values are declared once here, the DB columns are validated by zod at every
 * write boundary, and the UI builds its filter options from these same arrays —
 * so adding a stage is a one-line change that propagates everywhere.
 *
 * On Postgres these become native enums and this file collapses to re-exporting
 * the generated Prisma enums; the `LABELS` maps stay, since display strings
 * should not live in the database.
 */

export const ROLES = [
  'FRONTEND_ENGINEER',
  'BACKEND_ENGINEER',
  'FULLSTACK_ENGINEER',
  'DATA_ANALYST',
  'PRODUCT_DESIGNER',
  'PRODUCT_MANAGER',
  'QA_ENGINEER',
  'DEVOPS_ENGINEER',
] as const;
export type RoleKey = (typeof ROLES)[number];

export const ROLE_LABELS: Record<RoleKey, string> = {
  FRONTEND_ENGINEER: 'Frontend Engineer',
  BACKEND_ENGINEER: 'Backend Engineer',
  FULLSTACK_ENGINEER: 'Fullstack Engineer',
  DATA_ANALYST: 'Data Analyst',
  PRODUCT_DESIGNER: 'Product Designer',
  PRODUCT_MANAGER: 'Product Manager',
  QA_ENGINEER: 'QA Engineer',
  DEVOPS_ENGINEER: 'DevOps Engineer',
};

/** Pipeline stages, in funnel order — the array order drives the filter UI. */
export const STAGES = [
  'APPLIED',
  'SCREENING',
  'ASSESSMENT',
  'INTERVIEW',
  'OFFER',
  'HIRED',
  'REJECTED',
] as const;
export type StageKey = (typeof STAGES)[number];

export const STAGE_LABELS: Record<StageKey, string> = {
  APPLIED: 'Applied',
  SCREENING: 'Screening',
  ASSESSMENT: 'Assessment',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  HIRED: 'Hired',
  REJECTED: 'Rejected',
};

/**
 * Assessment lifecycle. Note that only SUBMITTED implies a Submission row
 * exists — the other four states are precisely why this column lives on
 * Candidate rather than on Submission.
 */
export const ASSESSMENT_STATUSES = [
  'NOT_SENT',
  'INVITED',
  'IN_PROGRESS',
  'SUBMITTED',
  'EXPIRED',
] as const;
export type AssessmentStatusKey = (typeof ASSESSMENT_STATUSES)[number];

export const ASSESSMENT_STATUS_LABELS: Record<AssessmentStatusKey, string> = {
  NOT_SENT: 'Not sent',
  INVITED: 'Invited',
  IN_PROGRESS: 'In progress',
  SUBMITTED: 'Submitted',
  EXPIRED: 'Expired',
};

export const RECOMMENDATIONS = [
  'STRONG_YES',
  'YES',
  'NEUTRAL',
  'NO',
  'STRONG_NO',
] as const;
export type RecommendationKey = (typeof RECOMMENDATIONS)[number];

export const RECOMMENDATION_LABELS: Record<RecommendationKey, string> = {
  STRONG_YES: 'Strong yes',
  YES: 'Yes',
  NEUTRAL: 'Neutral',
  NO: 'No',
  STRONG_NO: 'Strong no',
};

export const CITIES = [
  'Amsterdam',
  'Barcelona',
  'Berlin',
  'Dublin',
  'Lisbon',
  'London',
  'Manchester',
  'Paris',
  'Remote (EU)',
  'Warsaw',
] as const;
export type CityKey = (typeof CITIES)[number];

/** Reviewer roles for the mocked auth boundary — see lib/auth.ts. */
export const USER_ROLES = ['ADMIN', 'REVIEWER', 'VIEWER'] as const;
export type UserRole = (typeof USER_ROLES)[number];
