import { z } from 'zod';

export const isoDateTimeSchema = z.iso.datetime({ offset: true });
export const idSchema = z.uuid();

export const platformSchema = z.literal('xiaohongshu');
export const projectTypeSchema = z.enum([
  'single_post',
  'series_topic',
  'creator',
]);
export const objectiveSchema = z.enum([
  'awareness',
  'growth',
  'authority',
  'conversion',
]);
export const projectStatusSchema = z.enum([
  'inbox',
  'scoping',
  'collecting',
  'analyzing',
  'ready',
  'needs_data',
  'archived',
]);
export const runStatusSchema = z.enum([
  'queued',
  'running',
  'complete',
  'partial',
  'blocked',
  'failed',
]);
export const findingTypeSchema = z.enum([
  'fact',
  'observation',
  'hypothesis',
  'unknown',
]);
export const confidenceSchema = z.enum(['high', 'medium', 'low']);
export const reviewStatusSchema = z.enum([
  'machine_draft',
  'human_confirmed',
  'human_revised',
  'rejected',
]);
export const evidenceRelationSchema = z.enum([
  'supports',
  'contradicts',
  'alternative',
  'calculation_input',
]);
export const sourceTierSchema = z.enum([
  'public',
  'comparative',
  'owner',
  'manual',
]);

export const provenanceSchema = z.object({
  sourceUrl: z.url(),
  externalId: z.string().min(1),
  observedAt: isoDateTimeSchema,
  extractionMethod: z.string().min(1),
  locator: z.string().min(1),
  artifactRef: z.string().min(1).nullable(),
  checksum: z.string().min(1).nullable(),
  verificationState: z.enum(['verified', 'partial', 'unverified']),
  warning: z.string().min(1).nullable(),
});

export const creatorSchema = z.object({
  id: idSchema,
  platform: platformSchema,
  externalId: z.string().min(1),
  handle: z.string().nullable(),
  name: z.string().min(1),
  profileUrl: z.url(),
  firstSeenAt: isoDateTimeSchema,
  lastCollectedAt: isoDateTimeSchema.nullable(),
});

export const contentItemSchema = z.object({
  id: idSchema,
  platform: platformSchema,
  externalId: z.string().min(1),
  creatorId: idSchema.nullable(),
  contentType: z.enum(['image', 'video', 'mixed', 'unknown']),
  sourceUrl: z.url(),
  title: z.string(),
  body: z.string(),
  tags: z.array(z.string()),
  publishedAt: isoDateTimeSchema.nullable(),
  firstSeenAt: isoDateTimeSchema,
  latestSourceArtifactRef: z.string().nullable(),
});

const publicMetricSchema = z.number().int().nonnegative().nullable();
export const metricSnapshotSchema = z.object({
  id: idSchema,
  subjectType: z.enum(['content', 'creator', 'published_content']),
  subjectId: idSchema,
  sourceTier: sourceTierSchema,
  observedAt: isoDateTimeSchema,
  contentAgeHours: z.number().nonnegative().nullable(),
  views: publicMetricSchema,
  likes: publicMetricSchema,
  comments: publicMetricSchema,
  shares: publicMetricSchema,
  bookmarks: publicMetricSchema,
  quotes: publicMetricSchema,
  followersGained: publicMetricSchema,
  profileVisits: publicMetricSchema,
  leads: publicMetricSchema,
  conversions: publicMetricSchema,
  cost: z.number().nonnegative().nullable(),
  rawArtifactRef: z.string().nullable(),
  warnings: z.array(z.string()),
});

export const evidenceItemSchema = z.object({
  id: idSchema,
  contentItemId: idSchema.nullable(),
  creatorId: idSchema.nullable(),
  type: z.enum([
    'source_text',
    'metric',
    'comment',
    'transcript',
    'frame',
    'shot',
    'profile',
    'calculation',
    'manual_note',
  ]),
  sourceTier: sourceTierSchema,
  locator: z.string().min(1),
  excerpt: z.string().nullable(),
  artifactRef: z.string().nullable(),
  checksum: z.string().nullable(),
  observedAt: isoDateTimeSchema,
  payloadVersion: z.literal(1),
  payload: z.record(z.string(), z.unknown()),
});

