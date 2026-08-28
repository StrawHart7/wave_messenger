import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  findCountry,
  formatE164ForDisplay,
  formatNational,
  formatResendCountdown,
  isCompleteOtp,
  isValidNational,
  normalizeNational,
  toE164,
} from '../phone';

const benin = findCountry('BJ')!;
const france = findCountry('FR')!;
const usa = findCountry('US')!;

describe('normalizeNational', () => {
  it('drops the trunk prefix people type out of habit', () => {
    expect(normalizeNational('06 12 34 56 78', france)).toBe('612345678');
    expect(normalizeNational('612345678', france)).toBe('612345678');
  });

  it('drops a dial code pasted into the national field', () => {
    expect(normalizeNational('+33612345678', france)).toBe('612345678');
    expect(normalizeNational('0022997123456', benin)).toBe('22997123456');
  });

  it('ignores spaces, dashes and parentheses', () => {
    expect(normalizeNational('(555) 123-4567', usa)).toBe('5551234567');
  });
});

describe('isValidNational', () => {
  it('accepts the lengths a country actually uses', () => {
    expect(isValidNational('97123456', benin)).toBe(true);
    expect(isValidNational('0612345678', france)).toBe(true);
    expect(isValidNational('5551234567', usa)).toBe(true);
  });

  it('rejects numbers that are too short or too long', () => {
    expect(isValidNational('9712', benin)).toBe(false);
    expect(isValidNational('61234567890123', france)).toBe(false);
    expect(isValidNational('', usa)).toBe(false);
  });
});

describe('toE164', () => {
  it('produces the only format that reaches the backend', () => {
    expect(toE164('97 12 34 56', benin)).toBe('+22997123456');
    expect(toE164('06 12 34 56 78', france)).toBe('+33612345678');
    expect(toE164('(555) 123-4567', usa)).toBe('+15551234567');
  });

  it('is stable when given something already normalized', () => {
    const once = toE164('0612345678', france);
    expect(toE164(once, france)).toBe(once);
  });
});

describe('display formatting', () => {
  it('groups +1 numbers 3-3-4 and everything else in pairs', () => {
    expect(formatNational('5551234567', usa)).toBe('555 123 4567');
    expect(formatNational('97123456', benin)).toBe('97 12 34 56');
  });

  it('renders an E.164 number back with its dial code', () => {
    expect(formatE164ForDisplay('+22997123456')).toBe('+229 97 12 34 56');
    expect(formatE164ForDisplay('+15551234567')).toBe('+1 555 123 4567');
  });

  it('leaves an unknown dial code untouched rather than mangling it', () => {
    expect(formatE164ForDisplay('+99912345678')).toBe('+99912345678');
  });
});

describe('otp helpers', () => {
  it('is complete only at six digits', () => {
    expect(isCompleteOtp('12345')).toBe(false);
    expect(isCompleteOtp('123456')).toBe(true);
    expect(isCompleteOtp('12 34 56')).toBe(true);
  });

  it('formats the resend countdown', () => {
    expect(formatResendCountdown(42)).toBe('0:42');
    expect(formatResendCountdown(60)).toBe('1:00');
    expect(formatResendCountdown(-5)).toBe('0:00');
  });
});

describe('country table', () => {
  it('has a default that exists in the list', () => {
    expect(COUNTRIES).toContain(DEFAULT_COUNTRY);
  });

  it('has no duplicate ISO codes', () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
