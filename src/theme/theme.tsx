import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cssInterop, useColorScheme, vars } from 'nativewind';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';

import palette from './palette';

// Let icons take their colour from a text class: <Ionicons className="text-ink" />.
cssInterop(Ionicons, { className: { target: 'style', nativeStyleToProp: { color: true } } });

export type ThemePreference = 'system' | 'light' | 'dark';
const PREFERENCE_KEY = 'fw.theme';

const themeVars = { light: vars(palette.light), dark: vars(palette.dark) };

const hex = (channels: string) =>
  `#${channels
    .split(' ')
    .map((n) => Number(n).toString(16).padStart(2, '0'))
    .join('')}`;

/** Theme colours as hex, for props that can't take a class (navigation backgrounds, SVG). */
export function useThemeColors() {
  const { colorScheme } = useColorScheme();
  const p = palette[colorScheme === 'dark' ? 'dark' : 'light'];
  return {
    dark: colorScheme === 'dark',
    surface: hex(p['--surface']),
    sky: hex(p['--sky']),
    ink: hex(p['--ink']),
    inkMuted: hex(p['--ink-muted']),
    line: hex(p['--line']),
  };
}

/** The user's choice (System, Light or Dark), remembered on the device. */
export function useThemePreference() {
  const { setColorScheme } = useColorScheme();
  const setPreference = (preference: ThemePreference) => {
    setColorScheme(preference);
    AsyncStorage.setItem(PREFERENCE_KEY, preference).catch(() => {});
  };
  return { setPreference };
}

export async function loadThemePreference(): Promise<ThemePreference> {
  const saved = await AsyncStorage.getItem(PREFERENCE_KEY).catch(() => null);
  return saved === 'light' || saved === 'dark' ? saved : 'system';
}

/** Applies the active scheme's colour variables to everything below it. */
/**
 * The colour variables for the current theme. Content rendered outside ThemeRoot (a Modal on web
 * is portalled to <body>) needs these on its own root, or theme colours come out blank.
 */
export function useThemeVars() {
  const { colorScheme } = useColorScheme();
  return themeVars[colorScheme === 'dark' ? 'dark' : 'light'];
}

export function ThemeRoot({ children }: { children: ReactNode }) {
  const { colorScheme, setColorScheme } = useColorScheme();

  useEffect(() => {
    loadThemePreference().then(setColorScheme);
  }, [setColorScheme]);

  return (
    <View
      style={[{ flex: 1 }, themeVars[colorScheme === 'dark' ? 'dark' : 'light']]}
      className="bg-surface">
      {children}
    </View>
  );
}
