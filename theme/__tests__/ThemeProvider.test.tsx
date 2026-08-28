import { act, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';

import { setStorageDriver, type StorageDriver } from '../../services/storage';
import { ThemeProvider, useTheme } from '../ThemeProvider';

function memoryDriver(seed: Record<string, string> = {}): StorageDriver & { data: Map<string, string> } {
  const data = new Map(Object.entries(seed));
  return {
    data,
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => {
      data.set(key, value);
    },
    remove: async (key) => {
      data.delete(key);
    },
  };
}

// Handle onto the provider's setter so a test can drive it from the outside. Assigned
// in an effect, never during render.
const control: { setPreference?: ReturnType<typeof useTheme>['setPreference'] } = {};

function Probe() {
  const theme = useTheme();
  useEffect(() => {
    control.setPreference = theme.setPreference;
  }, [theme.setPreference]);

  return (
    <>
      <Text testID="scheme">{theme.scheme}</Text>
      <Text testID="bubble">{theme.colors.messaging.bubbleOutgoing}</Text>
      <Text testID="body-font">{String(theme.type('messageBody').fontFamily)}</Text>
    </>
  );
}

// react-native-testing-library v14 renders asynchronously — `render` must be awaited
// before `screen` is populated.
const mount = () =>
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );

const textOf = (testID: string) => screen.getByTestId(testID).props.children;

describe('ThemeProvider', () => {
  afterEach(() => setStorageDriver());

  it('defaults to the system scheme and resolves tokens for it', async () => {
    setStorageDriver(memoryDriver());
    await mount();

    // jest-expo reports a light system scheme by default.
    expect(textOf('scheme')).toBe('light');
    expect(textOf('bubble')).toBe('#D9FDD3');
    expect(textOf('body-font')).toBe('BeVietnamPro_400Regular');
  });

  it('restores a stored preference over the system scheme', async () => {
    setStorageDriver(memoryDriver({ 'theme.preference': 'dark' }));
    await mount();

    await waitFor(() => expect(textOf('scheme')).toBe('dark'));
    expect(textOf('bubble')).toBe('#005C4B');
  });

  it('persists a preference change', async () => {
    const driver = memoryDriver();
    setStorageDriver(driver);
    await mount();

    await act(async () => control.setPreference?.('dark'));

    expect(textOf('scheme')).toBe('dark');
    await waitFor(() => expect(driver.data.get('theme.preference')).toBe('dark'));
  });
});
