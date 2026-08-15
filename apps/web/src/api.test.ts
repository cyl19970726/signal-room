import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, type RunStatus, type RunView } from './api.ts';

function run(status: RunStatus, recoveryAction: string | null = null): RunView {
  return {
    id: 'run-1',
    projectId: 'project-1',
    status,
    checkpoint: { stage: status },
    failedStage: status === 'complete' ? null : 'research',
    recoveryAction,
  };
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('run terminal-state polling', () => {
  afterEach(() => vi.restoreAllMocks());

  it('waits through a slow queued/running run until complete', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(run('queued')))
      .mockResolvedValueOnce(jsonResponse(run('running')))
      .mockResolvedValueOnce(jsonResponse(run('complete')));

    await expect(
      api.waitForRun('run-1', { intervalMs: 0, timeoutMs: 1_000 }),
    ).resolves.toMatchObject({ status: 'complete' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('returns blocked as a terminal state with its recovery action intact', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(
        run(
          'blocked',
          'Hand the configured task space to the user, then resume.',
        ),
      ),
    );

    await expect(
      api.waitForRun('run-1', { intervalMs: 0, timeoutMs: 1_000 }),
    ).resolves.toMatchObject({
      status: 'blocked',
      recoveryAction:
        'Hand the configured task space to the user, then resume.',
    });
  });

  it('does not declare JSON for the bodyless Run POST', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (_input, init) => {
        const headers = new Headers(init?.headers);
        if (headers.has('content-type') && init?.body === undefined) {
          return new Response(
            JSON.stringify({
              error: 'FST_ERR_CTP_EMPTY_JSON_BODY',
              message: 'Body cannot be empty when content-type is JSON.',
            }),
            {
              status: 500,
              headers: { 'content-type': 'application/json' },
            },
          );
        }
        return jsonResponse(run('queued'));
      });

    await expect(api.startRun('project-1')).resolves.toMatchObject({
      status: 'queued',
    });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init?.body).toBeUndefined();
    expect(new Headers(init?.headers).has('content-type')).toBe(false);
  });

  it('sets JSON content type only for requests that carry a body', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({
        contentId: 'content-1',
        canonicalUrl: 'https://www.xiaohongshu.com/explore/synthetic',
        externalId: 'synthetic',
        creatorName: 'Synthetic creator',
        title: 'Synthetic post',
        bodyExcerpt: '',
        contentType: 'video',
        metrics: {},
        warnings: [],
        evidenceCoverage: [],
      }),
    );

    await api.resolve('https://xhslink.cn/o/synthetic');
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init?.body).toBeTypeOf('string');
    expect(new Headers(init?.headers).get('content-type')).toBe(
      'application/json',
    );
  });
});
