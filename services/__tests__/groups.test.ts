import {
  MAX_MEMBERS,
  canCreateGroup,
  canManageMembers,
  filterCandidates,
  groupSubtitle,
  headerMemberLine,
  isValidSubject,
  memberCountLabel,
  mustPromoteBeforeExit,
  normalizeSubject,
  participantsLabel,
  selectionLabel,
  senderTintIndex,
  sortMembers,
  systemMessageText,
  typingAttribution,
  type GroupMember,
} from '../groups';

function member(userId: string, displayName: string, role: 'member' | 'admin' = 'member'): GroupMember {
  return { userId, displayName, avatarPath: null, about: null, role };
}

describe('subjects', () => {
  it('collapses whitespace and trims', () => {
    expect(normalizeSubject('  Design   crew  ')).toBe('Design crew');
  });

  it('truncates at the WhatsApp limit', () => {
    expect(normalizeSubject('x'.repeat(60))).toHaveLength(25);
  });

  it('rejects a subject that is only whitespace', () => {
    expect(isValidSubject('   ')).toBe(false);
    expect(isValidSubject('Design crew')).toBe(true);
  });
});

describe('sortMembers', () => {
  const members = [
    member('c', 'Anna'),
    member('a', 'Zoe', 'admin'),
    member('me', 'Me'),
    member('b', 'David', 'admin'),
  ];

  it('puts the viewer first, then admins, then names', () => {
    expect(sortMembers(members, 'me').map((m) => m.userId)).toEqual(['me', 'b', 'a', 'c']);
  });

  it('does not mutate the input', () => {
    const copy = [...members];
    sortMembers(members, 'me');
    expect(members).toEqual(copy);
  });
});

describe('header lines', () => {
  const members = [
    member('me', 'Me'),
    member('a', 'Anna'),
    member('b', 'David'),
    member('c', 'Sarah'),
    member('d', 'Tom'),
    member('e', 'Uma'),
  ];

  it('names the viewer "You" and puts them first', () => {
    expect(headerMemberLine(members.slice(0, 3), 'me')).toBe('You, Anna, David');
  });

  it('counts the overflow rather than trailing off', () => {
    expect(headerMemberLine(members, 'me', 4)).toBe('You, Anna, David, Sarah, +2');
  });

  it('labels the participant and member counts', () => {
    expect(participantsLabel(1)).toBe('1 participant');
    expect(participantsLabel(8)).toBe('8 participants');
    expect(memberCountLabel(8)).toBe('Group · 8 members');
  });
});

describe('typingAttribution', () => {
  it('names one and two typists, then counts', () => {
    expect(typingAttribution(['Anna'])).toBe('Anna is typing…');
    expect(typingAttribution(['Anna', 'David'])).toBe('Anna and David are typing…');
    expect(typingAttribution(['Anna', 'David', 'Sarah'])).toBe('3 people are typing…');
  });

  it('ignores unnamed typists rather than rendering an empty name', () => {
    expect(typingAttribution(['', '  '])).toBe('');
  });

  it('lets typing take the subtitle over the member list', () => {
    expect(groupSubtitle({ typingNames: ['Anna'], memberLine: 'You, Anna' })).toBe('Anna is typing…');
    expect(groupSubtitle({ typingNames: [], memberLine: 'You, Anna' })).toBe('You, Anna');
  });
});

describe('senderTintIndex', () => {
  it('is stable for one id', () => {
    expect(senderTintIndex('user-42', 8)).toBe(senderTintIndex('user-42', 8));
  });

  it('stays inside the ring', () => {
    for (const id of ['a', 'user-1', 'ffffffff-0000', '']) {
      const index = senderTintIndex(id, 8);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(8);
    }
  });

  it('spreads a handful of ids over more than one colour', () => {
    const ids = ['anna', 'david', 'sarah', 'tom', 'uma', 'zoe'];
    expect(new Set(ids.map((id) => senderTintIndex(id, 8))).size).toBeGreaterThan(1);
  });

  it('survives an empty ring instead of dividing by zero', () => {
    expect(senderTintIndex('anna', 0)).toBe(0);
  });
});

describe('permissions', () => {
  it('grants management to admins only', () => {
    expect(canManageMembers('admin')).toBe(true);
    expect(canManageMembers('member')).toBe(false);
    expect(canManageMembers(null)).toBe(false);
  });

  it('makes the last admin promote someone before leaving', () => {
    const members = [member('me', 'Me', 'admin'), member('a', 'Anna'), member('b', 'David')];
    expect(mustPromoteBeforeExit(members, 'me')).toBe(true);
  });

  it('lets an admin leave when another admin remains', () => {
    const members = [member('me', 'Me', 'admin'), member('a', 'Anna', 'admin')];
    expect(mustPromoteBeforeExit(members, 'me')).toBe(false);
  });

  it('lets a plain member leave, and lets the last person leave an empty group', () => {
    expect(mustPromoteBeforeExit([member('me', 'Me'), member('a', 'Anna', 'admin')], 'me')).toBe(false);
    expect(mustPromoteBeforeExit([member('me', 'Me', 'admin')], 'me')).toBe(false);
  });
});

describe('systemMessageText', () => {
  it('names both sides of a membership change', () => {
    expect(systemMessageText({ action: 'added', actor: 'Anna', target: 'David' })).toBe('Anna added David');
    expect(systemMessageText({ action: 'removed', actor: 'Anna', target: 'David' })).toBe('Anna removed David');
    expect(systemMessageText({ action: 'left', actor: 'David' })).toBe('David left');
    expect(systemMessageText({ action: 'promoted', actor: 'Anna', target: 'David' })).toBe(
      'Anna made David an admin',
    );
  });

  it('quotes a new subject so a rename to "left" cannot read as a departure', () => {
    expect(systemMessageText({ action: 'renamed', actor: 'Anna', subject: 'left' })).toBe(
      'Anna changed the subject to "left"',
    );
  });
});

describe('the picker', () => {
  const candidates = [
    { userId: 'b', displayName: 'David', avatarPath: null, about: null },
    { userId: 'a', displayName: 'Anna', avatarPath: null, about: null },
    { userId: 'c', displayName: 'Sarah', avatarPath: null, about: null },
  ];

  it('sorts by name and excludes people already in', () => {
    expect(filterCandidates(candidates, { query: '', excluded: ['c'] }).map((c) => c.displayName)).toEqual([
      'Anna',
      'David',
    ]);
  });

  it('matches case-insensitively on the name', () => {
    expect(filterCandidates(candidates, { query: 'ann' })).toHaveLength(1);
  });

  it('labels the selection', () => {
    expect(selectionLabel(0)).toBe('Add participants');
    expect(selectionLabel(3)).toBe(`3 of ${MAX_MEMBERS} selected`);
  });

  it('refuses a group with no subject, no members, or over the ceiling', () => {
    const ids = (count: number) => Array.from({ length: count }, (_, index) => `u${index}`);
    expect(canCreateGroup({ subject: 'Crew', memberIds: ['a'] })).toBe(true);
    expect(canCreateGroup({ subject: '  ', memberIds: ['a'] })).toBe(false);
    expect(canCreateGroup({ subject: 'Crew', memberIds: [] })).toBe(false);
    // The creator occupies one of the seats, so 256 others is one too many.
    expect(canCreateGroup({ subject: 'Crew', memberIds: ids(MAX_MEMBERS) })).toBe(false);
    expect(canCreateGroup({ subject: 'Crew', memberIds: ids(MAX_MEMBERS - 1) })).toBe(true);
  });
});
