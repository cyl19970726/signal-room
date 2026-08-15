import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArtifactStore } from '@signal-room/artifacts';
import type { AuthenticatedBrowserPort } from '@signal-room/browser-ego';
import { SignalRoomDatabase } from '@signal-room/storage';
import { buildApp } from '../api/src/app.js';
import { SignalRoomService } from '../api/src/service.js';
import { api as webApi } from '../web/src/api.ts';

const browser: AuthenticatedBrowserPort = {
  taskSpace: 'synthetic',
  profile: 'synthetic',
  async resolveAndCollect() {
    return {
      canonicalUrl: 'https://www.xiaohongshu.com/explore/abc123',
      title: '证据研究 - 小红书',
      pageText: 'synthetic',
      rawSnapshot: '{"synthetic":true}',
      extracted: {
        canonicalUrl: 'https://www.xiaohongshu.com/explore/abc123',
        note: {
          noteId: 'abc123',
          title: '证据研究',
          desc: '只使用公开事实',
          type: 'normal',
          user: { userId: 'creator1', nickname: '研究员' },
          interactInfo: { likedCount: '12', commentCount: '2' },
        },
      },
      observedAt: '2026-08-16T00:00:00.000Z',
    };
  },
};

describe('Web to Fastify Run contract', () => {
  afterEach(() => vi.restoreAllMocks());

  it('inserts a Run without sending an empty JSON body', async () => {
    const database = new SignalRoomDatabase(':memory:');
    const root = await mkdtemp(join(tmpdir(), 'signal-room-contract-'));
    const app = buildApp(
      new SignalRoomService(database, new ArtifactStore(root), browser),
    );
    try {
      const intake = (
        await app.inject({
          method: 'POST',
          url: '/api/intake/resolve',
          payload: { input: '分享 https://xhslink.cn/o/example' },
        })
      ).json<{ contentId: string }>();
      const project = (
        await app.inject({
          method: 'POST',
          url: '/api/projects',
          payload: { contentId: intake.contentId, objective: 'authority' },
        })
      ).json<{ id: string }>();

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const method = init?.method === 'POST' ? 'POST' : 'GET';
        const body = typeof init?.body === 'string' ? init.body : undefined;
        const response = await app.inject({
          method,
          url: String(input),
          headers: Object.fromEntries(new Headers(init?.headers).entries()),
          ...(body === undefined ? {} : { payload: body }),
        });
        const headers = new Headers();
        for (const [name, value] of Object.entries(response.headers)) {
          if (value !== undefined) headers.set(name, String(value));
        }
        return new Response(response.body, {
          status: response.statusCode,
          headers,
        });
      });

      const started = await webApi.startRun(project.id);
      expect(started).toMatchObject({
        projectId: project.id,
        status: 'queued',
      });
      expect(database.getRun(started.id)).not.toBeNull();
    } finally {
      await app.close();
      database.close();
    }
  });

  it('recreates the service between committed stages and explicitly resumes one idempotent Run', async () => {
    const root = await mkdtemp(
      join(tmpdir(), 'signal-room-recovery-contract-'),
    );
    const databasePath = join(root, 'signal-room.sqlite');
    const artifactRoot = join(root, 'artifacts');
    const firstSchedule: Array<() => void> = [];
    let database = new SignalRoomDatabase(databasePath);
    let databaseOpen = true;
    let activeApp = buildApp(
      new SignalRoomService(
        database,
        new ArtifactStore(artifactRoot),
        browser,
        {
          scheduleRun(work) {
            firstSchedule.push(work);
          },
          workerId: 'first-service',
        },
      ),
    );

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const method = init?.method === 'POST' ? 'POST' : 'GET';
      const body = typeof init?.body === 'string' ? init.body : undefined;
      const response = await activeApp.inject({
        method,
        url: String(input),
        headers: Object.fromEntries(new Headers(init?.headers).entries()),
        ...(body === undefined ? {} : { payload: body }),
      });
      const headers = new Headers();
      for (const [name, value] of Object.entries(response.headers)) {
        if (value !== undefined) headers.set(name, String(value));
      }
      return new Response(response.body, {
        status: response.statusCode,
        headers,
      });
    });

    try {
      const intake = await webApi.resolve('分享 https://xhslink.cn/o/example');
      const project = await webApi.createProject(
        intake.contentId,
        '进程重建后是否可以从持久 checkpoint 恢复？',
      );
      const started = await webApi.startRun(project.id);
      const duplicateStart = await webApi.startRun(project.id);

      expect(duplicateStart.id).toBe(started.id);
      expect(firstSchedule).toHaveLength(1);
      expect(started.jobs).toEqual([
        expect.objectContaining({ stage: 'prepare', status: 'pending' }),
        expect.objectContaining({ stage: 'research', status: 'pending' }),
        expect.objectContaining({ stage: 'finalize', status: 'pending' }),
      ]);

      firstSchedule.shift()!();
      firstSchedule.shift()!();
      expect(database.getJobs(started.id)).toMatchObject([
        { stage: 'prepare', status: 'complete', attempt: 1 },
        { stage: 'research', status: 'complete', attempt: 1 },
        { stage: 'finalize', status: 'pending', attempt: 0 },
      ]);
      expect(
        database.db.prepare('SELECT COUNT(*) count FROM findings').get(),
      ).toEqual({ count: 3 });

      await activeApp.close();
      database.close();
      databaseOpen = false;

      const secondSchedule: Array<() => void> = [];
      database = new SignalRoomDatabase(databasePath);
      databaseOpen = true;
      activeApp = buildApp(
        new SignalRoomService(
          database,
          new ArtifactStore(artifactRoot),
          browser,
          {
            scheduleRun(work) {
              secondSchedule.push(work);
            },
            workerId: 'second-service',
          },
        ),
      );

      const interrupted = await webApi.getRun(started.id);
      expect(interrupted).toMatchObject({
        status: 'interrupted',
        failedStage: 'finalize',
        recoverable: true,
        jobs: [
          { stage: 'prepare', status: 'complete', attempt: 1 },
          { stage: 'research', status: 'complete', attempt: 1 },
          { stage: 'finalize', status: 'pending', attempt: 0 },
        ],
      });
      expect(secondSchedule).toHaveLength(0);

      const resumed = await webApi.resumeRun(started.id);
      const duplicateResume = await webApi.resumeRun(started.id);
      expect(resumed.status).toBe('queued');
      expect(duplicateResume.status).toBe('queued');
      expect(secondSchedule).toHaveLength(1);

      while (secondSchedule.length) secondSchedule.shift()!();
      const complete = await webApi.waitForRun(started.id, {
        intervalMs: 0,
        timeoutMs: 1_000,
      });
      expect(complete).toMatchObject({
        id: started.id,
        status: 'complete',
        recoverable: false,
      });
      expect(complete.jobs).toMatchObject([
        { stage: 'prepare', status: 'complete', attempt: 1 },
        { stage: 'research', status: 'complete', attempt: 1 },
        { stage: 'finalize', status: 'complete', attempt: 1 },
      ]);

      const completeResume = await webApi.resumeRun(started.id);
      expect(completeResume.status).toBe('complete');
      expect(secondSchedule).toHaveLength(0);
      for (const [table, expected] of [
        ['analysis_runs', 1],
        ['jobs', 3],
        ['findings', 3],
        ['finding_evidence', 3],
        ['content_items', 1],
        ['creators', 1],
        ['metric_snapshots', 1],
        ['evidence_items', 2],
      ] as const) {
        expect(
          database.db.prepare(`SELECT COUNT(*) count FROM ${table}`).get(),
        ).toEqual({ count: expected });
      }
    } finally {
      await activeApp.close();
      if (databaseOpen) database.close();
    }
  });
});
