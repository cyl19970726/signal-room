export const migrations = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS creators (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        external_id TEXT NOT NULL,
        handle TEXT,
        name TEXT NOT NULL,
        profile_url TEXT NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_collected_at TEXT,
        UNIQUE(platform, external_id)
      );
      CREATE TABLE IF NOT EXISTS content_items (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        external_id TEXT NOT NULL,
        creator_id TEXT REFERENCES creators(id),
        content_type TEXT NOT NULL,
        source_url TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        published_at TEXT,
        first_seen_at TEXT NOT NULL,
        latest_source_artifact_ref TEXT,
        UNIQUE(platform, external_id)
      );
      CREATE TABLE IF NOT EXISTS metric_snapshots (
        id TEXT PRIMARY KEY,
        subject_type TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        source_tier TEXT NOT NULL,
        observed_at TEXT NOT NULL,
        content_age_hours REAL,
        views INTEGER,
        likes INTEGER,
        comments INTEGER,
        shares INTEGER,
        bookmarks INTEGER,
        quotes INTEGER,
        followers_gained INTEGER,
        profile_visits INTEGER,
        leads INTEGER,
        conversions INTEGER,
        cost REAL,
        raw_artifact_ref TEXT,
        warnings_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS evidence_items (
        id TEXT PRIMARY KEY,
        content_item_id TEXT REFERENCES content_items(id),
        creator_id TEXT REFERENCES creators(id),
        type TEXT NOT NULL,
        source_tier TEXT NOT NULL,
        locator TEXT NOT NULL,
        excerpt TEXT,
        artifact_ref TEXT,
        checksum TEXT,
        observed_at TEXT NOT NULL,
        payload_version INTEGER NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS research_projects (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        research_question TEXT NOT NULL,
        objective TEXT NOT NULL,
        platform_scope_json TEXT NOT NULL,
        observation_window TEXT,
        comparability_rules_json TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS project_samples (
        project_id TEXT NOT NULL REFERENCES research_projects(id),
        content_item_id TEXT NOT NULL REFERENCES content_items(id),
        role TEXT NOT NULL,
        cohort TEXT NOT NULL,
        inclusion_reason TEXT NOT NULL,
        exclusion_reason TEXT,
        included INTEGER NOT NULL,
        PRIMARY KEY(project_id, content_item_id)
      );
      CREATE TABLE IF NOT EXISTS analysis_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES research_projects(id),
        run_type TEXT NOT NULL,
        status TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        model_version TEXT,
        input_fingerprint TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT,
        checkpoint_json TEXT NOT NULL,
        report_artifact_ref TEXT,
        failed_stage TEXT,
        recovery_action TEXT
      );
      CREATE TABLE IF NOT EXISTS findings (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES research_projects(id),
        source_run_id TEXT NOT NULL REFERENCES analysis_runs(id),
        type TEXT NOT NULL,
        dimension TEXT NOT NULL,
        statement TEXT NOT NULL,
        confidence TEXT NOT NULL,
        scope_json TEXT NOT NULL,
        review_status TEXT NOT NULL,
        supersedes_finding_id TEXT REFERENCES findings(id),
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS finding_evidence (
        finding_id TEXT NOT NULL REFERENCES findings(id),
        evidence_id TEXT NOT NULL REFERENCES evidence_items(id),
        relation TEXT NOT NULL,
        weight REAL,
        note TEXT NOT NULL,
        PRIMARY KEY(finding_id, evidence_id, relation)
      );
      CREATE TABLE IF NOT EXISTS finding_revisions (
        id TEXT PRIMARY KEY,
        finding_id TEXT NOT NULL REFERENCES findings(id),
        previous_statement TEXT NOT NULL,
        next_statement TEXT NOT NULL,
        previous_status TEXT NOT NULL,
        next_status TEXT NOT NULL,
        reason TEXT NOT NULL,
        actor TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES analysis_runs(id),
        stage TEXT NOT NULL,
        status TEXT NOT NULL,
        input_fingerprint TEXT NOT NULL,
        checkpoint_json TEXT NOT NULL,
        error_json TEXT,
        updated_at TEXT NOT NULL,
        UNIQUE(run_id, stage, input_fingerprint)
      );
    `,
  },
  {
    version: 2,
    sql: `
      ALTER TABLE jobs ADD COLUMN sequence INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE jobs ADD COLUMN attempt INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE jobs ADD COLUMN error_category TEXT;
      ALTER TABLE jobs ADD COLUMN lease_owner TEXT;
      ALTER TABLE jobs ADD COLUMN lease_acquired_at TEXT;
      ALTER TABLE jobs ADD COLUMN lease_expires_at TEXT;
      ALTER TABLE jobs ADD COLUMN heartbeat_at TEXT;
      ALTER TABLE jobs ADD COLUMN started_at TEXT;
      ALTER TABLE jobs ADD COLUMN finished_at TEXT;
      ALTER TABLE jobs ADD COLUMN recovery_action TEXT;
      CREATE INDEX IF NOT EXISTS jobs_run_sequence_idx
        ON jobs(run_id, sequence);
      CREATE UNIQUE INDEX IF NOT EXISTS findings_run_dimension_unique
        ON findings(source_run_id, dimension);
    `,
  },
] as const;
