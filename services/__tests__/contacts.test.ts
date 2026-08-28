import { dedupeContacts, toE164FromContact } from '../contacts';
import { findCountry } from '../phone';

const benin = findCountry('BJ')!;
const france = findCountry('FR')!;

describe('toE164FromContact', () => {
  it('keeps an already-international number', () => {
    expect(toE164FromContact('+33 6 12 34 56 78', benin)).toBe('+33612345678');
  });

  it('converts the 00 international prefix', () => {
    expect(toE164FromContact('0033612345678', benin)).toBe('+33612345678');
  });

  it('assumes the home country for a national number', () => {
    expect(toE164FromContact('97 12 34 56', benin)).toBe('+22997123456');
    expect(toE164FromContact('06 12 34 56 78', france)).toBe('+33612345678');
  });

  it('returns null rather than guessing on unusable entries', () => {
    expect(toE164FromContact('', benin)).toBeNull();
    expect(toE164FromContact('12345', benin)).toBeNull();
    expect(toE164FromContact('+123', benin)).toBeNull();
  });
});

describe('dedupeContacts', () => {
  it('collapses duplicate numbers and keeps the first name', () => {
    const result = dedupeContacts([
      { name: 'Ada', e164: '+22997123456' },
      { name: 'Ada Lovelace', e164: '+22997123456' },
      { name: 'Grace', e164: '+33612345678' },
    ]);

    expect(result).toEqual([
      { name: 'Ada', e164: '+22997123456' },
      { name: 'Grace', e164: '+33612345678' },
    ]);
  });
});
