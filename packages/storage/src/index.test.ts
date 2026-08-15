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
});
