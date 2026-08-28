import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { fetchProfile, type Profile } from '../services/auth';
import { isSupabaseConfigured, supabase } from '../services/supabase';

/**
 * Three states the router cares about, and they are not the same thing:
 *  - `loading`   we do not yet know whether there is a session (first paint)
 *  - `signed-out`
 *  - `onboarding` authenticated but the profile row has no display name yet
 *  - `ready`     authenticated with a complete profile
 */
export type SessionStatus = 'loading' | 'signed-out' | 'onboarding' | 'ready';

type SessionState = {
  status: SessionStatus;
  userId: string | null;
  /** E.164, kept so the OTP and profile screens can show and reuse it. */
  phone: string | null;
  profile: Profile | null;
  setPendingPhone: (e164: string | null) => void;
  setProfile: (profile: Profile) => void;
  /** Subscribes to Supabase auth changes; returns the unsubscribe. */
  initialize: () => () => void;
  reset: () => void;
};

export function statusFor(session: Session | null, profile: Profile | null): SessionStatus {
  if (!session) return 'signed-out';
  return profile ? 'ready' : 'onboarding';
}

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading',
  userId: null,
  phone: null,
  profile: null,

  setPendingPhone: (e164) => set({ phone: e164 }),

  setProfile: (profile) => set({ profile, status: 'ready' }),

  initialize: () => {
    if (!isSupabaseConfigured) {
      // No credentials yet: present the app as signed out rather than spinning
      // forever on a client that cannot answer.
      set({ status: 'signed-out' });
      return () => {};
    }

    const apply = async (session: Session | null) => {
      if (!session?.user) {
        set({ status: 'signed-out', userId: null, profile: null });
        return;
      }
      const profile = await fetchProfile(session.user.id).catch(() => null);
      set({
        status: statusFor(session, profile),
        userId: session.user.id,
        phone: session.user.phone ? `+${session.user.phone.replace(/^\+/, '')}` : get().phone,
        profile,
      });
    };

    void supabase.auth.getSession().then(({ data }) => apply(data.session));

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void apply(session);
    });

    return () => data.subscription.unsubscribe();
  },

  reset: () => set({ status: 'signed-out', userId: null, phone: null, profile: null }),
}));
