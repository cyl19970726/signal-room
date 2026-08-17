import { createHash, randomUUID } from 'node:crypto';
import type { ArtifactStore } from '@signal-room/artifacts';
import {
  BrowserStopError,
  type AuthenticatedBrowserPort,
} from '@signal-room/browser-ego';
import {
  analysisRunSchema,
  findingRevisionSchema,
  runJobSchema,
  type AnalysisRun,
  type CollectedPost,
  type ContentItem,
  type EvidenceItem,
  type MetricSnapshot,
  type ResearchProject,
  type RunJob,
} from '@signal-room/domain';
import { XhsPostCollector } from '@signal-room/platform-xhs';
import {
  researchSinglePost,
  type SinglePostResearchInput,
} from '@signal-room/research-single';
import type { SignalRoomDatabase } from '@signal-room/storage';
import { z } from 'zod';

export interface SignalRoomServiceOptions {
  scheduleRun?: (execute: () => void) => void;
  research?: (
    input: SinglePostResearchInput,
  ) => ReturnType<typeof researchSinglePost>;
  now?: () => string;
  workerId?: string;
  leaseMs?: number;
}

const preparedCheckpointSchema = z.object({
  contentId: z.uuid(),
  sourceTextEvidenceId: z.uuid(),
  metricEvidenceId: z.uuid(),
  metricSnapshotId: z.uuid(),
});

const runStages = ['prepare', 'research', 'finalize'] as const;

export interface IntakePreview {
  contentId: string;
  canonicalUrl: string;
  externalId: string;
  creatorName: string;
  title: string;
  bodyExcerpt: string;
  contentType: string;
  metrics: CollectedPost['metrics'];
  warnings: string[];
  evidenceCoverage: string[];
}

export class SignalRoomService {
  private readonly collector: XhsPostCollector;
  private readonly scheduleRun: (execute: () => void) => void;
  private readonly research: (
    input: SinglePostResearchInput,
  ) => ReturnType<typeof researchSinglePost>;
  private readonly now: () => string;
  private readonly workerId: string;
  private readonly leaseMs: number;

  constructor(
    private readonly database: SignalRoomDatabase,
    private readonly artifacts: ArtifactStore,
    browser: AuthenticatedBrowserPort,
    options: SignalRoomServiceOptions = {},
  ) {
    this.collector = new XhsPostCollector(browser);
    this.scheduleRun = options.scheduleRun ?? queueMicrotask;
    this.research = options.research ?? researchSinglePost;
    this.now = options.now ?? (() => new Date().toISOString());
    this.workerId = options.workerId ?? randomUUID();
    this.leaseMs = options.leaseMs ?? 30_000;
    this.database.reconcileActiveRuns(this.now());
  }

  inspectInput(input: string) {
    return this.collector.resolve(input);
  }

