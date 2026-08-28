import { MaterialIcons } from '@expo/vector-icons';

import { PhaseStub, Screen } from '../../components/ui/Screen';
import { Avatar } from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';

export default function ChatsScreen() {
  const { colors, iconSizes } = useTheme();

  return (
    <Screen
      title="Chats"
      leading={<Avatar name="Wave" size="sm" />}
      trailing={<MaterialIcons name="photo-camera" size={iconSizes.xl} color={colors.tide.primary} />}
    >
      <PhaseStub phase={3} what="Chat list" />
    </Screen>
  );
}
