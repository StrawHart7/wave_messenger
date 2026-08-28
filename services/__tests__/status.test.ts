import {
  IMAGE_SEGMENT_MS,
  MAX_VIDEO_SEGMENT_MS,
  STATUS_TTL_MS,
  activePosts,
  advance,
  buildRings,
  entryIndex,
  isExpired,
  isPostable,
  myStatusSubtitle,
  nextBackground,
  replyPreview,
  segmentDurationMs,
  segmentProgress,
  sortRings,
  splitRings,
  statusTime,
  viewerCountLabel,
  type StatusPost,
} from '../status';

const NOW = new Date('2026-08-28T12:00:00Z').getTime();

function post(overrides: Partial<StatusPost> & { id: string; authorId: string }): StatusPost {
  return {
    kind: 'image',
    storagePath: 'path.jpg',
    caption: null,
    backgroundColor: null,
    createdAt: NOW - 60_000,
    expiresAt: NOW - 60_000 + STATUS_TTL_MS,
    viewed: false,
    localUri: null,
    durationMs: null,
    ...overrides,
  };
}

const authors = new Map([
  ['anna', { displayName: 'Anna', avatarPath: null }],
  ['david', { displayName: 'David', avatarPath: null }],
  ['me', { displayName: 'Me', avatarPath: null }],
]);

describe('expiry', () => {
  it('drops a post the moment its deadline passes', () => {
    const stale = post({ id: 's', authorId: 'anna', expiresAt: NOW });
    expect(isExpired(stale, NOW)).toBe(true);
    expect(isExpired({ ...stale, expiresAt: NOW + 1 }, NOW)).toBe(false);
  });

  it('filters expired posts out of a list', () => {
    const live = post({ id: 'a', authorId: 'anna' });
    const dead = post({ id: 'b', authorId: 'anna', expiresAt: NOW - 1 });
    expect(activePosts([live, dead], NOW).map((p) => p.id)).toEqual(['a']);
  });
});

describe('buildRings', () => {
  const posts = [
    post({ id: 'a2', authorId: 'anna', createdAt: NOW - 30 * 60_000 }),
    post({ id: 'a1', authorId: 'anna', createdAt: NOW - 90 * 60_000 }),
    post({ id: 'd1', authorId: 'david', createdAt: NOW - 10 * 60_000, viewed: true }),
    post({ id: 'mine', authorId: 'me', createdAt: NOW - 5 * 60_000 }),
    post({ id: 'gone', authorId: 'david', expiresAt: NOW - 1 }),
  ];

  const rings = buildRings(posts, authors, { viewerId: 'me', now: NOW });

  it('leaves the viewer out — their own posts belong in "My status"', () => {
    expect(rings.map((ring) => ring.authorId)).not.toContain('me');
  });

  it('orders a ring oldest first, the order it plays in', () => {
    expect(rings.find((ring) => ring.authorId === 'anna')?.posts.map((p) => p.id)).toEqual(['a1', 'a2']);
  });

  it('excludes expired posts from the ring', () => {
    expect(rings.find((ring) => ring.authorId === 'david')?.posts.map((p) => p.id)).toEqual(['d1']);
  });

  it('puts unseen rings before fully-viewed ones', () => {
    expect(rings.map((ring) => ring.authorId)).toEqual(['anna', 'david']);
  });

  it('names the author from the profile map', () => {
    expect(rings[0]?.displayName).toBe('Anna');
  });

  it('drops an author whose every post has expired', () => {
    const onlyStale = buildRings([post({ id: 'x', authorId: 'anna', expiresAt: NOW - 1 })], authors, {
      viewerId: 'me',
      now: NOW,
    });
    expect(onlyStale).toHaveLength(0);
  });
});

describe('sorting and splitting', () => {
  const ring = (authorId: string, allViewed: boolean, latestAt: number) => ({
    authorId,
    displayName: authorId,
    avatarPath: null,
    posts: [],
    allViewed,
    latestAt,
  });

  it('sorts unseen first, then newest', () => {
    const sorted = sortRings([
      ring('old-unseen', false, 100),
      ring('viewed', true, 900),
      ring('new-unseen', false, 500),
    ]);
    expect(sorted.map((r) => r.authorId)).toEqual(['new-unseen', 'old-unseen', 'viewed']);
  });

  it('splits into the two sections the tab renders', () => {
    const { recent, viewed } = splitRings([ring('a', false, 1), ring('b', true, 2)]);
    expect(recent.map((r) => r.authorId)).toEqual(['a']);
    expect(viewed.map((r) => r.authorId)).toEqual(['b']);
  });
});

describe('entryIndex', () => {
  const ringOf = (viewed: boolean[]) => ({
    authorId: 'anna',
    displayName: 'Anna',
    avatarPath: null,
    posts: viewed.map((seen, index) => post({ id: `p${index}`, authorId: 'anna', viewed: seen })),
    allViewed: viewed.every(Boolean),
    latestAt: NOW,
  });

  it('opens on the first unseen post', () => {
    expect(entryIndex(ringOf([true, true, false]))).toBe(2);
  });

  it('replays from the top when everything has been seen', () => {
    expect(entryIndex(ringOf([true, true]))).toBe(0);
  });
});

