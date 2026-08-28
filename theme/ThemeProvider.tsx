import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme as useSystemColorScheme, type TextStyle } from 'react-native';

import { storage } from '../services/storage';
import { fontFamilyFor, type FontWeightToken } from './fontFamilies';
import {
  elevation,
  iconSizes,
  palettes,
  radii,
  spacing,
  typography,
  type ColorScheme,
  type Palette,
  type TypeRole,
} from './tokens';

/** What the user picked. `system` follows the OS and is the default. */
export type ThemePreference = ColorScheme | 'system';

const PREFERENCE_KEY = 'theme.preference';

type Theme = {
  scheme: ColorScheme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  colors: Palette;
  spacing: typeof spacing;
  radii: typeof radii;
  elevation: typeof elevation;
  iconSizes: typeof iconSizes;
  /** Resolves a type role into a ready-to-spread RN text style. */
  type: (role: TypeRole) => TextStyle;
};

const ThemeContext = createContext<Theme | null>(null);

function isPreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    let cancelled = false;
    void storage.get(PREFERENCE_KEY).then((stored) => {
      if (!cancelled && isPreference(stored)) setPreferenceState(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<Theme>(() => {
    // useColorScheme can also report 'unspecified'; anything that is not an explicit
    // dark signal falls back to light.
    const systemResolved: ColorScheme = systemScheme === 'dark' ? 'dark' : 'light';
    const scheme: ColorScheme = preference === 'system' ? systemResolved : preference;
    const colors = palettes[scheme];

    return {
      scheme,
      preference,
      setPreference: (next) => {
        setPreferenceState(next);
        void storage.set(PREFERENCE_KEY, next);
      },
      colors,
      spacing,
      radii,
      elevation,
      iconSizes,
      type: (role) => {
        const { weight, ...rest } = typography[role];
        return { ...rest, fontFamily: fontFamilyFor(weight as FontWeightToken) };
      },
    };
  }, [preference, systemScheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside a ThemeProvider');
  return theme;
}
