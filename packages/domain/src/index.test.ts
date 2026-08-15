import { describe, expect, it } from 'vitest';
import { findingSchema, metricSnapshotSchema } from './index.js';

const now = '2026-08-16T00:00:00.000Z';
const id = '11111111-1111-4111-8111-111111111111';

describe('domain invariants', () => {
  it('distinguishes unknown metrics from an observed zero', () => {
    const base = {
      id,
      subjectType: 'content',
      subjectId: id,
      sourceTier: 'public',
      observedAt: now,
      contentAgeHours: null,
      views: null,
      likes: 0,
      comments: null,
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
    } as const;

    expect(metricSnapshotSchema.parse(base).likes).toBe(0);
    expect(metricSnapshotSchema.parse(base).views).toBeNull();
    expect(() => metricSnapshotSchema.parse({ ...base, likes: -1 })).toThrow();
  });

  it('requires scope, review state, and evidence for every finding', () => {
    const finding = {
      id,
      projectId: id,
      sourceRunId: id,
      type: 'unknown',
      dimension: 'performance',
      statement: 'Cannot determine abnormal performance without a baseline.',
      confidence: 'high',
      scope: { appliesTo: 'this post', limitations: ['No comparable sample'] },
      reviewStatus: 'machine_draft',
      supersedesFindingId: null,
      evidence: [],
      createdAt: now,
    } as const;

    expect(() => findingSchema.parse(finding)).toThrow();
  });
});
