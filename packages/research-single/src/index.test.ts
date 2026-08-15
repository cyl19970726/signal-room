import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { researchSinglePost } from './index.js';

describe('single-post research contract', () => {
  it('labels every conclusion and refuses hidden-metric inference', () => {
    const findings = researchSinglePost({
      projectId: randomUUID(),
      runId: randomUUID(),
      sourceTextEvidenceId: randomUUID(),
      metricEvidenceId: randomUUID(),
      post: {
        canonicalUrl: 'https://www.xiaohongshu.com/explore/post1',
        externalId: 'post1',
        creator: { externalId: null, name: '作者', profileUrl: null },
        contentType: 'image',
        title: '标题',
        body: '正文',
        tags: [],
        publishedAt: null,
        metrics: {
          likes: 8,
          comments: 1,
          shares: null,
          bookmarks: null,
          views: null,
        },
        rawSnapshot: '{}',
        provenance: {
          sourceUrl: 'https://www.xiaohongshu.com/explore/post1',
          externalId: 'post1',
          observedAt: '2026-08-16T00:00:00.000Z',
          extractionMethod: 'synthetic',
          locator: 'note:post1',
          artifactRef: null,
          checksum: null,
          verificationState: 'verified',
          warning: null,
        },
        warnings: [],
      },
    });

    expect(findings).toHaveLength(3);
    expect(findings.every((finding) => finding.evidence.length > 0)).toBe(true);
    expect(
      findings.every((finding) => finding.reviewStatus === 'machine_draft'),
    ).toBe(true);
    expect(
      findings.find((finding) => finding.type === 'unknown')?.statement,
    ).toContain('无法判断');
    expect(findings.map((finding) => finding.statement).join(' ')).toContain(
      '不能推导播放',
    );
  });
});
