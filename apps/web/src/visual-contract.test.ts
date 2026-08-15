import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');

describe('approved visual contract', () => {
  it('uses only the approved semantic palette and typography anchors', () => {
    expect(css).toContain('--graphite: #111418');
    expect(css).toContain('--paper: #f4f0e8');
    expect(css).toContain('--evidence: #22795e');
    expect(css).toContain('--signal: #e66b2e');
    expect(css).toContain('--caution: #a57c20');
    expect(css).toContain("'Noto Serif SC'");
    expect(css).toContain("'IBM Plex Sans'");
    expect(css).toContain("'IBM Plex Mono'");
    expect(css).not.toMatch(/linear-gradient|radial-gradient/i);
  });

  it('contains no emoji glyphs in interface source', () => {
    expect(app).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('implements the desktop three-pane contract and narrow-screen breakpoints', () => {
    expect(css).toContain(
      'grid-template-columns: 216px minmax(680px, 1fr) minmax(360px, 420px)',
    );
    expect(css).toContain('@media (max-width: 1023px)');
    expect(css).toContain('transform: translateX(100%)');
  });
});
