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
  type AnalysisRun,
  type ContentItem,
  type Creator,
  type EvidenceItem,
  type Finding,
  type FindingRevision,
  type MetricSnapshot,
  type ResearchProject,
} from '@signal-room/domain';
import { migrations } from './migrations.js';

const json = JSON.stringify;

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
    const latestRun = latestRunRow ? this.getRun(latestRunRow.id) : null;
    return { project, samples, findings: hydratedFindings, latestRun };
  }
}

export { migrations } from './migrations.js';
