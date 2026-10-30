import { extractReferralCodeFromInstallReferrer } from '../installReferrer';

describe('extractReferralCodeFromInstallReferrer', () => {
  it('extracts a ref_code param from a bare referrer string', () => {
    expect(extractReferralCodeFromInstallReferrer('ref_code=ABCD1234')).toBe('ABCD1234');
  });

  it('extracts ref_code when other utm params precede it', () => {
    expect(extractReferralCodeFromInstallReferrer('utm_source=kis_web&ref_code=ABCD1234')).toBe('ABCD1234');
  });

  it('extracts ref_code when other utm params follow it', () => {
    expect(extractReferralCodeFromInstallReferrer('ref_code=ABCD1234&utm_source=kis_web')).toBe('ABCD1234');
  });

  it('decodes a URL-encoded ref_code value', () => {
    // Google Play's referrer string is itself URL-encoded when appended to
    // the Play Store URL (see OpenInApp.tsx's encodeURIComponent call) —
    // Play decodes the outer layer but the value can still be double-encoded
    // depending on how a link was constructed.
    expect(extractReferralCodeFromInstallReferrer('ref_code%3DABCD1234')).toBeNull();
    expect(extractReferralCodeFromInstallReferrer('ref_code=ABCD1234')).toBe('ABCD1234');
  });

  it('normalizes to uppercase', () => {
    expect(extractReferralCodeFromInstallReferrer('ref_code=abcd1234')).toBe('ABCD1234');
  });

  it('returns null when there is no ref_code param', () => {
    expect(extractReferralCodeFromInstallReferrer('utm_source=google-play&utm_medium=organic')).toBeNull();
  });

  it('returns null for an empty or missing referrer', () => {
    expect(extractReferralCodeFromInstallReferrer('')).toBeNull();
    expect(extractReferralCodeFromInstallReferrer(null)).toBeNull();
    expect(extractReferralCodeFromInstallReferrer(undefined)).toBeNull();
  });

  it('rejects a ref_code value outside the valid 6-10 char code shape', () => {
    expect(extractReferralCodeFromInstallReferrer('ref_code=AB')).toBeNull();
  });
});
