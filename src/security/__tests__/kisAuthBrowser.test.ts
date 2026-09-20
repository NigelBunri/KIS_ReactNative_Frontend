import { paramsFromUrl } from '../kisAuthBrowser';

describe('paramsFromUrl', () => {
  it('extracts code and state from a successful redirect', () => {
    expect(
      paramsFromUrl('https://kis.app/auth/kisauth-callback?code=abc123&state=xyz'),
    ).toEqual({ code: 'abc123', state: 'xyz' });
  });

  it('extracts error and state from a failed redirect', () => {
    expect(
      paramsFromUrl('https://kis.app/auth/kisauth-link-callback?error=already_linked&state=xyz'),
    ).toEqual({ error: 'already_linked', state: 'xyz' });
  });

  it('URL-decodes values (the state param embeds device id + timestamp + random, not always plain)', () => {
    expect(
      paramsFromUrl('https://kis.app/auth/kisauth-callback?code=abc&state=device%2Fid.123'),
    ).toEqual({ code: 'abc', state: 'device/id.123' });
  });

  it('returns an empty object for a url with no query string', () => {
    expect(paramsFromUrl('https://kis.app/auth/kisauth-callback')).toEqual({});
  });

  it('strips a #fragment before parsing, never treats it as part of the last param value', () => {
    expect(
      paramsFromUrl('https://kis.app/auth/kisauth-callback?code=abc&state=xyz#ignored'),
    ).toEqual({ code: 'abc', state: 'xyz' });
  });

  it('handles a bare key with no value as an empty string, not undefined', () => {
    expect(paramsFromUrl('https://kis.app/auth/kisauth-callback?code=abc&state=')).toEqual({
      code: 'abc',
      state: '',
    });
  });
});
