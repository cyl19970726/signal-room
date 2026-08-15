import { describe, expect, it } from 'vitest';
import { combineCliOutput, mapBrowserFailure } from './index.js';

describe('ego-browser failure mapping', () => {
  it.each([
    ['user is controlling this task space', 'user_controlled'],
    ['captcha required', 'captcha'],
    ['risk_control interstitial', 'risk_control'],
    ['login_required', 'needs_login'],
    ['task space inactive', 'task_space_inactive'],
  ] as const)('maps %s to a hard stop', (message, expected) => {
    expect(mapBrowserFailure(message).reason).toBe(expected);
  });
});

it('reads cliLog protocol markers from stderr without persisting a diagnostic log', () => {
  expect(combineCliOutput('', 'SIGNAL_ROOM_RESULT:encoded')).toBe(
    'SIGNAL_ROOM_RESULT:encoded',
  );
});
