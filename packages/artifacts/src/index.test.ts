import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ArtifactStore } from './index.js';

describe('ArtifactStore', () => {
  it('rejects repository-local roots', () => {
    expect(() => new ArtifactStore(join(process.cwd(), 'artifacts'))).toThrow(
      'outside the repository',
    );
  });

  it('writes content-addressed artifacts with provenance manifests', async () => {
    const root = await mkdtemp(join(tmpdir(), 'signal-room-artifacts-'));
    const store = new ArtifactStore(root);
    const manifest = await store.put('snapshot', 'text/plain', {
      method: 'ego-browser',
    });

    expect(manifest.checksum).toHaveLength(64);
    expect(await readFile(join(root, manifest.ref), 'utf8')).toBe('snapshot');
    const saved = JSON.parse(
      await readFile(join(root, `${manifest.ref}.manifest.json`), 'utf8'),
    ) as ArtifactManifest;
    expect(saved.provenance).toEqual({ method: 'ego-browser' });
  });
});

import type { ArtifactManifest } from './index.js';
