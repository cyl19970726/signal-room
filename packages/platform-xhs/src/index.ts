import type {
  AuthenticatedBrowserPort,
  BrowserCollectionEnvelope,
} from '@signal-room/browser-ego';
import {
  collectedPostSchema,
  type BrowserCheckpoint,
  type CollectedPost,
} from '@signal-room/domain';

export interface ResolvedXhsInput {
  type: 'post' | 'creator_profile' | 'multi_post' | 'unknown';
  urls: string[];
  rawText: string;
  reason: string | null;
}

export interface XhsCollector {
  resolve(input: string): ResolvedXhsInput;
  collectPost(url: string): Promise<CollectedPost>;
}

const xhsUrlPattern =
  /https?:\/\/(?:www\.)?(?:xiaohongshu\.com|xhslink\.cn)\/[^\s]+/gi;

export class XhsPostCollector implements XhsCollector {
  constructor(private readonly browser: AuthenticatedBrowserPort) {}

  resolve(input: string): ResolvedXhsInput {
    const urls = [...input.matchAll(xhsUrlPattern)].map((match) =>
      match[0].replace(/[),，。；;]+$/, ''),
    );
    if (urls.length === 0) {
      return {
        type: 'unknown',
        urls,
        rawText: input,
        reason: '请粘贴一个小红书帖子、分享链接或创作者主页链接。',
      };
    }
    if (urls.length > 1) {
      return { type: 'multi_post', urls, rawText: input, reason: null };
    }
    const url = urls[0]!;
    const profile = /\/user\/profile\//.test(url);
    return {
      type: profile ? 'creator_profile' : 'post',
      urls,
      rawText: input,
      reason: null,
    };
  }

  async collectPost(url: string): Promise<CollectedPost> {
    return normalizeEnvelope(await this.browser.resolveAndCollect(url));
  }
}

export function createCheckpoint(
  stage: BrowserCheckpoint['stage'],
  values: Partial<BrowserCheckpoint> = {},
): BrowserCheckpoint {
  return {
    stage,
    canonicalUrl: values.canonicalUrl ?? null,
    externalId: values.externalId ?? null,
    completedStages: values.completedStages ?? [],
    updatedAt: new Date().toISOString(),
  };
}

function normalizeEnvelope(envelope: BrowserCollectionEnvelope): CollectedPost {
  const extracted = envelope.extracted;
  const note = objectValue(extracted.note);
  const meta = objectValue(extracted.meta);
  const interact = objectValue(note.interactInfo);
  const user = objectValue(note.user);
  const canonicalUrl = String(extracted.canonicalUrl ?? envelope.canonicalUrl);
  const externalId =
    stringValue(note.noteId) ??
    stringValue(note.id) ??
    extractPostId(canonicalUrl);
  if (!externalId)
    throw new Error('adapter_changed: canonical post ID is missing');
  const title =
    stringValue(note.title) ??
    stringValue(meta['og:title']) ??
    envelope.title.replace(/\s*[-|].*小红书.*$/i, '');
  const body =
    stringValue(note.desc) ??
    stringValue(meta.description) ??
    stringValue(meta['og:description']) ??
    '';
  const creatorName =
    stringValue(user.nickname) ?? stringValue(meta.author) ?? '作者信息不可用';
  const creatorId = stringValue(user.userId) ?? stringValue(user.user_id);
  const tags = Array.isArray(note.tagList)
    ? note.tagList
        .map((tag) => stringValue(objectValue(tag).name))
        .filter((tag): tag is string => Boolean(tag))
    : [...body.matchAll(/#([^#\s]+)/g)].map((match) => match[1]!);
  const warnings: string[] = [];
  const metrics = {
    likes: metricValue(interact.likedCount ?? interact.liked_count),
    comments: metricValue(interact.commentCount ?? interact.comment_count),
    shares: metricValue(interact.shareCount ?? interact.share_count),
    bookmarks: metricValue(interact.collectedCount ?? interact.collected_count),
    views: null,
  };
  warnings.push('公开页面不提供播放、触达、留存、涨粉或转化数据。');
  for (const [name, value] of Object.entries(metrics)) {
    if (value === null)
      warnings.push(`${name} unavailable; stored as unknown.`);
  }
  return collectedPostSchema.parse({
    canonicalUrl,
    externalId,
    creator: {
      externalId: creatorId,
      name: creatorName,
      profileUrl: creatorId
        ? `https://www.xiaohongshu.com/user/profile/${creatorId}`
        : null,
    },
    contentType:
      note.type === 'video' ? 'video' : note.imageList ? 'image' : 'unknown',
    title,
    body,
    tags,
    publishedAt: epochToIso(note.time ?? note.publishTime),
    metrics,
    rawSnapshot: envelope.rawSnapshot,
    provenance: {
      sourceUrl: canonicalUrl,
      externalId,
      observedAt: envelope.observedAt,
      extractionMethod: 'ego-browser:semantic+dom',
      locator: `xiaohongshu:note:${externalId}`,
      artifactRef: null,
      checksum: null,
      verificationState: title || body ? 'verified' : 'partial',
      warning: warnings.length ? warnings.join(' ') : null,
    },
    warnings,
  });
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number') return String(value);
  return null;
}

function metricValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value))
    return Math.max(0, value);
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  const match = normalized.match(/^([\d.]+)\s*([万w千k]?)$/);
  if (!match) return null;
  const multiplier =
    match[2] === '万' || match[2] === 'w'
      ? 10_000
      : match[2] === '千' || match[2] === 'k'
        ? 1_000
        : 1;
  return Math.round(Number(match[1]) * multiplier);
}

function extractPostId(url: string): string | null {
  return (
    url.match(/\/(?:explore|discovery\/item)\/([a-zA-Z0-9]+)/)?.[1] ?? null
  );
}

function epochToIso(value: unknown): string | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const milliseconds = parsed < 10_000_000_000 ? parsed * 1000 : parsed;
  return new Date(milliseconds).toISOString();
}
