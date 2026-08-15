export interface IntakePreview {
  contentId: string;
  canonicalUrl: string;
  externalId: string;
  creatorName: string;
  title: string;
  bodyExcerpt: string;
  contentType: string;
  metrics: Record<string, number | null>;
  warnings: string[];
  evidenceCoverage: string[];
}

export interface FindingEvidenceView {
  evidence_id: string;
  relation: 'supports' | 'contradicts' | 'alternative' | 'calculation_input';
  note: string;
  type: string;
  locator: string;
  excerpt: string | null;
  payload_json: string;
}

export interface FindingView {
  id: string;
  type: 'fact' | 'observation' | 'hypothesis' | 'unknown';
  dimension: string;
  statement: string;
  confidence: 'high' | 'medium' | 'low';
  review_status:
    'machine_draft' | 'human_confirmed' | 'human_revised' | 'rejected';
  scope: { appliesTo: string; limitations: string[] };
  evidence: FindingEvidenceView[];
}

export interface ProjectView {
  project: {
    id: string;
    title: string;
    research_question: string;
    objective: string;
    status: string;
  };
  samples: Array<{
    id: string;
    content_item_id: string;
    title: string;
    body: string;
    source_url: string;
    content_type: string;
  }>;
  findings: FindingView[];
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { 'content-type': 'application/json', ...options?.headers },
  });
  const payload = (await response.json()) as T & {
    message?: string;
    recoveryAction?: string;
  };
  if (!response.ok) {
    throw new Error(
      [payload.message, payload.recoveryAction].filter(Boolean).join(' ') ||
        `Request failed: ${response.status}`,
    );
  }
  return payload;
}

export const api = {
  resolve(input: string) {
    return request<IntakePreview>('/api/intake/resolve', {
      method: 'POST',
      body: JSON.stringify({ input }),
    });
  },
  createProject(contentId: string, researchQuestion: string) {
    return request<{ id: string }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({
        contentId,
        objective: 'authority',
        researchQuestion,
      }),
    });
  },
  startRun(projectId: string) {
    return request<{ id: string }>(`/api/projects/${projectId}/runs`, {
      method: 'POST',
    });
  },
  getProject(projectId: string) {
    return request<ProjectView>(`/api/projects/${projectId}`);
  },
  reviewFinding(
    findingId: string,
    body: {
      nextStatus: 'human_confirmed' | 'human_revised' | 'rejected';
      nextStatement?: string;
      reason: string;
    },
  ) {
    return request(`/api/findings/${findingId}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ ...body, actor: 'local_user' }),
    });
  },
};
