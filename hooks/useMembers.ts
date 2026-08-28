import { listMembers, myRole } from '../db/members';
import { listKnownProfiles } from '../db/profiles';
import { sortMembers, type GroupMember, type MemberRole, type PickerCandidate } from '../services/groups';
import { useLiveQuery } from './useLiveQuery';

/** The membership of a chat, already ordered the way the info screen renders it. */
export function useMembers(chatId: string, viewerId: string): GroupMember[] {
  const members = useLiveQuery(() => listMembers(chatId), [chatId]);
  return sortMembers(members, viewerId);
}

/** The viewer's role in this chat, which gates every management affordance. */
export function useMyRole(chatId: string): MemberRole | null {
  return useLiveQuery(() => myRole(chatId), [chatId]);
}

/** Everyone the device knows: matched contacts plus anyone met in a chat. */
export function useKnownProfiles(excludeIds: string[] = []): PickerCandidate[] {
  return useLiveQuery(() => listKnownProfiles(excludeIds), [excludeIds.join(',')]);
}
