import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ArtifactStore } from '@signal-room/artifacts';
import type { AuthenticatedBrowserPort } from '@signal-room/browser-ego';
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
});
