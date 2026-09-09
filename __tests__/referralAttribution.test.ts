import { extractReferralCode } from '@/utils/referralAttribution';

describe('extractReferralCode', () => {
  it('extracts a code from a full referral join link', () => {
    expect(extractReferralCode('https://kingdomimpactventures.org/join/referral/B6UCUG5S')).toBe(
      'B6UCUG5S',
    );
  });

  it('extracts a code from a link with trailing query params', () => {
    expect(
      extractReferralCode('https://kingdomimpactventures.org/join/referral/B6UCUG5S?utm=share'),
    ).toBe('B6UCUG5S');
  });

  it('accepts a bare code with surrounding whitespace', () => {
    expect(extractReferralCode('  b6ucug5s  ')).toBe('B6UCUG5S');
  });

  it('returns null for empty or unrelated clipboard content', () => {
    expect(extractReferralCode('')).toBeNull();
    expect(extractReferralCode(null)).toBeNull();
    expect(extractReferralCode('just some notes I copied')).toBeNull();
  });

  it('returns null for an unrelated link', () => {
    expect(extractReferralCode('https://kingdomimpactventures.org/join/group/abc123')).toBeNull();
  });

  it('returns null for text that is too short or too long to be a code', () => {
    expect(extractReferralCode('AB1')).toBeNull();
    expect(extractReferralCode('ABCDEFGHIJKLMNOP')).toBeNull();
  });
});
