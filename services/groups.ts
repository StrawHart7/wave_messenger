/**
 * Group rules — pure, so the parts that decide who may do what, what the header
 * says, and which colour a sender's name takes are testable without a device.
 * Anything that talks to Supabase or SQLite lives in services/groupSync.ts.
 */

export type MemberRole = 'member' | 'admin';

export type GroupMember = {
  userId: string;
  displayName: string;
  avatarPath: string | null;
  about: string | null;
  role: MemberRole;
};

/** WhatsApp's own limits, and the ones the picker enforces. */
export const MAX_SUBJECT_LENGTH = 25;
export const MAX_MEMBERS = 256;

export function normalizeSubject(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_SUBJECT_LENGTH);
}

export function isValidSubject(raw: string): boolean {
  return normalizeSubject(raw).length > 0;
}

/**
 * You first, then admins, then alphabetical. Putting yourself at the top is what
 * makes "You" and the leave affordance findable without scrolling a 200-row list.
 */
export function sortMembers(members: GroupMember[], viewerId: string): GroupMember[] {
  return [...members].sort((a, b) => {
    if (a.userId === viewerId) return -1;
    if (b.userId === viewerId) return 1;
    if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });
}

export function participantsLabel(count: number): string {
  return count === 1 ? '1 participant' : `${count} participants`;
}

export function memberCountLabel(count: number): string {
  return count === 1 ? 'Group · 1 member' : `Group · ${count} members`;
}

/**
 * The header's second line: member names with you first, truncated with a "+n"
 * rather than an ellipsis so the number of people stays legible.
 */
export function headerMemberLine(members: GroupMember[], viewerId: string, max = 4): string {
  const ordered = sortMembers(members, viewerId);
  const names = ordered.map((member) => (member.userId === viewerId ? 'You' : member.displayName));
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')}, +${names.length - max}`;
}

/** "Anna is typing…" — attribution matters in a group, a bare "typing…" does not. */
export function typingAttribution(names: string[]): string {
  const present = names.filter((name) => name.trim().length > 0);
  if (present.length === 0) return '';
  if (present.length === 1) return `${present[0]} is typing…`;
  if (present.length === 2) return `${present[0]} and ${present[1]} are typing…`;
  return `${present.length} people are typing…`;
}

/** Typing wins over the member list; that is the line people actually look at. */
export function groupSubtitle(input: { typingNames: string[]; memberLine: string }): string {
  const typing = typingAttribution(input.typingNames);
  return typing.length > 0 ? typing : input.memberLine;
}

/**
 * A stable index into `colors.messaging.senderTints`. Hashed from the user id, not
 * from their position in the list: a member joining must not repaint everyone else.
 */
export function senderTintIndex(userId: string, ringSize: number): number {
  if (ringSize <= 0) return 0;
  let hash = 0;
  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash * 31 + userId.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % ringSize;
}

export function canManageMembers(role: MemberRole | null): boolean {
  return role === 'admin';
}

export function canEditGroup(role: MemberRole | null): boolean {
  return role === 'admin';
}

/**
 * A group with no admin left is a group nobody can ever repair — no one can rename
 * it, add anyone, or remove anyone. The last admin has to hand the role over first.
 */
export function mustPromoteBeforeExit(members: GroupMember[], viewerId: string): boolean {
  const viewer = members.find((member) => member.userId === viewerId);
  if (viewer?.role !== 'admin') return false;
  if (members.length <= 1) return false;
  return members.filter((member) => member.role === 'admin').length === 1;
}

export type SystemEvent =
  | { action: 'created'; actor: string }
  | { action: 'renamed'; actor: string; subject: string }
  | { action: 'icon'; actor: string }
  | { action: 'added'; actor: string; target: string }
  | { action: 'removed'; actor: string; target: string }
  | { action: 'left'; actor: string }
  | { action: 'promoted'; actor: string; target: string }
  | { action: 'demoted'; actor: string; target: string };

/**
 * Membership changes read as messages in the thread, so the history explains itself
 * without a separate audit screen. The text is baked at write time rather than
 * resolved on render — a removed member still has to be named after they are gone.
 */
export function systemMessageText(event: SystemEvent): string {
  switch (event.action) {
    case 'created':
      return `${event.actor} created this group`;
    case 'renamed':
      return `${event.actor} changed the subject to "${event.subject}"`;
    case 'icon':
      return `${event.actor} changed this group's icon`;
    case 'added':
      return `${event.actor} added ${event.target}`;
    case 'removed':
      return `${event.actor} removed ${event.target}`;
    case 'left':
      return `${event.actor} left`;
    case 'promoted':
      return `${event.actor} made ${event.target} an admin`;
    case 'demoted':
      return `${event.actor} dismissed ${event.target} as admin`;
  }
}

export type PickerCandidate = {
  userId: string;
  displayName: string;
  avatarPath: string | null;
  about: string | null;
};

/** The picker list: excluded ids removed, matched on name, alphabetical. */
export function filterCandidates(
  candidates: PickerCandidate[],
  options: { query: string; excluded?: string[] },
): PickerCandidate[] {
  const needle = options.query.trim().toLowerCase();
  const excluded = new Set(options.excluded ?? []);

  return candidates
    .filter((candidate) => !excluded.has(candidate.userId))
    .filter((candidate) => needle.length === 0 || candidate.displayName.toLowerCase().includes(needle))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function selectionLabel(count: number): string {
  return count === 0 ? 'Add participants' : `${count} of ${MAX_MEMBERS} selected`;
}

/** The picker refuses an empty group and one over the ceiling. */
export function canCreateGroup(input: { subject: string; memberIds: string[] }): boolean {
  return (
    isValidSubject(input.subject) &&
    input.memberIds.length > 0 &&
    // The creator counts against the ceiling too.
    input.memberIds.length + 1 <= MAX_MEMBERS
  );
}
