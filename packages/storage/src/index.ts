import Database from 'better-sqlite3';
import {
  analysisRunSchema,
  contentItemSchema,
  creatorSchema,
  evidenceItemSchema,
  findingRevisionSchema,
  findingSchema,
  metricSnapshotSchema,
  projectSampleSchema,
  researchProjectSchema,
  runJobSchema,
  type AnalysisRun,
  type ContentItem,
  type Creator,
  type EvidenceItem,
  type Finding,
  type FindingRevision,
  type MetricSnapshot,
  type ResearchProject,
  type RunJob,
} from '@signal-room/domain';
import { migrations } from './migrations.js';

const json = JSON.stringify;

export interface CreateRunResult {
  run: AnalysisRun;
  created: boolean;
}

export interface ResumeRunResult {
  run: AnalysisRun;
  shouldSchedule: boolean;
}

export type RecoverableRunStatus =
  'interrupted' | 'partial' | 'blocked' | 'failed';

const recoverableRunStatuses = new Set<AnalysisRun['status']>([
  'interrupted',
  'partial',
  'blocked',
  'failed',
]);

export class SignalRoomDatabase {
  readonly db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)',
    );
    const applied = this.db
      .prepare('SELECT version FROM schema_migrations')
      .all() as {
      version: number;
    }[];
    const versions = new Set(applied.map((row) => row.version));
    for (const migration of migrations) {
      if (versions.has(migration.version)) continue;
      this.db.transaction(() => {
        this.db.exec(migration.sql);
        this.db
          .prepare(
            'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)',
          )
          .run(migration.version, new Date().toISOString());
      })();
    }
  }

  close(): void {
    this.db.close();
  }

  upsertContent(item: ContentItem): ContentItem {
    const value = contentItemSchema.parse(item);
    this.db
      .prepare(
        `
        INSERT INTO content_items VALUES (
          @id, @platform, @externalId, @creatorId, @contentType, @sourceUrl,
          @title, @body, @tagsJson, @publishedAt, @firstSeenAt, @latestSourceArtifactRef
        ) ON CONFLICT(platform, external_id) DO UPDATE SET
          creator_id=excluded.creator_id, content_type=excluded.content_type,
          source_url=excluded.source_url, title=excluded.title, body=excluded.body,
          tags_json=excluded.tags_json, published_at=excluded.published_at,
          latest_source_artifact_ref=excluded.latest_source_artifact_ref
      `,
      )
      .run({ ...value, tagsJson: json(value.tags) });
    return this.getContentByExternalId(value.externalId)!;
  }

  upsertCreator(creator: Creator): Creator {
    const value = creatorSchema.parse(creator);
    this.db
      .prepare(
        `
        INSERT INTO creators VALUES (
          @id, @platform, @externalId, @handle, @name, @profileUrl,
          @firstSeenAt, @lastCollectedAt
        ) ON CONFLICT(platform, external_id) DO UPDATE SET
          handle=excluded.handle, name=excluded.name, profile_url=excluded.profile_url,
          last_collected_at=excluded.last_collected_at
      `,
      )
      .run(value);
    const row = this.db
      .prepare('SELECT * FROM creators WHERE platform=? AND external_id=?')
      .get(value.platform, value.externalId) as Record<string, unknown>;
    return creatorSchema.parse({
      id: row.id,
      platform: row.platform,
      externalId: row.external_id,
      handle: row.handle,
      name: row.name,
      profileUrl: row.profile_url,
      firstSeenAt: row.first_seen_at,
      lastCollectedAt: row.last_collected_at,
    });
  }

  getContentByExternalId(externalId: string): ContentItem | null {
    const row = this.db
      .prepare('SELECT * FROM content_items WHERE platform=? AND external_id=?')
      .get('xiaohongshu', externalId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return contentItemSchema.parse({
      id: row.id,
      platform: row.platform,
      externalId: row.external_id,
      creatorId: row.creator_id,
      contentType: row.content_type,
      sourceUrl: row.source_url,
      title: row.title,
      body: row.body,
      tags: JSON.parse(String(row.tags_json)),
      publishedAt: row.published_at,
      firstSeenAt: row.first_seen_at,
      latestSourceArtifactRef: row.latest_source_artifact_ref,
    });
  }

  getContent(id: string): ContentItem | null {
    const external = this.db
      .prepare('SELECT external_id FROM content_items WHERE id=?')
      .get(id) as { external_id: string } | undefined;
    return external ? this.getContentByExternalId(external.external_id) : null;
  }

  getLatestMetric(subjectId: string): MetricSnapshot | null {
    const row = this.db
      .prepare(
        'SELECT * FROM metric_snapshots WHERE subject_id=? ORDER BY observed_at DESC LIMIT 1',
      )
      .get(subjectId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return metricSnapshotSchema.parse({
      id: row.id,
      subjectType: row.subject_type,
      subjectId: row.subject_id,
      sourceTier: row.source_tier,
      observedAt: row.observed_at,
      contentAgeHours: row.content_age_hours,
      views: row.views,
      likes: row.likes,
      comments: row.comments,
      shares: row.shares,
      bookmarks: row.bookmarks,
      quotes: row.quotes,
      followersGained: row.followers_gained,
      profileVisits: row.profile_visits,
      leads: row.leads,
      conversions: row.conversions,
      cost: row.cost,
      rawArtifactRef: row.raw_artifact_ref,
      warnings: JSON.parse(String(row.warnings_json)),
    });
  }

  getEvidenceForContent(contentItemId: string): EvidenceItem[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM evidence_items WHERE content_item_id=? ORDER BY observed_at',
      )
      .all(contentItemId) as Record<string, unknown>[];
    return rows.map((row) =>
      evidenceItemSchema.parse({
        id: row.id,
        contentItemId: row.content_item_id,
        creatorId: row.creator_id,
        type: row.type,
        sourceTier: row.source_tier,
        locator: row.locator,
        excerpt: row.excerpt,
        artifactRef: row.artifact_ref,
        checksum: row.checksum,
        observedAt: row.observed_at,
        payloadVersion: row.payload_version,
        payload: JSON.parse(String(row.payload_json)),
      }),
    );
  }

  getEvidence(id: string): EvidenceItem | null {
    const row = this.db
      .prepare('SELECT * FROM evidence_items WHERE id=?')
      .get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return evidenceItemSchema.parse({
      id: row.id,
      contentItemId: row.content_item_id,
      creatorId: row.creator_id,
      type: row.type,
      sourceTier: row.source_tier,
      locator: row.locator,
      excerpt: row.excerpt,
      artifactRef: row.artifact_ref,
      checksum: row.checksum,
      observedAt: row.observed_at,
      payloadVersion: row.payload_version,
      payload: JSON.parse(String(row.payload_json)),
    });
  }

  getProjectSubject(projectId: string): ContentItem | null {
    const row = this.db
      .prepare(
        `SELECT c.external_id FROM project_samples ps
         JOIN content_items c ON c.id=ps.content_item_id
         WHERE ps.project_id=? AND ps.role='subject' AND ps.included=1 LIMIT 1`,
      )
      .get(projectId) as { external_id: string } | undefined;
    return row ? this.getContentByExternalId(row.external_id) : null;
  }

  getRun(id: string): AnalysisRun | null {
    const row = this.db
      .prepare('SELECT * FROM analysis_runs WHERE id=?')
      .get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return analysisRunSchema.parse({
      id: row.id,
      projectId: row.project_id,
      runType: row.run_type,
      status: row.status,
      schemaVersion: row.schema_version,
      modelVersion: row.model_version,
      inputFingerprint: row.input_fingerprint,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      checkpoint: JSON.parse(String(row.checkpoint_json)),
      reportArtifactRef: row.report_artifact_ref,
      failedStage: row.failed_stage,
      recoveryAction: row.recovery_action,
    });
  }

  getRunByFingerprint(
    projectId: string,
    inputFingerprint: string,
  ): AnalysisRun | null {
    const row = this.db
      .prepare(
        `SELECT id FROM analysis_runs
         WHERE project_id=? AND run_type='collect_and_research' AND input_fingerprint=?
         ORDER BY rowid LIMIT 1`,
      )
      .get(projectId, inputFingerprint) as { id: string } | undefined;
    return row ? this.getRun(row.id) : null;
  }

  getJobs(runId: string): RunJob[] {
    const rows = this.db
      .prepare('SELECT * FROM jobs WHERE run_id=? ORDER BY sequence, rowid')
      .all(runId) as Record<string, unknown>[];
    return rows.map((row) => this.hydrateJob(row));
  }

  getJob(id: string): RunJob | null {
    const row = this.db.prepare('SELECT * FROM jobs WHERE id=?').get(id) as
      Record<string, unknown> | undefined;
    return row ? this.hydrateJob(row) : null;
  }

  createRunWithJobs(run: AnalysisRun, jobs: RunJob[]): CreateRunResult {
    const value = analysisRunSchema.parse(run);
    const jobValues = jobs.map((job) => runJobSchema.parse(job));
    if (jobValues.some((job) => job.runId !== value.id)) {
      throw new Error('All jobs must belong to the Run being created.');
    }
    return this.db.transaction(() => {
      const existing = this.getRunByFingerprint(
        value.projectId,
        value.inputFingerprint,
      );
      if (existing) return { run: existing, created: false };
      this.insertRun(value);
      const statement = this.db.prepare(
        `INSERT INTO jobs (
          id, run_id, stage, status, input_fingerprint, checkpoint_json,
          error_json, updated_at, sequence, attempt, error_category,
          lease_owner, lease_acquired_at, lease_expires_at, heartbeat_at,
          started_at, finished_at, recovery_action
        ) VALUES (
          @id, @runId, @stage, @status, @inputFingerprint, @checkpointJson,
          NULL, @updatedAt, @sequence, @attempt, @errorCategory,
          @leaseOwner, @leaseAcquiredAt, @leaseExpiresAt, @heartbeatAt,
          @startedAt, @finishedAt, @recoveryAction
        )`,
      );
      for (const job of jobValues) {
        statement.run({
          ...job,
          checkpointJson: json(job.checkpoint),
        });
      }
      this.updateRunCheckpoint(value.id, 'prepare');
      return { run: this.getRun(value.id)!, created: true };
    })();
  }

  reconcileActiveRuns(now: string): number {
    return this.db.transaction(() => {
      const rows = this.db
        .prepare(
          `SELECT id, project_id FROM analysis_runs
           WHERE status IN ('queued', 'running')`,
        )
        .all() as { id: string; project_id: string }[];
      for (const row of rows) {
        const running = this.db
          .prepare(
            `SELECT id, stage FROM jobs
             WHERE run_id=? AND status='running'
             ORDER BY sequence LIMIT 1`,
          )
          .get(row.id) as { id: string; stage: string } | undefined;
        const pending = this.db
          .prepare(
            `SELECT stage FROM jobs
             WHERE run_id=? AND status='pending'
             ORDER BY sequence LIMIT 1`,
          )
          .get(row.id) as { stage: string } | undefined;
        if (running) {
          this.db
            .prepare(
              `UPDATE jobs SET status='interrupted', error_category='process_interrupted',
               error_json=?, lease_owner=NULL, lease_acquired_at=NULL,
               lease_expires_at=NULL, heartbeat_at=?, finished_at=?,
               recovery_action=?, updated_at=? WHERE id=?`,
            )
            .run(
              json({ category: 'process_interrupted' }),
              now,
              now,
              '确认旧进程已停止后，显式恢复该 Run。',
              now,
              running.id,
            );
        }
        const failedStage = running?.stage ?? pending?.stage ?? null;
        this.db
          .prepare(
            `UPDATE analysis_runs SET status='interrupted', finished_at=?,
             failed_stage=?, recovery_action=? WHERE id=?`,
          )
          .run(
            now,
            failedStage,
            '检测到 API 进程重建；请核对已提交阶段后显式恢复。',
            row.id,
          );
        this.updateRunCheckpoint(row.id, failedStage ?? 'interrupted');
        this.updateProjectStatusAt(row.project_id, 'needs_data', now);
      }
      return rows.length;
    })();
  }

  claimNextJob(
    runId: string,
    leaseOwner: string,
    now: string,
    leaseExpiresAt: string,
  ): RunJob | null {
    return this.db.transaction(() => {
      const run = this.getRun(runId);
      if (!run || !['queued', 'running'].includes(run.status)) return null;
      const candidate = this.db
        .prepare(
          `SELECT id FROM jobs WHERE run_id=? AND status='pending'
           ORDER BY sequence, rowid LIMIT 1`,
        )
        .get(runId) as { id: string } | undefined;
      if (!candidate) return null;
      const claimed = this.db
        .prepare(
          `UPDATE jobs SET status='running', attempt=attempt+1,
           lease_owner=?, lease_acquired_at=?, lease_expires_at=?,
           heartbeat_at=?, started_at=COALESCE(started_at, ?), finished_at=NULL,
           error_category=NULL, error_json=NULL, recovery_action=NULL, updated_at=?
           WHERE id=? AND status='pending'`,
        )
        .run(leaseOwner, now, leaseExpiresAt, now, now, now, candidate.id);
      if (claimed.changes !== 1) return null;
      const job = this.getJob(candidate.id)!;
      this.db
        .prepare(
          `UPDATE analysis_runs SET status='running',
           started_at=COALESCE(started_at, ?), finished_at=NULL,
           failed_stage=NULL, recovery_action=NULL WHERE id=?`,
        )
        .run(now, runId);
      this.updateRunCheckpoint(runId, job.stage);
      this.updateProjectStatusAt(run.projectId, 'analyzing', now);
      return job;
    })();
  }

  heartbeatJob(
    jobId: string,
    leaseOwner: string,
    heartbeatAt: string,
    leaseExpiresAt: string,
  ): boolean {
    const result = this.db
      .prepare(
        `UPDATE jobs SET heartbeat_at=?, lease_expires_at=?, updated_at=?
         WHERE id=? AND status='running' AND lease_owner=?`,
      )
      .run(heartbeatAt, leaseExpiresAt, heartbeatAt, jobId, leaseOwner);
    return result.changes === 1;
  }

  completeJob(jobId: string, checkpoint: Record<string, unknown>, now: string) {
    return this.db.transaction(() => {
      const job = this.getJob(jobId);
      if (!job) throw new Error('Run job does not exist.');
      this.completeJobUnsafe(jobId, checkpoint, now);
      this.updateRunCheckpoint(
        job.runId,
        this.nextStageOr(job.runId, job.stage),
      );
      return this.getJob(jobId)!;
    })();
  }

  persistFindingsAndCompleteJob(
    jobId: string,
    findings: Finding[],
    checkpoint: Record<string, unknown>,
    now: string,
  ): string[] {
    return this.db.transaction(() => {
      const job = this.getJob(jobId);
      if (!job) throw new Error('Run job does not exist.');
      const findingIds = findings.map((finding) =>
        this.insertFindingIdempotentUnsafe(finding),
      );
      this.completeJobUnsafe(
        jobId,
        { ...checkpoint, findingIds, findingCount: findingIds.length },
        now,
      );
      this.updateRunCheckpoint(
        job.runId,
        this.nextStageOr(job.runId, job.stage),
      );
      return findingIds;
    })();
  }

  completeRun(
    jobId: string,
    checkpoint: Record<string, unknown>,
    now: string,
  ): AnalysisRun {
    return this.db.transaction(() => {
      const job = this.getJob(jobId);
      if (!job) throw new Error('Run job does not exist.');
      const run = this.getRun(job.runId);
      if (!run) throw new Error('Analysis Run does not exist.');
      const incompletePrior = this.db
        .prepare(
          `SELECT COUNT(*) count FROM jobs
           WHERE run_id=? AND sequence<? AND status!='complete'`,
        )
        .get(job.runId, job.sequence) as { count: number };
      if (incompletePrior.count > 0) {
        throw new Error('Cannot finalize a Run with incomplete prior stages.');
      }
      this.completeJobUnsafe(jobId, checkpoint, now);
      this.db
        .prepare(
          `UPDATE analysis_runs SET status='complete', finished_at=?,
           failed_stage=NULL, recovery_action=NULL WHERE id=?`,
        )
        .run(now, run.id);
      this.updateRunCheckpoint(run.id, 'complete');
      this.updateProjectStatusAt(run.projectId, 'ready', now);
      return this.getRun(run.id)!;
    })();
  }

  failJobAndRun(input: {
    jobId: string;
    jobStatus: 'blocked' | 'failed';
    runStatus: 'partial' | 'blocked' | 'failed';
    errorCategory: string;
    recoveryAction: string;
    diagnostic: Record<string, unknown>;
    now: string;
  }): AnalysisRun {
    return this.db.transaction(() => {
      const job = this.getJob(input.jobId);
      if (!job) throw new Error('Run job does not exist.');
      const run = this.getRun(job.runId);
      if (!run) throw new Error('Analysis Run does not exist.');
      this.db
        .prepare(
          `UPDATE jobs SET status=?, error_category=?, error_json=?,
           lease_owner=NULL, lease_acquired_at=NULL, lease_expires_at=NULL,
           heartbeat_at=?, finished_at=?, recovery_action=?, updated_at=?
           WHERE id=?`,
        )
        .run(
          input.jobStatus,
          input.errorCategory,
          json(input.diagnostic),
          input.now,
          input.now,
          input.recoveryAction,
          input.now,
          job.id,
        );
      this.db
        .prepare(
          `UPDATE analysis_runs SET status=?, finished_at=?, failed_stage=?,
           recovery_action=? WHERE id=?`,
        )
        .run(
          input.runStatus,
          input.now,
          job.stage,
          input.recoveryAction,
          run.id,
        );
      this.updateRunCheckpoint(run.id, job.stage);
      this.updateProjectStatusAt(run.projectId, 'needs_data', input.now);
      return this.getRun(run.id)!;
    })();
  }

  prepareRunForResume(runId: string, now: string): ResumeRunResult | null {
    return this.db.transaction(() => {
      const run = this.getRun(runId);
      if (!run) return null;
      if (!recoverableRunStatuses.has(run.status)) {
        return { run, shouldSchedule: false };
      }
      const recoverableJob = this.db
        .prepare(
          `SELECT id FROM jobs
           WHERE run_id=? AND status IN ('interrupted', 'blocked', 'failed')
           ORDER BY sequence, rowid LIMIT 1`,
        )
        .get(runId) as { id: string } | undefined;
      if (recoverableJob) {
        this.db
          .prepare(
            `UPDATE jobs SET status='pending', error_category=NULL,
             error_json=NULL, lease_owner=NULL, lease_acquired_at=NULL,
             lease_expires_at=NULL, heartbeat_at=NULL, finished_at=NULL,
             recovery_action=NULL, updated_at=? WHERE id=?`,
          )
          .run(now, recoverableJob.id);
      }
      const pending = this.db
        .prepare(
          `SELECT stage FROM jobs WHERE run_id=? AND status='pending'
           ORDER BY sequence, rowid LIMIT 1`,
        )
        .get(runId) as { stage: string } | undefined;
      if (!pending) return { run, shouldSchedule: false };
      this.db
        .prepare(
          `UPDATE analysis_runs SET status='queued', finished_at=NULL,
           failed_stage=NULL, recovery_action=NULL WHERE id=?`,
        )
        .run(runId);
      this.updateRunCheckpoint(runId, pending.stage);
      this.updateProjectStatusAt(run.projectId, 'analyzing', now);
      return { run: this.getRun(runId)!, shouldSchedule: true };
    })();
  }

  isRunRecoverable(runId: string): boolean {
    const run = this.getRun(runId);
    return Boolean(run && recoverableRunStatuses.has(run.status));
  }

  getMetric(id: string): MetricSnapshot | null {
    const row = this.db
      .prepare('SELECT * FROM metric_snapshots WHERE id=?')
      .get(id) as Record<string, unknown> | undefined;
    return row ? this.hydrateMetric(row) : null;
  }

  appendMetric(snapshot: MetricSnapshot): void {
    const value = metricSnapshotSchema.parse(snapshot);
    this.db
      .prepare(
        `INSERT INTO metric_snapshots VALUES (
        @id, @subjectType, @subjectId, @sourceTier, @observedAt, @contentAgeHours,
        @views, @likes, @comments, @shares, @bookmarks, @quotes,
        @followersGained, @profileVisits, @leads, @conversions, @cost,
        @rawArtifactRef, @warningsJson
      )`,
      )
      .run({ ...value, warningsJson: json(value.warnings) });
  }

  insertEvidence(evidence: EvidenceItem): void {
    const value = evidenceItemSchema.parse(evidence);
    this.db
      .prepare(
        `INSERT INTO evidence_items VALUES (
        @id, @contentItemId, @creatorId, @type, @sourceTier, @locator,
        @excerpt, @artifactRef, @checksum, @observedAt, @payloadVersion, @payloadJson
      )`,
      )
      .run({ ...value, payloadJson: json(value.payload) });
  }

  insertProject(project: ResearchProject): void {
    const value = researchProjectSchema.parse(project);
    this.db
      .prepare(
        `INSERT INTO research_projects VALUES (
        @id, @type, @title, @researchQuestion, @objective, @platformScopeJson,
        @observationWindow, @comparabilityRulesJson, @status, @createdAt, @updatedAt
      )`,
      )
      .run({
        ...value,
        platformScopeJson: json(value.platformScope),
        comparabilityRulesJson: json(value.comparabilityRules),
      });
  }

  updateProjectStatus(id: string, status: ResearchProject['status']): void {
    this.db
      .prepare('UPDATE research_projects SET status=?, updated_at=? WHERE id=?')
      .run(status, new Date().toISOString(), id);
  }

  insertProjectSample(sample: unknown): void {
    const value = projectSampleSchema.parse(sample);
    this.db
      .prepare(
        'INSERT OR IGNORE INTO project_samples VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        value.projectId,
        value.contentItemId,
        value.role,
        value.cohort,
        value.inclusionReason,
        value.exclusionReason,
        value.included ? 1 : 0,
      );
  }

  insertRun(run: AnalysisRun): void {
    const value = analysisRunSchema.parse(run);
    this.db
      .prepare(
        `INSERT INTO analysis_runs VALUES (
        @id, @projectId, @runType, @status, @schemaVersion, @modelVersion,
        @inputFingerprint, @startedAt, @finishedAt, @checkpointJson,
        @reportArtifactRef, @failedStage, @recoveryAction
      )`,
      )
      .run({ ...value, checkpointJson: json(value.checkpoint) });
  }

  updateRun(run: AnalysisRun): void {
    const value = analysisRunSchema.parse(run);
    this.db
      .prepare(
        `UPDATE analysis_runs SET status=@status, started_at=@startedAt,
        finished_at=@finishedAt, checkpoint_json=@checkpointJson,
        report_artifact_ref=@reportArtifactRef, failed_stage=@failedStage,
        recovery_action=@recoveryAction WHERE id=@id`,
      )
      .run({ ...value, checkpointJson: json(value.checkpoint) });
  }

  insertFinding(finding: Finding): void {
    const value = findingSchema.parse(finding);
    this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO findings VALUES (
          @id, @projectId, @sourceRunId, @type, @dimension, @statement,
          @confidence, @scopeJson, @reviewStatus, @supersedesFindingId, @createdAt
        )`,
        )
        .run({ ...value, scopeJson: json(value.scope) });
      const statement = this.db.prepare(
        'INSERT INTO finding_evidence VALUES (?, ?, ?, ?, ?)',
      );
      for (const relation of value.evidence) {
        statement.run(
          value.id,
          relation.evidenceId,
          relation.relation,
          relation.weight,
          relation.note,
        );
      }
    })();
  }

  getFinding(id: string): Finding | null {
    const row = this.db.prepare('SELECT * FROM findings WHERE id=?').get(id) as
      Record<string, unknown> | undefined;
    if (!row) return null;
    const evidence = this.db
      .prepare('SELECT * FROM finding_evidence WHERE finding_id=?')
      .all(id) as Record<string, unknown>[];
    return findingSchema.parse({
      id: row.id,
      projectId: row.project_id,
      sourceRunId: row.source_run_id,
      type: row.type,
      dimension: row.dimension,
      statement: row.statement,
      confidence: row.confidence,
      scope: JSON.parse(String(row.scope_json)),
      reviewStatus: row.review_status,
      supersedesFindingId: row.supersedes_finding_id,
      evidence: evidence.map((relation) => ({
        evidenceId: relation.evidence_id,
        relation: relation.relation,
        weight: relation.weight,
        note: relation.note,
      })),
      createdAt: row.created_at,
    });
  }

  reviewFinding(revision: FindingRevision): void {
    const value = findingRevisionSchema.parse(revision);
    this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO finding_revisions VALUES (
          @id, @findingId, @previousStatement, @nextStatement, @previousStatus,
          @nextStatus, @reason, @actor, @createdAt
        )`,
        )
        .run(value);
      this.db
        .prepare('UPDATE findings SET statement=?, review_status=? WHERE id=?')
        .run(value.nextStatement, value.nextStatus, value.findingId);
    })();
  }

  getProjectView(projectId: string): Record<string, unknown> | null {
    const project = this.db
      .prepare('SELECT * FROM research_projects WHERE id=?')
      .get(projectId) as Record<string, unknown> | undefined;
    if (!project) return null;
    const samples = this.db
      .prepare(
        `SELECT ps.*, c.* FROM project_samples ps
        JOIN content_items c ON c.id=ps.content_item_id WHERE ps.project_id=?`,
      )
      .all(projectId);
    const findings = this.db
      .prepare('SELECT * FROM findings WHERE project_id=? ORDER BY created_at')
      .all(projectId) as Record<string, unknown>[];
    const hydratedFindings = findings.map((finding) => ({
      ...finding,
      scope: JSON.parse(String(finding.scope_json)),
      evidence: this.db
        .prepare(
          `SELECT fe.*, e.type, e.locator, e.excerpt, e.payload_json
          FROM finding_evidence fe JOIN evidence_items e ON e.id=fe.evidence_id
          WHERE fe.finding_id=?`,
        )
        .all(finding.id),
    }));
    const latestRunRow = this.db
      .prepare(
        'SELECT id FROM analysis_runs WHERE project_id=? ORDER BY rowid DESC LIMIT 1',
      )
      .get(projectId) as { id: string } | undefined;
    const latestRun = latestRunRow ? this.getRunView(latestRunRow.id) : null;
    return { project, samples, findings: hydratedFindings, latestRun };
  }

  getRunView(runId: string) {
    const run = this.getRun(runId);
    if (!run) return null;
    return {
      ...run,
      jobs: this.getJobs(runId).map((job) => ({
        id: job.id,
        stage: job.stage,
        sequence: job.sequence,
        status: job.status,
        inputFingerprint: job.inputFingerprint,
        attempt: job.attempt,
        checkpoint: job.checkpoint,
        errorCategory: job.errorCategory,
        leaseAcquiredAt: job.leaseAcquiredAt,
        leaseExpiresAt: job.leaseExpiresAt,
        heartbeatAt: job.heartbeatAt,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        recoveryAction: job.recoveryAction,
        updatedAt: job.updatedAt,
      })),
      recoverable: recoverableRunStatuses.has(run.status),
    };
  }

  private hydrateJob(row: Record<string, unknown>): RunJob {
    return runJobSchema.parse({
      id: row.id,
      runId: row.run_id,
      stage: row.stage,
      sequence: row.sequence,
      status: row.status,
      inputFingerprint: row.input_fingerprint,
      attempt: row.attempt,
      checkpoint: JSON.parse(String(row.checkpoint_json)),
      errorCategory: row.error_category,
      leaseOwner: row.lease_owner,
      leaseAcquiredAt: row.lease_acquired_at,
      leaseExpiresAt: row.lease_expires_at,
      heartbeatAt: row.heartbeat_at,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      recoveryAction: row.recovery_action,
      updatedAt: row.updated_at,
    });
  }

  private hydrateMetric(row: Record<string, unknown>): MetricSnapshot {
    return metricSnapshotSchema.parse({
      id: row.id,
      subjectType: row.subject_type,
      subjectId: row.subject_id,
      sourceTier: row.source_tier,
      observedAt: row.observed_at,
      contentAgeHours: row.content_age_hours,
      views: row.views,
      likes: row.likes,
      comments: row.comments,
      shares: row.shares,
      bookmarks: row.bookmarks,
      quotes: row.quotes,
      followersGained: row.followers_gained,
      profileVisits: row.profile_visits,
      leads: row.leads,
      conversions: row.conversions,
      cost: row.cost,
      rawArtifactRef: row.raw_artifact_ref,
      warnings: JSON.parse(String(row.warnings_json)),
    });
  }

  private completeJobUnsafe(
    jobId: string,
    checkpoint: Record<string, unknown>,
    now: string,
  ): void {
    const updated = this.db
      .prepare(
        `UPDATE jobs SET status='complete', checkpoint_json=?,
         error_category=NULL, error_json=NULL, lease_owner=NULL,
         lease_acquired_at=NULL, lease_expires_at=NULL, heartbeat_at=?,
         finished_at=?, recovery_action=NULL, updated_at=?
         WHERE id=? AND status='running'`,
      )
      .run(json(checkpoint), now, now, now, jobId);
    if (updated.changes !== 1) {
      throw new Error('Only a claimed running job can be completed.');
    }
  }

  private insertFindingIdempotentUnsafe(finding: Finding): string {
    const value = findingSchema.parse(finding);
    const existing = this.db
      .prepare('SELECT id FROM findings WHERE source_run_id=? AND dimension=?')
      .get(value.sourceRunId, value.dimension) as { id: string } | undefined;
    if (existing) return existing.id;
    this.db
      .prepare(
        `INSERT INTO findings VALUES (
          @id, @projectId, @sourceRunId, @type, @dimension, @statement,
          @confidence, @scopeJson, @reviewStatus, @supersedesFindingId, @createdAt
        )`,
      )
      .run({ ...value, scopeJson: json(value.scope) });
    const relationStatement = this.db.prepare(
      'INSERT INTO finding_evidence VALUES (?, ?, ?, ?, ?)',
    );
    for (const relation of value.evidence) {
      relationStatement.run(
        value.id,
        relation.evidenceId,
        relation.relation,
        relation.weight,
        relation.note,
      );
    }
    return value.id;
  }

  private nextStageOr(runId: string, fallback: string): string {
    const next = this.db
      .prepare(
        `SELECT stage FROM jobs WHERE run_id=? AND status='pending'
         ORDER BY sequence, rowid LIMIT 1`,
      )
      .get(runId) as { stage: string } | undefined;
    return next?.stage ?? fallback;
  }

  private updateRunCheckpoint(runId: string, stage: string): void {
    const events = this.getJobs(runId).map((job) => ({
      stage: job.stage,
      status: job.status,
      attempt: job.attempt,
      checkpoint: job.checkpoint,
    }));
    this.db
      .prepare('UPDATE analysis_runs SET checkpoint_json=? WHERE id=?')
      .run(json({ stage, events }), runId);
  }

  private updateProjectStatusAt(
    id: string,
    status: ResearchProject['status'],
    updatedAt: string,
  ): void {
    this.db
      .prepare('UPDATE research_projects SET status=?, updated_at=? WHERE id=?')
      .run(status, updatedAt, id);
  }
}

export { migrations } from './migrations.js';
