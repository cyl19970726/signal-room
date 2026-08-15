import { describe, expect, it } from 'vitest';
import type { AuthenticatedBrowserPort } from '@signal-room/browser-ego';
import { XhsPostCollector } from './index.js';

const browser: AuthenticatedBrowserPort = {
  taskSpace: 'synthetic',
  profile: 'synthetic',
  async resolveAndCollect() {
    return {
      canonicalUrl: 'https://www.xiaohongshu.com/explore/abc123',
      title: '研究标题 - 小红书',
      pageText: 'synthetic',
      rawSnapshot: '{"synthetic":true}',
      extracted: {
        canonicalUrl: 'https://www.xiaohongshu.com/explore/abc123',
        note: {
          noteId: 'abc123',
          title: '研究标题',
          desc: '正文 #研究',
          type: 'video',
          user: { userId: 'creator1', nickname: '研究员' },
          interactInfo: { likedCount: '1.2万', commentCount: '32' },
        },
      },
      observedAt: '2026-08-16T00:00:00.000Z',
    };
  },
};

describe('XhsPostCollector', () => {
  it('resolves share text and rejects unknown input without fabrication', () => {
    const collector = new XhsPostCollector(browser);
    expect(
      collector.resolve('打开看看 https://xhslink.cn/o/example 复制后打开'),
    ).toMatchObject({
      type: 'post',
      urls: ['https://xhslink.cn/o/example'],
    });
    expect(collector.resolve('nothing here')).toMatchObject({
      type: 'unknown',
      urls: [],
    });
  });

  it('normalizes visible data and keeps unavailable fields null', async () => {
    const post = await new XhsPostCollector(browser).collectPost(
      'https://xhslink.cn/o/example',
    );
    expect(post.externalId).toBe('abc123');
    expect(post.metrics.likes).toBe(12_000);
    expect(post.metrics.views).toBeNull();
    expect(post.warnings).toContain(
      '公开页面不提供播放、触达、留存、涨粉或转化数据。',
    );
  });
});
