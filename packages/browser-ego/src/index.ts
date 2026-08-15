import { spawn } from 'node:child_process';

export type BrowserStopReason =
  | 'needs_login'
  | 'captcha'
  | 'risk_control'
  | 'access_denied'
  | 'user_controlled'
  | 'task_space_inactive'
  | 'adapter_changed'
  | 'browser_unavailable';

export class BrowserStopError extends Error {
  constructor(
    readonly reason: BrowserStopReason,
    message: string,
    readonly recoveryAction: string,
  ) {
    super(message);
    this.name = 'BrowserStopError';
  }
}

export interface BrowserCollectionEnvelope {
  canonicalUrl: string;
  title: string;
  pageText: string;
  rawSnapshot: string;
  extracted: Record<string, unknown>;
  observedAt: string;
}

export interface AuthenticatedBrowserPort {
  readonly taskSpace: string;
  readonly profile: string;
  resolveAndCollect(url: string): Promise<BrowserCollectionEnvelope>;
}

export interface EgoBrowserOptions {
  taskSpace: string;
  profile: string;
  executable?: string;
  timeoutMs?: number;
}

const resultPrefix = 'SIGNAL_ROOM_RESULT:';

export class EgoBrowserPort implements AuthenticatedBrowserPort {
  readonly taskSpace: string;
  readonly profile: string;
  private readonly executable: string;
  private readonly timeoutMs: number;

  constructor(options: EgoBrowserOptions) {
    this.taskSpace = options.taskSpace;
    this.profile = options.profile;
    this.executable = options.executable ?? 'ego-browser';
    this.timeoutMs = options.timeoutMs ?? 45_000;
  }

  async resolveAndCollect(url: string): Promise<BrowserCollectionEnvelope> {
    const encodedInput = Buffer.from(
      JSON.stringify({ url, taskSpace: this.taskSpace }),
    ).toString('base64');
    const script = buildReadOnlyCollectionScript(encodedInput);
    const output = await this.execute(script);
    const marker = output.lastIndexOf(resultPrefix);
    if (marker === -1) {
      throw mapBrowserFailure(
        output || 'ego-browser returned no collection result',
      );
    }
    const line = output
      .slice(marker + resultPrefix.length)
      .split('\n')[0]
      ?.trim();
    if (!line) throw mapBrowserFailure(output);
    try {
      return JSON.parse(
        Buffer.from(line, 'base64').toString('utf8'),
      ) as BrowserCollectionEnvelope;
    } catch {
      throw new BrowserStopError(
        'adapter_changed',
        'ego-browser returned an unreadable collection envelope.',
        'Inspect the redacted adapter diagnostic and update the versioned extractor.',
      );
    }
  }

  private execute(script: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.executable, ['nodejs'], {
        env: { ...process.env, EGO_BROWSER_PROFILE: this.profile },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(
          new BrowserStopError(
            'browser_unavailable',
            'ego-browser collection timed out.',
            'Confirm ego-browser is running and retry the persisted Run.',
          ),
        );
      }, this.timeoutMs);
      child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
      child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(mapBrowserFailure(error.message));
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(stdout);
        else reject(mapBrowserFailure(`${stdout}\n${stderr}`));
      });
      child.stdin.end(script);
    });
  }
}

export function mapBrowserFailure(message: string): BrowserStopError {
  const normalized = message.toLowerCase();
  if (normalized.includes('user is controlling')) {
    return new BrowserStopError(
      'user_controlled',
      'The user currently controls the configured task space.',
      'Wait for explicit user confirmation, then resume from the persisted checkpoint.',
    );
  }
  if (normalized.includes('inactive') || normalized.includes('not assigned')) {
    return new BrowserStopError(
      'task_space_inactive',
      'The configured task space is inactive or unassigned.',
      'Ask the user for confirmation before claiming and resuming this task space.',
    );
  }
  if (normalized.includes('captcha') || normalized.includes('验证码')) {
    return new BrowserStopError(
      'captcha',
      'Xiaohongshu requires captcha verification.',
      'Hand the task space to the user for manual verification; do not bypass it.',
    );
  }
  if (normalized.includes('risk_control') || normalized.includes('风控')) {
    return new BrowserStopError(
      'risk_control',
      'Xiaohongshu displayed a risk-control interruption.',
      'Stop collection and hand the task space to the user.',
    );
  }
  if (normalized.includes('login_required')) {
    return new BrowserStopError(
      'needs_login',
      'The authenticated Xiaohongshu session is unavailable.',
      'Hand the task space to the user to log in, then wait for explicit confirmation.',
    );
  }
  if (normalized.includes('access_denied')) {
    return new BrowserStopError(
      'access_denied',
      'Xiaohongshu denied access to the requested post.',
      'Stop and verify access manually; do not route around the denial.',
    );
  }
  return new BrowserStopError(
    'browser_unavailable',
    'ego-browser could not complete the read-only collection.',
    'Verify the local ego-browser runtime and retry the persisted Run.',
  );
}

function buildReadOnlyCollectionScript(encodedInput: string): string {
  return `
const input = JSON.parse(Buffer.from('${encodedInput}', 'base64').toString('utf8'));
const task = await useOrCreateTaskSpace(input.taskSpace);
await openOrReuseTab(input.url, { wait: true, timeout: 30 });
await waitForLoad({ timeout: 20 }).catch(() => undefined);
const info = await pageInfo();
if (info && info.dialog) throw new Error('access_denied: native dialog blocked collection');
const pageText = await snapshotText();
const gate = await js(String.raw\`(() => {
  const text = (document.body?.innerText || '').slice(0, 12000);
  const url = location.href;
  const title = document.title;
  if (/captcha|验证码|请完成验证/i.test(text + title + url)) return 'captcha';
  if (/账号存在风险|访问异常|安全限制|risk.?control/i.test(text + title)) return 'risk_control';
  if (/访问被拒绝|无权限|access denied/i.test(text + title)) return 'access_denied';
  if (/登录后查看|请先登录/i.test(text + title)) return 'login_required';
  return null;
})()\`);
if (gate) throw new Error(gate);
const extracted = await js(String.raw\`(() => {
  const meta = Object.fromEntries([...document.querySelectorAll('meta')]
    .map((el) => [el.getAttribute('property') || el.getAttribute('name'), el.getAttribute('content')])
    .filter(([key, value]) => key && value));
  const findNote = (value, seen = new WeakSet(), depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 8 || seen.has(value)) return null;
    seen.add(value);
    if ((value.noteId || value.id) && (value.interactInfo || value.title || value.desc) && value.user) return value;
    for (const child of Object.values(value)) {
      const found = findNote(child, seen, depth + 1);
      if (found) return found;
    }
    return null;
  };
  let note = null;
  try { note = findNote(window.__INITIAL_STATE__); } catch {}
  let plainNote = null;
  try { plainNote = note ? JSON.parse(JSON.stringify(note)) : null; } catch {}
  return {
    canonicalUrl: document.querySelector('link[rel="canonical"]')?.href || location.href,
    meta,
    note: plainNote,
    bodyText: (document.body?.innerText || '').slice(0, 50000),
  };
})()\`);
const envelope = {
  canonicalUrl: extracted.canonicalUrl || info.url,
  title: info.title || '',
  pageText,
  rawSnapshot: JSON.stringify({ page: info, extracted }),
  extracted,
  observedAt: new Date().toISOString(),
};
cliLog('${resultPrefix}' + Buffer.from(JSON.stringify(envelope)).toString('base64'));
`;
}
