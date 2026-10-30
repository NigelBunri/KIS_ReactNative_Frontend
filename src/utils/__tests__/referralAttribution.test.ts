import { extractReferralCode } from '../referralAttribution';

describe('extractReferralCode', () => {
  it('extracts a bare 8-char uppercase code', () => {
    expect(extractReferralCode('ABCD1234')).toBe('ABCD1234');
  });

  it('normalizes a lowercase bare code to uppercase', () => {
    expect(extractReferralCode('abcd1234')).toBe('ABCD1234');
  });

  it('trims surrounding whitespace before matching', () => {
    expect(extractReferralCode('  ABCD1234  ')).toBe('ABCD1234');
  });

  it('extracts the code from a full join/referral link', () => {
    expect(extractReferralCode('https://kis.app/join/referral/ABCD1234')).toBe('ABCD1234');
  });

  it('extracts the code from a join/referral link with trailing query params', () => {
    expect(extractReferralCode('https://kis.app/join/referral/ABCD1234?utm_source=x')).toBe('ABCD1234');
  });

  it('accepts codes shorter or longer than the current 8-char length (6-10 range)', () => {
    expect(extractReferralCode('ABC123')).toBe('ABC123');
    expect(extractReferralCode('ABCDEFGHIJ')).toBe('ABCDEFGHIJ');
  });

  it('rejects a code shorter than 6 characters', () => {
    expect(extractReferralCode('ABC12')).toBeNull();
  });

  it('rejects a code longer than 10 characters', () => {
    expect(extractReferralCode('ABCDEFGHIJK')).toBeNull();
  });

  it('returns null for empty/whitespace-only clipboard content', () => {
    expect(extractReferralCode('')).toBeNull();
    expect(extractReferralCode('   ')).toBeNull();
    expect(extractReferralCode(null)).toBeNull();
    expect(extractReferralCode(undefined)).toBeNull();
  });

  it('returns null for arbitrary clipboard content unrelated to a referral', () => {
    expect(extractReferralCode('just some copied text')).toBeNull();
    expect(extractReferralCode('https://kis.app/join/call/ABCD1234')).toBeNull();
  });
});
