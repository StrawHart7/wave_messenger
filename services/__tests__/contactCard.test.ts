import { contactCardPreview, decodeContactCard, encodeContactCard } from '../contactCard';

describe('contact cards', () => {
  it('round-trips a card', () => {
    const card = { name: 'Anna Diallo', phone: '+22997000000', userId: 'user-1' };
    expect(decodeContactCard(encodeContactCard(card))).toEqual(card);
  });

  it('keeps a card without a Wave account', () => {
    const decoded = decodeContactCard(encodeContactCard({ name: 'Anna', phone: '+22997000000' }));
    expect(decoded?.userId).toBeUndefined();
  });

  it('returns null rather than throwing on anything that is not a card', () => {
    // A `contact` message's body is whatever the sending client wrote — an older
    // version, another client, or a corrupted row.
    expect(decodeContactCard(null)).toBeNull();
    expect(decodeContactCard('')).toBeNull();
    expect(decodeContactCard('not json at all')).toBeNull();
    expect(decodeContactCard('"a string"')).toBeNull();
    expect(decodeContactCard('null')).toBeNull();
    expect(decodeContactCard('{"name":"Anna"}')).toBeNull();
    expect(decodeContactCard('{"phone":"+229"}')).toBeNull();
    expect(decodeContactCard('{"name":"   ","phone":"+229"}')).toBeNull();
    expect(decodeContactCard('{"name":42,"phone":"+229"}')).toBeNull();
  });

  it('ignores a userId that is not a string instead of passing it on', () => {
    expect(decodeContactCard('{"name":"Anna","phone":"+229","userId":7}')?.userId).toBeUndefined();
  });

  it('previews the name, and falls back for an unreadable card', () => {
    expect(contactCardPreview(encodeContactCard({ name: 'Anna', phone: '+229' }))).toBe('Anna');
    expect(contactCardPreview('garbage')).toBe('Contact');
  });
});