  async resolveAndCollect(input: string): Promise<IntakePreview> {
    const resolved = this.collector.resolve(input);
    if (resolved.type !== 'post' || !resolved.urls[0]) {
      throw new IntakeError(
        resolved.type === 'unknown' ? 'unknown_input' : 'unsupported_input',
        resolved.reason ?? '首条纵向链路目前只接受一个小红书帖子或分享链接。',
      );
    }
    const post = await this.collector.collectPost(resolved.urls[0]);
    const raw = await this.artifacts.put(post.rawSnapshot, 'application/json', {
      platform: 'xiaohongshu',
      externalId: post.externalId,
      sourceUrl: redactUrl(post.canonicalUrl),
      extractionMethod: post.provenance.extractionMethod,
      observedAt: post.provenance.observedAt,
    });
    let creatorId: string | null = null;
    if (post.creator.externalId && post.creator.profileUrl) {
      const creator = this.database.upsertCreator({
        id: randomUUID(),
        platform: 'xiaohongshu',
        externalId: post.creator.externalId,
        handle: null,
        name: post.creator.name,
        profileUrl: post.creator.profileUrl,
        firstSeenAt: post.provenance.observedAt,
        lastCollectedAt: post.provenance.observedAt,
      });
      creatorId = creator.id;
    }
    const content = this.database.upsertContent({
      id: randomUUID(),
      platform: 'xiaohongshu',
      externalId: post.externalId,
      creatorId,
      contentType: post.contentType,
      sourceUrl: post.canonicalUrl,
      title: post.title,
      body: post.body,
      tags: post.tags,
      publishedAt: post.publishedAt,
      firstSeenAt: post.provenance.observedAt,
      latestSourceArtifactRef: raw.ref,
    });
    const metricId = randomUUID();
    this.database.appendMetric({
      id: metricId,
      subjectType: 'content',
      subjectId: content.id,
      sourceTier: 'public',
      observedAt: post.provenance.observedAt,
      contentAgeHours: null,
      views: post.metrics.views,
      likes: post.metrics.likes,
      comments: post.metrics.comments,
      shares: post.metrics.shares,
      bookmarks: post.metrics.bookmarks,
      quotes: null,
      followersGained: null,
      profileVisits: null,
      leads: null,
      conversions: null,
      cost: null,
      rawArtifactRef: raw.ref,
      warnings: post.warnings,
    });
    this.database.insertEvidence({
      id: randomUUID(),
      contentItemId: content.id,
      creatorId,
      type: 'source_text',
      sourceTier: 'public',
      locator: post.provenance.locator,
      excerpt: [post.title, post.body].filter(Boolean).join('\n').slice(0, 800),
      artifactRef: raw.ref,
      checksum: raw.checksum,
      observedAt: post.provenance.observedAt,
      payloadVersion: 1,
      payload: {
        title: post.title,
        body: post.body,
        tags: post.tags,
        verificationState: post.provenance.verificationState,
      },
    });
    this.database.insertEvidence({
      id: randomUUID(),
      contentItemId: content.id,
      creatorId,
      type: 'metric',
      sourceTier: 'public',
      locator: `${post.provenance.locator}:public-metrics`,
      excerpt: null,
      artifactRef: raw.ref,
      checksum: raw.checksum,
      observedAt: post.provenance.observedAt,
      payloadVersion: 1,
      payload: {
        ...post.metrics,
        snapshotId: metricId,
        warnings: post.warnings,
      },
    });
    return {
      contentId: content.id,
      canonicalUrl: content.sourceUrl,
      externalId: content.externalId,
      creatorName: post.creator.name,
      title: content.title,
      bodyExcerpt: content.body.slice(0, 280),
      contentType: content.contentType,
      metrics: post.metrics,
      warnings: post.warnings,
      evidenceCoverage: ['source_text', 'public_metrics'],
    };
  }

  createProject(input: {
    contentId: string;
    objective: ResearchProject['objective'];
    researchQuestion?: string | undefined;
  }): ResearchProject {
    const content = this.database.getContent(input.contentId);
    if (!content)
      throw new IntakeError('content_not_found', '请先完成帖子解析与采集。');
    const now = new Date().toISOString();
    const project: ResearchProject = {
      id: randomUUID(),
      type: 'single_post',
      title: content.title || `小红书单帖 ${content.externalId}`,
      researchQuestion:
        input.researchQuestion?.trim() ||
        '这条内容目前有哪些可验证的公开事实与研究边界？',
      objective: input.objective,
      platformScope: ['xiaohongshu'],
      observationWindow: null,
      comparabilityRules: [],
      status: 'scoping',
      createdAt: now,
      updatedAt: now,
    };
    this.database.insertProject(project);
    this.database.insertProjectSample({
      projectId: project.id,
      contentItemId: content.id,
      role: 'subject',
      cohort: 'unassigned',
      inclusionReason: '用户通过单帖 intake 明确选择为研究对象。',
      exclusionReason: null,
      included: true,
    });
    return project;
  }

  startRun(projectId: string) {
    const subject = this.database.getProjectSubject(projectId);
    if (!subject)
      throw new IntakeError('project_not_found', '研究项目或 subject 不存在。');
    const now = this.now();
    const inputFingerprint = createHash('sha256')
      .update(
        `${projectId}:${subject.externalId}:${subject.latestSourceArtifactRef}`,
      )
      .digest('hex');
    const run = analysisRunSchema.parse({
      id: randomUUID(),
      projectId,
      runType: 'collect_and_research',
      status: 'queued',
      schemaVersion: 1,
      modelVersion: 'deterministic-contract-v1',
      inputFingerprint,
      startedAt: null,
      finishedAt: null,
      checkpoint: {
        stage: 'prepare',
        events: [],
      },
      reportArtifactRef: null,
      failedStage: null,
      recoveryAction: null,
    });
    const jobs = runStages.map((stage, sequence) =>
      runJobSchema.parse({
        id: randomUUID(),
        runId: run.id,
        stage,
        sequence,
        status: 'pending',
        inputFingerprint: createHash('sha256')
          .update(`${inputFingerprint}:${stage}:durable-v1`)
          .digest('hex'),
        attempt: 0,
        checkpoint:
          stage === 'prepare'
            ? {
                contentId: subject.id,
                sourceArtifactRef: subject.latestSourceArtifactRef,
              }
            : {},
        errorCategory: null,
        leaseOwner: null,
        leaseAcquiredAt: null,
        leaseExpiresAt: null,
        heartbeatAt: null,
        startedAt: null,
        finishedAt: null,
        recoveryAction: null,
        updatedAt: now,
      }),
    );
    const created = this.database.createRunWithJobs(run, jobs);
    if (created.created) this.scheduleNextStage(created.run.id);
    return this.database.getRunView(created.run.id)!;
  }

