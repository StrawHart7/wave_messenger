import {
  MAX_VIDEO_BYTES,
  documentSubtitle,
  exceedsLimit,
  extensionFor,
  formatBytes,
  kindForMime,
  mediaBubbleSize,
  sanitizeFileName,
  storagePathFor,
} from '../attachments';

describe('kindForMime', () => {
  it('maps the common families', () => {
    expect(kindForMime('image/jpeg')).toBe('image');
    expect(kindForMime('video/mp4')).toBe('video');
    expect(kindForMime('audio/m4a')).toBe('voice');
    expect(kindForMime('application/pdf')).toBe('document');
  });

  it('treats webp as a sticker, as the product does', () => {
    expect(kindForMime('image/webp')).toBe('sticker');
  });

  it('falls back to document for anything unknown', () => {
    expect(kindForMime('application/x-made-up')).toBe('document');
  });
});

describe('size limits', () => {
  it('holds video to its own larger cap', () => {
    expect(exceedsLimit('video', MAX_VIDEO_BYTES - 1)).toBe(false);
    expect(exceedsLimit('video', MAX_VIDEO_BYTES + 1)).toBe(true);
  });

  it('rejects an oversized image well below the video cap', () => {
    expect(exceedsLimit('image', MAX_VIDEO_BYTES)).toBe(true);
  });
});

describe('storage paths', () => {
  it('puts the chat id first — that is the whole access rule', () => {
    expect(storagePathFor('chat-1', 'msg-1', 'photo.jpg')).toBe('chat-1/msg-1/photo.jpg');
  });

  it('sanitises names that would break a path', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('etcpasswd');
    expect(sanitizeFileName('my holiday photo.JPG')).toBe('my-holiday-photo.JPG');
    expect(sanitizeFileName('   ')).toBe('file');
    expect(sanitizeFileName('a'.repeat(200)).length).toBeLessThanOrEqual(80);
  });

  it('never lets a sanitised name escape its folder', () => {
    const path = storagePathFor('chat-1', 'msg-1', '../evil.png');
    expect(path.split('/')).toHaveLength(3);
    expect(path.startsWith('chat-1/msg-1/')).toBe(true);
  });
});

describe('extensions and sizes', () => {
  it('knows the common types and derives the rest', () => {
    expect(extensionFor('image/jpeg')).toBe('jpg');
    expect(extensionFor('application/pdf')).toBe('pdf');
    expect(extensionFor('application/zip')).toBe('zip');
  });

  it('formats bytes the way a file manager does', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1_500_000)).toBe('1.4 MB');
    expect(formatBytes(20 * 1024 * 1024)).toBe('20 MB');
  });

  it('writes a document card subtitle', () => {
    expect(documentSubtitle('application/pdf', 1_500_000)).toBe('PDF · 1.4 MB');
  });
});

describe('mediaBubbleSize', () => {
  it('keeps the aspect ratio within the bubble width', () => {
    const size = mediaBubbleSize(2000, 1000, 260);
    expect(size.width).toBe(260);
    expect(size.height).toBe(130);
  });

  it('caps a tall photo by height rather than letting it fill the screen', () => {
    const size = mediaBubbleSize(1000, 4000, 260, 320);
    expect(size.height).toBe(320);
    expect(size.width).toBe(80);
  });

  it('does not upscale a small image', () => {
    const size = mediaBubbleSize(120, 120, 260);
    expect(size.width).toBe(120);
  });

  it('falls back to a square when dimensions are unknown', () => {
    expect(mediaBubbleSize(null, null, 260)).toEqual({ width: 260, height: 260 });
  });
});
