import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SignalRoomDatabase } from './index.js';

const now = '2026-08-16T00:00:00.000Z';

describe('SQLite persistence', () => {
  it('enables WAL and foreign keys and deduplicates content identity', () => {
    const store = new SignalRoomDatabase(':memory:');
    const id = randomUUID();
    const item = {
      id,
      platform: 'xiaohongshu' as const,
      externalId: 'post-1',
      creatorId: null,
      contentType: 'image' as const,
      sourceUrl: 'https://www.xiaohongshu.com/explore/post-1',
      title: 'First title',
      body: 'Body',
      tags: ['research'],
      publishedAt: null,
      firstSeenAt: now,
      latestSourceArtifactRef: null,
    };
    store.upsertContent(item);
    const persisted = store.upsertContent({
      ...item,
      id: randomUUID(),
      title: 'Updated',
    });

    expect(store.db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(store.db.pragma('journal_mode', { simple: true })).toBe('memory');
    expect(persisted.id).toBe(id);
    expect(persisted.title).toBe('Updated');
    expect(
      store.db.prepare('SELECT COUNT(*) count FROM content_items').get(),
    ).toEqual({ count: 1 });
    store.close();
  });

  it('appends metric observations instead of overwriting', () => {
    const store = new SignalRoomDatabase(':memory:');
    const subjectId = randomUUID();
    const snapshot = {
      id: randomUUID(),
      subjectType: 'content' as const,
      subjectId,
      sourceTier: 'public' as const,
      observedAt: now,
      contentAgeHours: null,
      views: null,
      likes: 12,
      comments: 1,
      shares: null,
      bookmarks: null,
      quotes: null,
      followersGained: null,
      profileVisits: null,
      leads: null,
      conversions: null,
      cost: null,
      rawArtifactRef: null,
      warnings: ['views unavailable'],
    };
    store.appendMetric(snapshot);
    store.appendMetric({ ...snapshot, id: randomUUID(), likes: 13 });

    expect(
      store.db.prepare('SELECT COUNT(*) count FROM metric_snapshots').get(),
    ).toEqual({ count: 2 });
    store.close();
  });

  it('persists claims, attempts, leases, heartbeats, and checkpoints in the job ledger', () => {
    const store = new SignalRoomDatabase(':memory:');
    const projectId = randomUUID();
    const runId = randomUUID();
    store.insertProject({
      id: projectId,
      type: 'single_post',
      title: 'Recovery contract',
      researchQuestion: 'Can a job resume?',
      objective: 'authority',
      platformScope: ['xiaohongshu'],
      observationWindow: null,
      comparabilityRules: [],
      status: 'scoping',
      createdAt: now,
      updatedAt: now,
    });
    const created = store.createRunWithJobs(
      {
        id: runId,
        projectId,
        runType: 'collect_and_research',
        status: 'queued',
        schemaVersion: 1,
        modelVersion: 'test',
        inputFingerprint: 'run-fingerprint',
        startedAt: null,
        finishedAt: null,
        checkpoint: {},
        reportArtifactRef: null,
        failedStage: null,
        recoveryAction: null,
      },
      [
        {
          id: randomUUID(),
          runId,
          stage: 'prepare',
          sequence: 0,
          status: 'pending',
          inputFingerprint: 'prepare-fingerprint',
          attempt: 0,
          checkpoint: {},
          errorCategory: null,
          leaseOwner: null,
          leaseAcquiredAt: null,
          leaseExpiresAt: null,
          heartbeatAt: null,
          startedAt: null,
          finishedAt: null,
          recoveryAction: null,
          updatedAt: now,
        },
      ],
    );

    expect(created.created).toBe(true);
    const claimed = store.claimNextJob(
      runId,
      'worker-1',
      now,
      '2026-08-16T00:01:00.000Z',
    );
    expect(claimed).toMatchObject({
      stage: 'prepare',
      status: 'running',
      attempt: 1,
      leaseOwner: 'worker-1',
      heartbeatAt: now,
    });
    expect(
      store.heartbeatJob(
        claimed!.id,
        'worker-1',
        '2026-08-16T00:00:10.000Z',
        '2026-08-16T00:01:10.000Z',
      ),
    ).toBe(true);
    expect(store.reconcileActiveRuns('2026-08-16T00:00:20.000Z')).toBe(1);
    expect(store.getRun(runId)).toMatchObject({
      status: 'interrupted',
      failedStage: 'prepare',
    });
    expect(store.getJobs(runId)[0]).toMatchObject({
      status: 'interrupted',
      attempt: 1,
      errorCategory: 'process_interrupted',
      leaseOwner: null,
    });
    expect(
      store.prepareRunForResume(runId, '2026-08-16T00:00:30.000Z'),
    ).toMatchObject({ shouldSchedule: true, run: { status: 'queued' } });
    const reclaimed = store.claimNextJob(
      runId,
      'worker-2',
      '2026-08-16T00:00:40.000Z',
      '2026-08-16T00:01:40.000Z',
    );
    expect(reclaimed).toMatchObject({
      status: 'running',
      attempt: 2,
      leaseOwner: 'worker-2',
    });
    store.completeJob(
      reclaimed!.id,
      { contentId: randomUUID() },
      '2026-08-16T00:00:50.000Z',
    );
    expect(store.getJobs(runId)[0]).toMatchObject({
      status: 'complete',
      attempt: 2,
      checkpoint: { contentId: expect.any(String) },
      leaseOwner: null,
    });
    store.close();
  });
});
