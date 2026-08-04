import { redactUrlForLogging } from '../urlRedaction';

describe('redactUrlForLogging', () => {
  it('strips a signed S3 query string (signature/token live there)', () => {
    const signed =
      'https://kis-media.s3.amazonaws.com/broadcasts/abc123.mp4?X-Amz-Signature=deadbeef&X-Amz-Expires=3600';
    expect(redactUrlForLogging(signed)).toBe(
      'https://kis-media.s3.amazonaws.com/broadcasts/abc123.mp4',
    );
  });

  it('leaves a url with no query string unchanged', () => {
    expect(redactUrlForLogging('https://cdn.example.com/a.mp4')).toBe(
      'https://cdn.example.com/a.mp4',
    );
  });

  it('returns an empty string for null/undefined/empty input, never throws', () => {
    expect(redactUrlForLogging(null)).toBe('');
    expect(redactUrlForLogging(undefined)).toBe('');
    expect(redactUrlForLogging('')).toBe('');
  });
});
