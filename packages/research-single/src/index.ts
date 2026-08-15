import { randomUUID } from 'node:crypto';
import {
  findingSchema,
  type CollectedPost,
  type Finding,
} from '@signal-room/domain';

export interface SinglePostResearchInput {
  projectId: string;
  runId: string;
  post: CollectedPost;
  sourceTextEvidenceId: string;
  metricEvidenceId: string;
}

export function researchSinglePost(input: SinglePostResearchInput): Finding[] {
  const createdAt = new Date().toISOString();
  const common = {
    projectId: input.projectId,
    sourceRunId: input.runId,
    reviewStatus: 'machine_draft' as const,
    supersedesFindingId: null,
    createdAt,
  };
  const findings: Finding[] = [
    findingSchema.parse({
      ...common,
      id: randomUUID(),
      type: 'fact',
      dimension: 'source',
      statement: input.post.title
        ? `该帖公开标题为“${input.post.title}”。`
        : '该帖公开标题不可用。',
      confidence: input.post.title ? 'high' : 'low',
      scope: {
        appliesTo: '本次采集时可见的单帖公开页面',
        limitations: ['页面内容可能在后续被作者编辑或删除'],
      },
      evidence: [
        {
          evidenceId: input.sourceTextEvidenceId,
          relation: 'supports',
          weight: 1,
          note: '来自已登录页面的标题与正文快照。',
        },
      ],
    }),
    findingSchema.parse({
      ...common,
      id: randomUUID(),
      type: 'observation',
      dimension: 'public_engagement_proxy',
      statement:
        input.post.metrics.likes === null
          ? '本次采集未取得可验证的公开点赞数。'
          : `本次采集观察到 ${input.post.metrics.likes} 个公开点赞；它只是互动代理，不能推导播放、触达、留存、涨粉或转化。`,
      confidence: input.post.metrics.likes === null ? 'low' : 'high',
      scope: {
        appliesTo: '本次采集时间点的公开互动字段',
        limitations: [
          '公开点赞不能推导播放、留存、涨粉或转化',
          '缺少观察窗口与对照样本',
        ],
      },
      evidence: [
        {
          evidenceId: input.metricEvidenceId,
          relation: 'supports',
          weight: 1,
          note: '可见公开指标快照；未知字段保持为 null。',
        },
      ],
    }),
    findingSchema.parse({
      ...common,
      id: randomUUID(),
      type: 'unknown',
      dimension: 'relative_performance',
      statement: '没有作者或主题基线，无法判断该帖表现是否异常。',
      confidence: 'high',
      scope: {
        appliesTo: '当前仅含一个 subject 的研究项目',
        limitations: [
          '没有可比帖子',
          '没有一致观察窗口',
          '不知道是否存在付费分发',
        ],
      },
      evidence: [
        {
          evidenceId: input.metricEvidenceId,
          relation: 'calculation_input',
          weight: null,
          note: '当前只有 subject 指标，没有可计算的对照分布。',
        },
      ],
    }),
  ];
  return findings;
}
