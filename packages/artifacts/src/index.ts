import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

export interface ArtifactManifest {
  ref: string;
  checksum: string;
  byteLength: number;
  mediaType: string;
  createdAt: string;
  provenance: Record<string, unknown>;
}

export class ArtifactStore {
  readonly root: string;

  constructor(root: string, repositoryRoot = process.cwd()) {
    if (!isAbsolute(root)) throw new Error('Artifact root must be an absolute path.');
    const resolvedRoot = resolve(root);
    const relativeToRepo = relative(resolve(repositoryRoot), resolvedRoot);
    if (!relativeToRepo.startsWith('..') || relativeToRepo === '') {
      throw new Error('Artifact root must be outside the repository.');
    }
    this.root = resolvedRoot;
  }

  async put(
    body: string | Uint8Array,
    mediaType: string,
    provenance: Record<string, unknown>,
  ): Promise<ArtifactManifest> {
    const data = typeof body === 'string' ? Buffer.from(body) : Buffer.from(body);
    const checksum = createHash('sha256').update(data).digest('hex');
    const directory = resolve(this.root, checksum.slice(0, 2));
    const ref = `${checksum.slice(0, 2)}/${checksum}`;
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(this.root, ref), data, { flag: 'wx' }).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    });
    const manifest: ArtifactManifest = {
      ref,
      checksum,
      byteLength: data.byteLength,
      mediaType,
      createdAt: new Date().toISOString(),
      provenance,
    };
    await writeFile(`${resolve(this.root, ref)}.manifest.json`, JSON.stringify(manifest, null, 2));
    return manifest;
  }
}
