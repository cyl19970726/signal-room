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
});
