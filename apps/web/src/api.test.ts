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
});