  resumeRun(runId: string) {
    const resumed = this.database.prepareRunForResume(runId, this.now());
    if (!resumed) return null;
    if (resumed.shouldSchedule) this.scheduleNextStage(runId);
    return this.database.getRunView(runId)!;
  }

  private scheduleNextStage(runId: string): void {
    this.scheduleRun(() => this.executeNextStage(runId));
  }

  private executeNextStage(runId: string): void {
    const claimedAt = this.now();
    const job = this.database.claimNextJob(
      runId,
      this.workerId,
      claimedAt,
      new Date(new Date(claimedAt).getTime() + this.leaseMs).toISOString(),
    );
    if (!job) return;
    try {
      switch (job.stage) {
        case 'prepare':
          this.executePrepare(job);
          break;
        case 'research':
          this.executeResearch(job);
          break;
        case 'finalize':
          this.database.completeRun(
            job.id,
            { completedStages: runStages },
            this.now(),
          );
          return;
      }
      this.scheduleNextStage(runId);
    } catch (error) {
      const stop = error instanceof BrowserStopError ? error : null;
      const priorResearchComplete = this.database
        .getJobs(runId)
        .some((candidate) =>
          candidate.stage === 'research'
            ? candidate.status === 'complete'
            : false,
        );
      this.database.failJobAndRun({
        jobId: job.id,
        jobStatus: stop ? 'blocked' : 'failed',
        runStatus: stop
          ? 'blocked'
          : priorResearchComplete
            ? 'partial'
            : 'failed',
        errorCategory: stop?.reason ?? 'stage_error',
        recoveryAction:
          stop?.recoveryAction ??
          `检查 ${job.stage} 阶段的持久 checkpoint 后显式恢复。`,
        diagnostic: {
          name: error instanceof Error ? error.name : 'UnknownError',
          message: error instanceof Error ? error.message : 'Unknown failure',
        },
        now: this.now(),
      });
    }
  }

  private executePrepare(job: RunJob): void {
    const run = this.requiredRun(job.runId);
    const content = this.database.getProjectSubject(run.projectId);
    if (!content) throw new Error('Persisted project subject is missing.');
    const evidence = this.database.getEvidenceForContent(content.id);
    const expectedArtifactRef =
      typeof job.checkpoint.sourceArtifactRef === 'string'
        ? job.checkpoint.sourceArtifactRef
        : null;
    const sourceEvidence = findEvidence(
      evidence,
      'source_text',
      expectedArtifactRef,
    );
    const metricEvidence = findEvidence(
      evidence,
      'metric',
      expectedArtifactRef,
    );
    const metricSnapshotId = metricEvidence?.payload.snapshotId;
    if (
      !sourceEvidence ||
      !metricEvidence ||
      typeof metricSnapshotId !== 'string' ||
      !this.database.getMetric(metricSnapshotId)
    ) {
      throw new Error('Required persisted evidence is missing.');
    }
    this.database.completeJob(
      job.id,
      preparedCheckpointSchema.parse({
        contentId: content.id,
        sourceTextEvidenceId: sourceEvidence.id,
        metricEvidenceId: metricEvidence.id,
        metricSnapshotId,
      }),
      this.now(),
    );
  }

