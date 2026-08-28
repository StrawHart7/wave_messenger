import { usePathname, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useSession } from '../../stores/session';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * Routes on session status. Kept as a component rather than logic inside the root
 * layout so it sits *below* the providers and can read the store and the theme.
 *
 * The redirect runs in an effect, not during render: navigating while rendering is
 * what produces the "Attempted to navigate before mounting" crash on cold start.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const status = useSession((s) => s.status);
  const initialize = useSession((s) => s.initialize);
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => initialize(), [initialize]);

  useEffect(() => {
    if (status === 'loading') return;

    const inAuthFlow = segments[0] === '(auth)';

    if (status === 'signed-out' && !inAuthFlow) {
      router.replace('/phone');
    } else if (status === 'onboarding' && pathname !== '/profile-setup') {
      router.replace('/profile-setup');
    } else if (status === 'ready' && inAuthFlow) {
      router.replace('/');
    }
  }, [status, segments, pathname, router]);

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tide.background }}>
        <ActivityIndicator color={colors.tide.primary} />
      </View>
    );
  }

  return <>{children}</>;
}
