import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useTheme } from '../../theme/ThemeProvider';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

/** Filled glyph when active, outline when not (DESIGN.md, Icons). */
const TABS: { name: string; title: string; active: IconName; inactive: IconName }[] = [
  { name: 'index', title: 'Chats', active: 'chat-bubble', inactive: 'chat-bubble-outline' },
  { name: 'updates', title: 'Updates', active: 'donut-large', inactive: 'donut-large' },
  { name: 'communities', title: 'Communities', active: 'groups', inactive: 'groups' },
  { name: 'calls', title: 'Calls', active: 'call', inactive: 'call' },
];

export default function TabsLayout() {
  const { colors, iconSizes, type } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tide.primary,
        tabBarInactiveTintColor: colors.tide.onSurfaceVariant,
        tabBarLabelStyle: type('labelSm'),
        tabBarStyle: {
          backgroundColor: colors.tide.surface,
          borderTopWidth: 1,
          borderTopColor: colors.messaging.separator,
        },
      }}
    >
      {TABS.map(({ name, title, active, inactive }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color, focused }) => (
              <MaterialIcons name={focused ? active : inactive} size={iconSizes.tab} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