  private executeResearch(job: RunJob): void {
    const run = this.requiredRun(job.runId);
    const prepare = this.database
      .getJobs(job.runId)
      .find((candidate) => candidate.stage === 'prepare');
    if (!prepare || prepare.status !== 'complete') {
      throw new Error('Prepare checkpoint is incomplete.');
    }
    const checkpoint = preparedCheckpointSchema.parse(prepare.checkpoint);
    const content = this.database.getContent(checkpoint.contentId);
    const sourceEvidence = this.database.getEvidence(
      checkpoint.sourceTextEvidenceId,
    );
    const metricEvidence = this.database.getEvidence(
      checkpoint.metricEvidenceId,
    );
    const metric = this.database.getMetric(checkpoint.metricSnapshotId);
    if (!content || !sourceEvidence || !metricEvidence || !metric) {
      throw new Error('Prepared evidence cannot be rehydrated.');
    }
    const post = rehydratePost(content, sourceEvidence, metric);
    const findings = this.research({
      projectId: run.projectId,
      runId: run.id,
      post,
      sourceTextEvidenceId: sourceEvidence.id,
      metricEvidenceId: metricEvidence.id,
    });
    this.database.persistFindingsAndCompleteJob(
      job.id,
      findings,
      {
        sourceTextEvidenceId: sourceEvidence.id,
        metricEvidenceId: metricEvidence.id,
      },
      this.now(),
    );
  }

  private requiredRun(runId: string): AnalysisRun {
    const run = this.database.getRun(runId);
    if (!run) throw new Error('Analysis Run does not exist.');
    return run;
  }

  getProject(id: string) {
    return this.database.getProjectView(id);
  }

  getRun(id: string) {
    return this.database.getRunView(id);
  }

  getEvidence(contentId: string) {
    return this.database.getEvidenceForContent(contentId);
  }

  reviewFinding(input: {
    findingId: string;
    nextStatus: 'human_confirmed' | 'human_revised' | 'rejected';
    nextStatement?: string | undefined;
    reason: string;
    actor: string;
  }) {
    const finding = this.database.getFinding(input.findingId);
    if (!finding)
      throw new IntakeError('finding_not_found', 'Finding 不存在。');
    const revision = findingRevisionSchema.parse({
      id: randomUUID(),
      findingId: finding.id,
      previousStatement: finding.statement,
      nextStatement: input.nextStatement?.trim() || finding.statement,
      previousStatus: finding.reviewStatus,
      nextStatus: input.nextStatus,
      reason: input.reason,
      actor: input.actor,
      createdAt: new Date().toISOString(),
    });
    this.database.reviewFinding(revision);
    return revision;
  }
}

function findEvidence(
  evidence: EvidenceItem[],
  type: EvidenceItem['type'],
  artifactRef: string | null,
): EvidenceItem | undefined {
  const typed = evidence.filter((item) => item.type === type);
  return typed.find((item) => item.artifactRef === artifactRef) ?? typed.at(-1);
}

function rehydratePost(
  content: ContentItem,
  sourceEvidence: EvidenceItem,
  metric: MetricSnapshot,
): CollectedPost {
  const title = stringPayload(sourceEvidence.payload.title) ?? content.title;
  const body = stringPayload(sourceEvidence.payload.body) ?? content.body;
  const tags = Array.isArray(sourceEvidence.payload.tags)
    ? sourceEvidence.payload.tags.filter(
        (tag): tag is string => typeof tag === 'string',
      )
    : content.tags;
  return {
    canonicalUrl: content.sourceUrl,
    externalId: content.externalId,
    creator: { externalId: null, name: '见来源证据', profileUrl: null },
    contentType: content.contentType,
    title,
    body,
    tags,
    publishedAt: content.publishedAt,
    metrics: {
      likes: metric.likes,
      comments: metric.comments,
      shares: metric.shares,
      bookmarks: metric.bookmarks,
      views: metric.views,
    },
    rawSnapshot: '{}',
    provenance: {
      sourceUrl: content.sourceUrl,
      externalId: content.externalId,
      observedAt: metric.observedAt,
      extractionMethod: 'persisted-evidence',
      locator: sourceEvidence.locator,
      artifactRef: sourceEvidence.artifactRef,
      checksum: sourceEvidence.checksum,
      verificationState: 'verified',
      warning: metric.warnings.join(' ') || null,
    },
    warnings: metric.warnings,
  };
}

function stringPayload(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export class IntakeError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'IntakeError';
  }
}

function redactUrl(value: string): string {
  const url = new URL(value);
  url.search = '';
  url.hash = '';
  return url.toString();
}
