import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, View } from 'react-native';

import { InfoRow, InfoSection, QuickActions } from '../../../components/group/InfoSection';
import { MemberRow } from '../../../components/group/MemberRow';
import { TextPrompt } from '../../../components/group/TextPrompt';
import { Avatar, Screen, Text } from '../../../components/ui';
import { chatMedia } from '../../../db/attachments';
import { getChat, setChatFlags } from '../../../db/chats';
import { useLiveQuery } from '../../../hooks/useLiveQuery';
import { useMembers, useMyRole } from '../../../hooks/useMembers';
import { useSignedUrls } from '../../../hooks/useSignedUrls';
import { isMuted } from '../../../services/chatList';
import {
  MAX_SUBJECT_LENGTH,
  canManageMembers,
  memberCountLabel,
  mustPromoteBeforeExit,
  participantsLabel,
} from '../../../services/groups';
import {
  exitGroup,
  removeMember,
  renameGroup,
  setGroupIcon,
  setRole,
} from '../../../services/groupSync';
import { publicUrl } from '../../../services/media';
import { useSession } from '../../../stores/session';
import { useTheme } from '../../../theme/ThemeProvider';

/** Mute is a duration in WhatsApp, not a boolean; eight hours is its middle option. */
const MUTE_MS = 8 * 60 * 60 * 1000;
/** Only the first few participants are listed; the rest are one tap away. */
const MEMBERS_SHOWN = 6;

