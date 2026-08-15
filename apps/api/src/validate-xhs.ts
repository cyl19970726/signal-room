import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ArtifactStore } from '@signal-room/artifacts';
import { EgoBrowserPort } from '@signal-room/browser-ego';
import { SignalRoomDatabase } from '@signal-room/storage';
import { SignalRoomService } from './service.js';

const source = process.env.SIGNAL_ROOM_REAL_XHS_URL;
if (!source) {
  throw new Error(
    'Set SIGNAL_ROOM_REAL_XHS_URL to an authorized Xiaohongshu post/share URL.',
  );
}

const validationRoot = await mkdtemp(
  join(tmpdir(), 'signal-room-real-validation-'),
);
const database = new SignalRoomDatabase(
  join(validationRoot, 'validation.sqlite'),
);
const service = new SignalRoomService(
  database,
  new ArtifactStore(join(validationRoot, 'artifacts')),
  new EgoBrowserPort({
    profile: requiredEnvironment('SIGNAL_ROOM_EGO_PROFILE'),
    taskSpace: requiredEnvironment('SIGNAL_ROOM_EGO_TASK_SPACE'),
  }),
);

try {
  const preview = await service.resolveAndCollect(source);
  const project = service.createProject({
    contentId: preview.contentId,
    objective: 'authority',
    researchQuestion: '这条内容目前有哪些可验证的公开事实与研究边界？',
  });
  const run = service.startRun(project.id);
  const persistedRun = await waitForTerminalRun(service, run.id);
  const view = service.getProject(project.id) as {
    project: { status: string };
    findings: Array<{
      type: string;
      confidence: string;
      review_status: string;
      evidence: Array<{ relation: string }>;
    }>;
  };
  process.stdout.write(
    `${JSON.stringify(
      {
        source: 'authorized Xiaohongshu post (redacted)',
        collection: 'ego-browser authenticated read-only',
        contentType: preview.contentType,
        knownPublicMetricFields: Object.entries(preview.metrics)
          .filter(([, value]) => value !== null)
          .map(([name]) => name),
        viewsRemainUnknown: preview.metrics.views === null,
        projectStatus: view.project.status,
        runStatus: persistedRun?.status,
        findingContract: view.findings.map((finding) => ({
          type: finding.type,
          confidence: finding.confidence,
          reviewStatus: finding.review_status,
          relations: finding.evidence.map((evidence) => evidence.relation),
        })),
        artifacts: 'external temporary validation root (not printed)',
      },
      null,
      2,
    )}\n`,
  );
} finally {
  database.close();
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function waitForTerminalRun(
  signalRoom: SignalRoomService,
  runId: string,
) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const run = signalRoom.getRun(runId);
    if (
      run &&
      ['complete', 'partial', 'blocked', 'failed'].includes(run.status)
    ) {
      return run;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for the validation run to finish.');
}