describe('segments', () => {
  it('gives an image and a text card the same fixed run', () => {
    expect(segmentDurationMs(post({ id: 'a', authorId: 'anna' }))).toBe(IMAGE_SEGMENT_MS);
    expect(segmentDurationMs(post({ id: 'b', authorId: 'anna', kind: 'text' }))).toBe(IMAGE_SEGMENT_MS);
  });

  it('runs a video for its own length', () => {
    expect(segmentDurationMs(post({ id: 'v', authorId: 'anna', kind: 'video', durationMs: 8000 }))).toBe(8000);
  });

  it('caps a long video so one clip cannot hold the viewer hostage', () => {
    expect(
      segmentDurationMs(post({ id: 'v', authorId: 'anna', kind: 'video', durationMs: 120_000 })),
    ).toBe(MAX_VIDEO_SEGMENT_MS);
  });

  it('falls back for a video of unknown length', () => {
    expect(segmentDurationMs(post({ id: 'v', authorId: 'anna', kind: 'video' }))).toBe(IMAGE_SEGMENT_MS);
  });

  it('clamps progress to 0..1 and survives a zero duration', () => {
    expect(segmentProgress(2500, 5000)).toBe(0.5);
    expect(segmentProgress(9000, 5000)).toBe(1);
    expect(segmentProgress(-10, 5000)).toBe(0);
    expect(segmentProgress(1, 0)).toBe(1);
  });
});

describe('advance', () => {
  const base = { count: 3, isFirstAuthor: false, isLastAuthor: false };

  it('steps within an author', () => {
    expect(advance({ ...base, index: 0, direction: 'next' })).toEqual({ type: 'segment', index: 1 });
    expect(advance({ ...base, index: 2, direction: 'previous' })).toEqual({ type: 'segment', index: 1 });
  });

  it('hands off to the next author at the end', () => {
    expect(advance({ ...base, index: 2, direction: 'next' })).toEqual({
      type: 'author',
      direction: 'next',
    });
  });

  it('closes only when the last author runs out', () => {
    expect(advance({ ...base, index: 2, direction: 'next', isLastAuthor: true })).toEqual({
      type: 'close',
    });
  });

  it('stays put rather than dismissing when tapping back at the very beginning', () => {
    expect(advance({ ...base, index: 0, direction: 'previous', isFirstAuthor: true })).toEqual({
      type: 'segment',
      index: 0,
    });
  });

  it('goes back to the previous author from the first post of a later one', () => {
    expect(advance({ ...base, index: 0, direction: 'previous' })).toEqual({
      type: 'author',
      direction: 'previous',
    });
  });
});

describe('statusTime', () => {
  it('reads in minutes, then hours', () => {
    expect(statusTime(NOW - 30_000, NOW)).toBe('Just now');
    expect(statusTime(NOW - 60_000, NOW)).toBe('1 minute ago');
    expect(statusTime(NOW - 45 * 60_000, NOW)).toBe('45 minutes ago');
    expect(statusTime(NOW - 2 * 3600_000, NOW)).toBe('2 hours ago');
  });

  it('says "Yesterday" once the calendar day changes', () => {
    const yesterday = new Date('2026-08-27T22:30:00Z').getTime();
    expect(statusTime(yesterday, NOW)).toContain('Yesterday, ');
  });
});

describe('the My status row', () => {
  it('invites a first post when there is nothing live', () => {
    expect(myStatusSubtitle([], NOW)).toBe('Tap to add status update');
    expect(myStatusSubtitle([post({ id: 'x', authorId: 'me', expiresAt: NOW - 1 })], NOW)).toBe(
      'Tap to add status update',
    );
  });

  it('counts live posts and dates the newest', () => {
    expect(
      myStatusSubtitle(
        [
          post({ id: 'a', authorId: 'me', createdAt: NOW - 3600_000 }),
          post({ id: 'b', authorId: 'me', createdAt: NOW - 45 * 60_000 }),
        ],
        NOW,
      ),
    ).toBe('2 updates · 45 minutes ago');
  });
});

describe('composer rules', () => {
  it('needs text for a text status and a file for the rest', () => {
    expect(isPostable({ kind: 'text', caption: 'Hello', localUri: null })).toBe(true);
    expect(isPostable({ kind: 'text', caption: '   ', localUri: null })).toBe(false);
    expect(isPostable({ kind: 'image', caption: '', localUri: 'file://a.jpg' })).toBe(true);
    expect(isPostable({ kind: 'image', caption: 'nice', localUri: null })).toBe(false);
  });

  it('cycles the background ring and wraps', () => {
    const ring = ['a', 'b', 'c'];
    expect(nextBackground('a', ring)).toBe('b');
    expect(nextBackground('c', ring)).toBe('a');
    // An unknown current colour starts the cycle rather than throwing.
    expect(nextBackground('zzz', ring)).toBe('a');
    expect(nextBackground('a', [])).toBe('a');
  });
});

describe('labels', () => {
  it('counts views', () => {
    expect(viewerCountLabel(0)).toBe('No views yet');
    expect(viewerCountLabel(1)).toBe('1 view');
    expect(viewerCountLabel(9)).toBe('9 views');
  });

  it('quotes a caption, or names the medium when there is none', () => {
    expect(replyPreview(post({ id: 'a', authorId: 'anna', kind: 'text', caption: 'Hi' }))).toBe('Hi');
    expect(replyPreview(post({ id: 'b', authorId: 'anna', kind: 'image' }))).toBe('Photo status');
    expect(replyPreview(post({ id: 'c', authorId: 'anna', kind: 'video' }))).toBe('Video status');
  });
});
