import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { ArtifactStore } from '@signal-room/artifacts';
import { EgoBrowserPort } from '@signal-room/browser-ego';
import { SignalRoomDatabase } from '@signal-room/storage';
import { buildApp } from './app.js';
import { SignalRoomService } from './service.js';

const databasePath = resolve(
  process.env.SIGNAL_ROOM_DATABASE_PATH ?? '.signal-room/signal-room.sqlite',
);
const artifactRoot = resolve(
  process.env.SIGNAL_ROOM_ARTIFACT_ROOT ??
    join(
      homedir(),
      'Library',
      'Application Support',
      'Signal Room',
      'artifacts',
    ),
);
mkdirSync(dirname(databasePath), { recursive: true });
const database = new SignalRoomDatabase(databasePath);
const artifacts = new ArtifactStore(
  artifactRoot,
  resolve(import.meta.dirname, '../../..'),
);
const browser = new EgoBrowserPort({
  profile: requiredEnvironment('SIGNAL_ROOM_EGO_PROFILE'),
  taskSpace: requiredEnvironment('SIGNAL_ROOM_EGO_TASK_SPACE'),
});
const app = buildApp(new SignalRoomService(database, artifacts, browser), {
  allowedOrigins: configuredLocalOrigins(
    requiredEnvironment('SIGNAL_ROOM_WEB_ORIGIN'),
  ),
});

await app.listen({
  port: Number(process.env.SIGNAL_ROOM_API_PORT ?? 4317),
  host: '127.0.0.1',
});

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function configuredLocalOrigins(value: string): string[] {
  return value.split(',').map((entry) => {
    const url = new URL(entry.trim());
    if (
      url.protocol !== 'http:' ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    ) {
      throw new Error(
        'SIGNAL_ROOM_WEB_ORIGIN must contain only explicit local HTTP origins.',
      );
    }
    return url.origin;
  });
}
