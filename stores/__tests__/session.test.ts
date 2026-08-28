import type { Session } from '@supabase/supabase-js';

import { statusFor } from '../session';

const session = { user: { id: 'u1' } } as unknown as Session;
const profile = { id: 'u1', displayName: 'Ada', avatarPath: null, about: null };

describe('statusFor', () => {
  it('is signed-out without a session, whatever the profile says', () => {
    expect(statusFor(null, null)).toBe('signed-out');
    expect(statusFor(null, profile)).toBe('signed-out');
  });

  it('is onboarding when authenticated but the profile is not finished', () => {
    expect(statusFor(session, null)).toBe('onboarding');
  });

  it('is ready only with both a session and a complete profile', () => {
    expect(statusFor(session, profile)).toBe('ready');
  });
});
