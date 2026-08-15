import { createHash, randomUUID } from 'node:crypto';
import type { ArtifactStore } from '@signal-room/artifacts';
import {
  BrowserStopError,
  type AuthenticatedBrowserPort,
} from '@signal-room/browser-ego';
import {
  analysisRunSchema,
  findingRevisionSchema,
  type AnalysisRun,
  type CollectedPost,
  type ResearchProject,
} from '@signal-room/domain';
import { XhsPostCollector } from '@signal-room/platform-xhs';
import {
  researchSinglePost,
  type SinglePostResearchInput,
} from '@signal-room/research-single';
import type { SignalRoomDatabase } from '@signal-room/storage';

export interface SignalRoomServiceOptions {
  scheduleRun?: (execute: () => void) => void;
  research?: (
    input: SinglePostResearchInput,
  ) => ReturnType<typeof researchSinglePost>;
}

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

  constructor(
    private readonly database: SignalRoomDatabase,
    private readonly artifacts: ArtifactStore,
    browser: AuthenticatedBrowserPort,
    options: SignalRoomServiceOptions = {},
  ) {
    this.collector = new XhsPostCollector(browser);
    this.scheduleRun = options.scheduleRun ?? queueMicrotask;
    this.research = options.research ?? researchSinglePost;
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

  startRun(projectId: string): AnalysisRun {
    const subject = this.database.getProjectSubject(projectId);
    if (!subject)
      throw new IntakeError('project_not_found', '研究项目或 subject 不存在。');
    const run = analysisRunSchema.parse({
      id: randomUUID(),
      projectId,
      runType: 'collect_and_research',
      status: 'queued',
      schemaVersion: 1,
      modelVersion: 'deterministic-contract-v1',
      inputFingerprint: createHash('sha256')
        .update(
          `${projectId}:${subject.externalId}:${subject.latestSourceArtifactRef}`,
        )
        .digest('hex'),
      startedAt: null,
      finishedAt: null,
      checkpoint: {
        stage: 'queued',
        events: [{ stage: 'queued', status: 'complete' }],
      },
      reportArtifactRef: null,
      failedStage: null,
      recoveryAction: null,
    });
    this.database.insertRun(run);
    this.scheduleRun(() => this.executeResearchRun(run.id));
    return run;
  }

  private executeResearchRun(runId: string): void {
    const run = this.database.getRun(runId);
    if (!run) return;
    const startedAt = new Date().toISOString();
    const running: AnalysisRun = {
      ...run,
      status: 'running',
      startedAt,
      checkpoint: {
        stage: 'research',
        events: [
          { stage: 'queued', status: 'complete' },
          { stage: 'persisted_source', status: 'complete' },
          { stage: 'research', status: 'running' },
        ],
      },
    };
    this.database.updateRun(running);
    this.database.updateProjectStatus(run.projectId, 'analyzing');
    try {
      const content = this.database.getProjectSubject(run.projectId);
      if (!content) throw new Error('Persisted project subject is missing.');
      const metric = this.database.getLatestMetric(content.id);
      const evidence = this.database.getEvidenceForContent(content.id);
      const sourceEvidence = evidence.find(
        (item) => item.type === 'source_text',
      );
      const metricEvidence = evidence.find((item) => item.type === 'metric');
      if (!sourceEvidence || !metricEvidence)
        throw new Error('Required source evidence is missing.');
      const post: CollectedPost = {
        canonicalUrl: content.sourceUrl,
        externalId: content.externalId,
        creator: { externalId: null, name: '见来源证据', profileUrl: null },
        contentType: content.contentType,
        title: content.title,
        body: content.body,
        tags: content.tags,
        publishedAt: content.publishedAt,
        metrics: {
          likes: metric?.likes ?? null,
          comments: metric?.comments ?? null,
          shares: metric?.shares ?? null,
          bookmarks: metric?.bookmarks ?? null,
          views: metric?.views ?? null,
        },
        rawSnapshot: '{}',
        provenance: {
          sourceUrl: content.sourceUrl,
          externalId: content.externalId,
          observedAt: metric?.observedAt ?? content.firstSeenAt,
          extractionMethod: 'persisted-evidence',
          locator: sourceEvidence.locator,
          artifactRef: sourceEvidence.artifactRef,
          checksum: sourceEvidence.checksum,
          verificationState: 'verified',
          warning: metric?.warnings.join(' ') || null,
        },
        warnings: metric?.warnings ?? [],
      };
      for (const finding of this.research({
        projectId: run.projectId,
        runId,
        post,
        sourceTextEvidenceId: sourceEvidence.id,
        metricEvidenceId: metricEvidence.id,
      })) {
        this.database.insertFinding(finding);
      }
      this.database.updateRun({
        ...running,
        status: 'complete',
        finishedAt: new Date().toISOString(),
        checkpoint: {
          stage: 'complete',
          events: [
            { stage: 'queued', status: 'complete' },
            { stage: 'persisted_source', status: 'complete' },
            { stage: 'research', status: 'complete' },
          ],
        },
      });
      this.database.updateProjectStatus(run.projectId, 'ready');
    } catch (error) {
      const stop = error instanceof BrowserStopError ? error : null;
      this.database.updateRun({
        ...running,
        status: stop ? 'blocked' : 'partial',
        finishedAt: new Date().toISOString(),
        failedStage: 'research',
        recoveryAction:
          stop?.recoveryAction ?? '检查已持久化证据后重试研究阶段。',
        checkpoint: {
          stage: 'research',
          events: [{ stage: 'research', status: stop ? 'blocked' : 'partial' }],
        },
      });
      this.database.updateProjectStatus(run.projectId, 'needs_data');
    }
  }

  getProject(id: string) {
    return this.database.getProjectView(id);
  }

  getRun(id: string) {
    return this.database.getRun(id);
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
