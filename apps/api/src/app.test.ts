import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ArtifactStore } from '@signal-room/artifacts';
import {
  BrowserStopError,
  type AuthenticatedBrowserPort,
} from '@signal-room/browser-ego';
import { SignalRoomDatabase } from '@signal-room/storage';
import { buildApp } from './app.js';
import { SignalRoomService } from './service.js';

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

describe('single-post API vertical', () => {
  let database: SignalRoomDatabase;
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    database = new SignalRoomDatabase(':memory:');
    const root = await mkdtemp(join(tmpdir(), 'signal-room-api-'));
    app = buildApp(
      new SignalRoomService(database, new ArtifactStore(root), browser),
      { allowedOrigins: ['http://127.0.0.1:4318'] },
    );
  });

  afterEach(async () => {
    await app.close();
    database.close();
  });

  it('collects, persists, researches, traces evidence, and reviews a finding', async () => {
    const intakeResponse = await app.inject({
      method: 'POST',
      url: '/api/intake/resolve',
      payload: { input: '分享 https://xhslink.cn/o/example' },
    });
    expect(intakeResponse.statusCode).toBe(200);
    const intake = intakeResponse.json<{ contentId: string }>();

    const projectResponse = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { contentId: intake.contentId, objective: 'authority' },
    });
    expect(projectResponse.statusCode).toBe(201);
    const project = projectResponse.json<{ id: string }>();

    const runResponse = await app.inject({
      method: 'POST',
      url: `/api/projects/${project.id}/runs`,
    });
    expect(runResponse.statusCode).toBe(202);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const projectView = (
      await app.inject({ method: 'GET', url: `/api/projects/${project.id}` })
    ).json<{ findings: { id: string; type: string; evidence: unknown[] }[] }>();
    expect(projectView.findings).toHaveLength(3);
    expect(
      projectView.findings.every((finding) => finding.evidence.length > 0),
    ).toBe(true);
    expect(
      projectView.findings.some((finding) => finding.type === 'unknown'),
    ).toBe(true);

    const review = await app.inject({
      method: 'POST',
      url: `/api/findings/${projectView.findings[0]!.id}/reviews`,
      payload: {
        nextStatus: 'human_confirmed',
        reason: '已对照来源证据。',
        actor: 'tester',
      },
    });
    expect(review.statusCode).toBe(200);
    expect(review.json()).toMatchObject({ nextStatus: 'human_confirmed' });
    expect(
      database.db.prepare('SELECT COUNT(*) count FROM finding_revisions').get(),
    ).toEqual({ count: 1 });
  });

  it('rejects a malicious browser origin before executing a write route', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/intake/resolve',
      headers: { origin: 'https://malicious.example' },
      payload: { input: '分享 https://xhslink.cn/o/example' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: 'origin_not_allowed',
      message: 'Request origin is not allowed.',
    });
  });

  it('does not expose unexpected internal error messages', async () => {
    const root = await mkdtemp(join(tmpdir(), 'signal-room-api-error-'));
    const errorBrowser: AuthenticatedBrowserPort = {
      taskSpace: 'synthetic',
      profile: 'synthetic',
      async resolveAndCollect() {
        throw new Error('private filesystem path and adapter diagnostic');
      },
    };
    const errorDatabase = new SignalRoomDatabase(':memory:');
    const errorApp = buildApp(
      new SignalRoomService(
        errorDatabase,
        new ArtifactStore(root),
        errorBrowser,
      ),
    );
    try {
      const response = await errorApp.inject({
        method: 'POST',
        url: '/api/intake/resolve',
        payload: { input: '分享 https://xhslink.cn/o/example' },
      });
      expect(response.statusCode).toBe(500);
      expect(response.body).not.toContain('private filesystem');
      expect(response.json()).toEqual({
        error: 'internal_error',
        message: 'An unexpected internal error occurred.',
      });
    } finally {
      await errorApp.close();
      errorDatabase.close();
    }
  });

  it('keeps a slow run queued, then exposes blocked with recoveryAction', async () => {
    const root = await mkdtemp(join(tmpdir(), 'signal-room-api-run-'));
    const runDatabase = new SignalRoomDatabase(':memory:');
    let execute: (() => void) | undefined;
    const runApp = buildApp(
      new SignalRoomService(runDatabase, new ArtifactStore(root), browser, {
        scheduleRun(work) {
          execute = work;
        },
        research() {
          throw new BrowserStopError(
            'user_controlled',
            'Synthetic user takeover.',
            'Wait for explicit user confirmation, then resume.',
          );
        },
      }),
    );
    try {
      const intake = (
        await runApp.inject({
          method: 'POST',
          url: '/api/intake/resolve',
          payload: { input: '分享 https://xhslink.cn/o/example' },
        })
      ).json<{ contentId: string }>();
      const project = (
        await runApp.inject({
          method: 'POST',
          url: '/api/projects',
          payload: { contentId: intake.contentId, objective: 'authority' },
        })
      ).json<{ id: string }>();
      const started = (
        await runApp.inject({
          method: 'POST',
          url: `/api/projects/${project.id}/runs`,
        })
      ).json<{ id: string }>();

      const queued = await runApp.inject({
        method: 'GET',
        url: `/api/runs/${started.id}`,
      });
      expect(queued.json()).toMatchObject({ status: 'queued' });

      expect(execute).toBeTypeOf('function');
      execute!();

      const blocked = await runApp.inject({
        method: 'GET',
        url: `/api/runs/${started.id}`,
      });
      expect(blocked.json()).toMatchObject({
        status: 'blocked',
        failedStage: 'research',
        recoveryAction: 'Wait for explicit user confirmation, then resume.',
      });
      const projectView = (
        await runApp.inject({
          method: 'GET',
          url: `/api/projects/${project.id}`,
        })
      ).json<{ latestRun: { status: string; recoveryAction: string } }>();
      expect(projectView.latestRun).toMatchObject({
        status: 'blocked',
        recoveryAction: 'Wait for explicit user confirmation, then resume.',
      });
    } finally {
      await runApp.close();
      runDatabase.close();
    }
  });
});
