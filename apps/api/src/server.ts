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
  profile: process.env.SIGNAL_ROOM_EGO_PROFILE ?? 'hhh-01',
  taskSpace: process.env.SIGNAL_ROOM_EGO_TASK_SPACE ?? 'signal-room xhs mvp',
});
const app = buildApp(new SignalRoomService(database, artifacts, browser));

await app.listen({
  port: Number(process.env.SIGNAL_ROOM_API_PORT ?? 4317),
  host: '127.0.0.1',
});
