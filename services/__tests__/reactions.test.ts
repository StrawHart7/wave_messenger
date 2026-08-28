import { aggregate, applyToggle, reactionSummary, toggle, type Reaction } from '../reactions';

function reaction(overrides: Partial<Reaction> = {}): Reaction {
  return { messageId: 'm1', userId: 'them', emoji: '👍', createdAt: 1000, ...overrides };
}

const names: Record<string, string> = { them: 'Ada', other: 'Grace', third: 'Marco' };
const nameOf = (id: string) => names[id] ?? id;

describe('aggregate', () => {
  it('groups by emoji and counts', () => {
    const pills = aggregate(
      [
        reaction({ userId: 'a', emoji: '👍' }),
        reaction({ userId: 'b', emoji: '👍', createdAt: 1001 }),
        reaction({ userId: 'c', emoji: '❤️', createdAt: 1002 }),
      ],
      'me',
    );

    expect(pills).toHaveLength(2);
    expect(pills[0]).toMatchObject({ emoji: '👍', count: 2, reacted: false });
    expect(pills[1]).toMatchObject({ emoji: '❤️', count: 1 });
  });

  it('marks the pill the viewer is part of', () => {
    const pills = aggregate([reaction({ userId: 'me', emoji: '😂' })], 'me');
    expect(pills[0]!.reacted).toBe(true);
  });

  it('orders by count so pills do not reshuffle on every change', () => {
    const pills = aggregate(
      [
        reaction({ userId: 'a', emoji: '❤️', createdAt: 1 }),
        reaction({ userId: 'b', emoji: '👍', createdAt: 2 }),
        reaction({ userId: 'c', emoji: '👍', createdAt: 3 }),
      ],
      'me',
    );

    expect(pills.map((pill) => pill.emoji)).toEqual(['👍', '❤️']);
  });

  it('lists reactors oldest first', () => {
    const pills = aggregate(
      [
        reaction({ userId: 'second', createdAt: 20 }),
        reaction({ userId: 'first', createdAt: 10 }),
      ],
      'me',
    );

    expect(pills[0]!.userIds).toEqual(['first', 'second']);
  });

  it('is empty when nobody has reacted', () => {
    expect(aggregate([], 'me')).toEqual([]);
  });
});

describe('toggle', () => {
  it('adds when the viewer has not reacted', () => {
    expect(toggle([], 'me', '👍')).toEqual({ action: 'add', emoji: '👍' });
  });

  it('removes when tapping the same emoji again', () => {
    const existing = [reaction({ userId: 'me', emoji: '👍' })];
    expect(toggle(existing, 'me', '👍')).toEqual({ action: 'remove', emoji: '👍' });
  });

  it('replaces when tapping a different emoji — one reaction per person', () => {
    const existing = [reaction({ userId: 'me', emoji: '👍' })];
    expect(toggle(existing, 'me', '❤️')).toEqual({ action: 'replace', emoji: '❤️', previous: '👍' });
  });

  it('ignores other people when deciding', () => {
    const existing = [reaction({ userId: 'them', emoji: '❤️' })];
    expect(toggle(existing, 'me', '❤️')).toEqual({ action: 'add', emoji: '❤️' });
  });
});

describe('applyToggle', () => {
  it('never leaves the viewer with two reactions', () => {
    const existing = [reaction({ userId: 'me', emoji: '👍' }), reaction({ userId: 'them', emoji: '👍' })];
    const next = applyToggle(existing, 'me', 'm1', { action: 'replace', emoji: '❤️', previous: '👍' });

    expect(next.filter((r) => r.userId === 'me')).toHaveLength(1);
    expect(next.find((r) => r.userId === 'me')!.emoji).toBe('❤️');
    expect(next.filter((r) => r.userId === 'them')).toHaveLength(1);
  });

  it('drops only the viewer on remove', () => {
    const existing = [reaction({ userId: 'me' }), reaction({ userId: 'them' })];
    const next = applyToggle(existing, 'me', 'm1', { action: 'remove', emoji: '👍' });

    expect(next).toHaveLength(1);
    expect(next[0]!.userId).toBe('them');
  });
});

describe('reactionSummary', () => {
  it('puts the viewer first as "You"', () => {
    const pill = { emoji: '👍', count: 1, reacted: true, userIds: ['me'] };
    expect(reactionSummary(pill, 'me', nameOf)).toBe('You');
  });

  it('joins two names and counts the rest', () => {
    expect(
      reactionSummary({ emoji: '👍', count: 2, reacted: false, userIds: ['them', 'other'] }, 'me', nameOf),
    ).toBe('Ada and Grace');

    expect(
      reactionSummary(
        { emoji: '👍', count: 3, reacted: false, userIds: ['them', 'other', 'third'] },
        'me',
        nameOf,
      ),
    ).toBe('Ada, Grace and 1 other');
  });
});
