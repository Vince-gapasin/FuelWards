import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { useEffect } from 'react';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';

const STAY_LOGGED_IN_KEY = 'fw.stayLoggedIn';

type AuthState = {
  session: Session | null;
  /** True once the stored session has been restored (or discarded) on launch. */
  initialized: boolean;
  /**
   * True while a password reset is in progress. Verifying the reset code briefly signs the user
   * in; this keeps them on the reset screen until the new password is saved and they sign out.
   */
  recovering: boolean;
  setRecovering: (recovering: boolean) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  initialized: false,
  recovering: false,
  setRecovering: (recovering) => set({ recovering }),
}));

/** Whether the app should show the signed-in screens. */
export function useIsSignedIn() {
  return useAuthStore((s) => s.session !== null && !s.recovering);
}

export async function setStayLoggedIn(value: boolean) {
  await AsyncStorage.setItem(STAY_LOGGED_IN_KEY, value ? 'true' : 'false');
}

/** Restores the session on launch and keeps the store in sync with Supabase Auth. */
export function useAuthListener() {
  useEffect(() => {
    let active = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      let session = data.session;
      // "Stay logged in" unchecked: a session left over from a previous launch is discarded.
      if (session && (await AsyncStorage.getItem(STAY_LOGGED_IN_KEY)) === 'false') {
        await supabase.auth.signOut({ scope: 'local' });
        session = null;
      }
      if (active) useAuthStore.setState({ session, initialized: true });
    })();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      useAuthStore.setState({ session });
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
}