export default function GroupInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chatId = id ?? '';
  const { colors, spacing, radii, iconSizes } = useTheme();
  const viewerId = useSession((s) => s.userId) ?? '';

  const chat = useLiveQuery(() => getChat(chatId), [chatId]);
  const members = useMembers(chatId, viewerId);
  const role = useMyRole(chatId);
  const media = useLiveQuery(() => chatMedia(chatId), [chatId]);
  const mediaUrls = useSignedUrls(
    media.items.filter((item) => !item.localUri).map((item) => item.storagePath),
  );

  const [expanded, setExpanded] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const isAdmin = canManageMembers(role);
  const muted = chat ? isMuted(chat) : false;

  const changeIcon = useCallback(async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (picked.canceled || !picked.assets[0]) return;
    try {
      await setGroupIcon(chatId, picked.assets[0].uri);
    } catch {
      Alert.alert('Could not change the icon', 'Only group admins can change the group icon.');
    }
  }, [chatId]);

  const rename = useCallback(
    (next: string) => {
      setRenaming(false);
      void renameGroup(chatId, next).catch(() =>
        Alert.alert('Could not rename', 'Only group admins can change the subject.'),
      );
    },
    [chatId],
  );

  /**
   * Long-pressing a member is the only management affordance, and it is admin-only.
   * The server refuses these regardless — hiding the sheet keeps a non-admin from
   * discovering an action that would always fail.
   */
  const manageMember = useCallback(
    (userId: string, displayName: string, memberRole: 'member' | 'admin') => {
      if (!isAdmin || userId === viewerId) return;

      Alert.alert(displayName, undefined, [
        {
          text: memberRole === 'admin' ? 'Dismiss as admin' : 'Make group admin',
          onPress: () => {
            void setRole(chatId, userId, memberRole === 'admin' ? 'member' : 'admin', viewerId).catch(
              () => Alert.alert('Refused', 'The server would not apply that change.'),
            );
          },
        },
        {
          text: `Remove ${displayName}`,
          style: 'destructive',
          onPress: () => {
            void removeMember(chatId, userId, viewerId).catch(() =>
              Alert.alert('Refused', 'Only group admins can remove participants.'),
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [isAdmin, viewerId, chatId],
  );

  const leave = useCallback(() => {
    if (mustPromoteBeforeExit(members, viewerId)) {
      Alert.alert(
        'Choose another admin first',
        'You are the only admin. Promote someone else before you leave, or nobody will be able to manage this group.',
      );
      return;
    }

    Alert.alert('Exit group', `Exit "${chat?.title ?? ''}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Exit',
        style: 'destructive',
        onPress: () => {
          void exitGroup(chatId, viewerId)
            .then(() => router.dismissAll())
            .catch(() => Alert.alert('Could not leave', 'Promote another admin and try again.'));
        },
      },
    ]);
  }, [members, viewerId, chat?.title, chatId]);

  const shown = expanded ? members : members.slice(0, MEMBERS_SHOWN);

  return (
    <Screen
      title="Group info"
      titleTint={colors.tide.onBackground}
      barHeight={spacing.listItemHeight}
      leading={
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={iconSizes.xl} color={colors.tide.primary} />
        </Pressable>
      }
    >
      <ScrollView style={{ backgroundColor: colors.tide.background }}>
        {/* Hero */}
        <View
          style={{
            alignItems: 'center',
            paddingTop: spacing.edgeMargin * 1.5,
            paddingBottom: spacing.edgeMargin * 2,
            backgroundColor: colors.tide.surfaceContainerLowest,
            borderBottomWidth: 1,
            borderBottomColor: colors.messaging.separator,
          }}
        >
          <View>
            <Avatar
              uri={chat?.avatarPath ? publicUrl('avatars', chat.avatarPath) : null}
              name={chat?.title ?? ''}
              size="xl"
            />
            {isAdmin ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Change group icon"
                onPress={() => void changeIcon()}
                style={{
                  position: 'absolute',
                  right: 0,
                  bottom: 0,
                  width: 32,
                  height: 32,
                  borderRadius: radii.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.tide.primaryContainer,
                  borderWidth: 2,
                  borderColor: colors.tide.surfaceContainerLowest,
                }}
              >
                <MaterialIcons name="photo-camera" size={16} color={colors.tide.onPrimaryContainer} />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            accessibilityRole={isAdmin ? 'button' : undefined}
            onPress={isAdmin ? () => setRenaming(true) : undefined}
            style={{ alignItems: 'center', marginTop: spacing.edgeMargin }}
          >
            <Text variant="heroTitle" tint={colors.tide.onBackground}>
              {chat?.title ?? ''}
            </Text>
          </Pressable>
          <Text variant="sectionHeader" tint={colors.tide.onSurfaceVariant} style={{ marginTop: 2 }}>
            {memberCountLabel(members.length)}
          </Text>

          {/* Group calls need a mesh of peer connections, which waits until 1:1 is
              proven on real devices — so these say so rather than failing quietly. */}
          <QuickActions
            actions={[
              {
                icon: 'call',
                label: 'Audio',
                onPress: () => Alert.alert('Not yet', 'Group calls arrive after 1:1 calling is verified.'),
              },
              {
                icon: 'videocam',
                label: 'Video',
                onPress: () => Alert.alert('Not yet', 'Group calls arrive after 1:1 calling is verified.'),
              },
              { icon: 'search', label: 'Search' },
            ]}
          />
        </View>

        {/* Shared media */}
        {media.total > 0 ? (
          <InfoSection
            title="Media, links, and docs"
            trailing={
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text variant="labelSm" tint={colors.tide.onSurfaceVariant}>
                  {media.total}
                </Text>
                <MaterialIcons name="chevron-right" size={iconSizes.sm} color={colors.tide.onSurfaceVariant} />
              </View>
            }
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.edgeMargin, gap: spacing.stackSm }}
            >
              {media.items.map((item) => (
                <View
                  key={item.id}
                  style={{
                    width: spacing.mediaThumb,
                    height: spacing.mediaThumb,
                    borderRadius: radii.lg,
                    overflow: 'hidden',
                    backgroundColor: colors.tide.surfaceContainer,
                  }}
                >
                  <Image
                    source={{ uri: item.localUri ?? mediaUrls.get(item.storagePath) ?? undefined }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                  />
                </View>
              ))}
            </ScrollView>
          </InfoSection>
        ) : null}

        {/* Settings */}
        <InfoSection>
          <InfoRow
            icon="notifications"
            label="Mute"
            trailing={
              <Switch
                value={muted}
                onValueChange={(next) =>
                  setChatFlags(chatId, { mutedUntil: next ? Date.now() + MUTE_MS : null })
                }
                trackColor={{ true: colors.tide.primaryContainer, false: colors.tide.surfaceVariant }}
                thumbColor={colors.tide.surfaceContainerLowest}
              />
            }
          />
          <InfoRow icon="timer" label="Disappearing messages" subtitle="Off" chevron />
        </InfoSection>

        {/* Participants */}
        <InfoSection title={participantsLabel(members.length)}>
          {isAdmin ? (
            <InfoRow
              icon="person-add"
              label="Add members"
              tint={colors.tide.primary}
              onPress={() => router.push(`/add-members?chatId=${chatId}`)}
            />
          ) : null}

          {shown.map((member) => (
            <MemberRow
              key={member.userId}
              member={member}
              viewerId={viewerId}
              onPress={() =>
                member.userId === viewerId ? undefined : router.push(`/contact/${member.userId}`)
              }
              onLongPress={() => manageMember(member.userId, member.displayName, member.role)}
            />
          ))}

          {!expanded && members.length > MEMBERS_SHOWN ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setExpanded(true)}
              style={{ paddingHorizontal: spacing.edgeMargin, paddingVertical: spacing.stackMd }}
            >
              <Text variant="chatName" tint={colors.tide.primary}>
                View all ({members.length - MEMBERS_SHOWN} more)
              </Text>
            </Pressable>
          ) : null}
        </InfoSection>

        {/* Danger zone */}
        <InfoSection>
          <InfoRow icon="logout" label="Exit group" tint={colors.tide.error} onPress={leave} />
          <InfoRow icon="thumb-down" label="Report group" tint={colors.tide.error} />
        </InfoSection>

        <View style={{ height: spacing.edgeMargin * 2 }} />
      </ScrollView>

      <TextPrompt
        visible={renaming}
        title="Group subject"
        initialValue={chat?.title ?? ''}
        maxLength={MAX_SUBJECT_LENGTH}
        onCancel={() => setRenaming(false)}
        onConfirm={rename}
      />
    </Screen>
  );
}