export const researchProjectSchema = z.object({
  id: idSchema,
  type: projectTypeSchema,
  title: z.string().min(1),
  researchQuestion: z.string().min(1),
  objective: objectiveSchema,
  platformScope: z.array(platformSchema).min(1),
  observationWindow: z.string().nullable(),
  comparabilityRules: z.array(z.string()),
  status: projectStatusSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const projectSampleSchema = z.object({
  projectId: idSchema,
  contentItemId: idSchema,
  role: z.enum([
    'subject',
    'author_baseline',
    'topic_peer',
    'manual_reference',
    'candidate',
  ]),
  cohort: z.enum(['winner', 'middle', 'underperformer', 'unassigned']),
  inclusionReason: z.string().min(1),
  exclusionReason: z.string().nullable(),
  included: z.boolean(),
});

export const analysisRunSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  runType: z.enum(['collect_and_research', 'research_only']),
  status: runStatusSchema,
  schemaVersion: z.literal(1),
  modelVersion: z.string().nullable(),
  inputFingerprint: z.string().min(1),
  startedAt: isoDateTimeSchema.nullable(),
  finishedAt: isoDateTimeSchema.nullable(),
  checkpoint: z.record(z.string(), z.unknown()),
  reportArtifactRef: z.string().nullable(),
  failedStage: z.string().nullable(),
  recoveryAction: z.string().nullable(),
});

export const findingEvidenceSchema = z.object({
  evidenceId: idSchema,
  relation: evidenceRelationSchema,
  weight: z.number().min(0).max(1).nullable(),
  note: z.string().min(1),
});

export const findingSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  sourceRunId: idSchema,
  type: findingTypeSchema,
  dimension: z.string().min(1),
  statement: z.string().min(1),
  confidence: confidenceSchema,
  scope: z.object({
    appliesTo: z.string().min(1),
    limitations: z.array(z.string()).min(1),
  }),
  reviewStatus: reviewStatusSchema,
  supersedesFindingId: idSchema.nullable(),
  evidence: z.array(findingEvidenceSchema).min(1),
  createdAt: isoDateTimeSchema,
});

export const findingRevisionSchema = z.object({
  id: idSchema,
  findingId: idSchema,
  previousStatement: z.string().min(1),
  nextStatement: z.string().min(1),
  previousStatus: reviewStatusSchema,
  nextStatus: reviewStatusSchema.exclude(['machine_draft']),
  reason: z.string().min(1),
  actor: z.string().min(1),
  createdAt: isoDateTimeSchema,
});

export const browserCheckpointSchema = z.object({
  stage: z.enum(['resolve', 'collect_post', 'persist', 'research']),
  canonicalUrl: z.url().nullable(),
  externalId: z.string().nullable(),
  completedStages: z.array(z.string()),
  updatedAt: isoDateTimeSchema,
});

export const collectedPostSchema = z.object({
  canonicalUrl: z.url(),
  externalId: z.string().min(1),
  creator: z.object({
    externalId: z.string().min(1).nullable(),
    name: z.string().min(1),
    profileUrl: z.url().nullable(),
  }),
  contentType: z.enum(['image', 'video', 'mixed', 'unknown']),
  title: z.string(),
  body: z.string(),
  tags: z.array(z.string()),
  publishedAt: isoDateTimeSchema.nullable(),
  metrics: z.object({
    likes: publicMetricSchema,
    comments: publicMetricSchema,
    shares: publicMetricSchema,
    bookmarks: publicMetricSchema,
    views: publicMetricSchema,
  }),
  rawSnapshot: z.string().min(1),
  provenance: provenanceSchema,
  warnings: z.array(z.string()),
});

export type ContentItem = z.infer<typeof contentItemSchema>;
export type MetricSnapshot = z.infer<typeof metricSnapshotSchema>;
export type EvidenceItem = z.infer<typeof evidenceItemSchema>;
export type ResearchProject = z.infer<typeof researchProjectSchema>;
export type AnalysisRun = z.infer<typeof analysisRunSchema>;
export type Finding = z.infer<typeof findingSchema>;
export type FindingRevision = z.infer<typeof findingRevisionSchema>;
export type CollectedPost = z.infer<typeof collectedPostSchema>;
export type BrowserCheckpoint = z.infer<typeof browserCheckpointSchema>;
