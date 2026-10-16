import { buildChristianBiasedQuery, CHRISTIAN_GIF_THEMES } from '../GifPickerSheet';

// KIS is a faith-focused app - the GIF picker must only ever search for
// Christian/faith-themed content, never Tenor's generic trending feed.
// Tenor has no real "christian" category, so this is a best-effort
// keyword bias: every query sent to Tenor is forced through one of
// CHRISTIAN_GIF_THEMES.

describe('buildChristianBiasedQuery', () => {
  it('uses the picked theme alone for an empty query (the default feed)', () => {
    expect(buildChristianBiasedQuery('', () => 'worship')).toBe('worship');
  });

  it('uses the picked theme alone for a whitespace-only query', () => {
    expect(buildChristianBiasedQuery('   ', () => 'worship')).toBe('worship');
  });

  it('appends the picked theme to whatever the user typed', () => {
    expect(buildChristianBiasedQuery('dance', () => 'jesus')).toBe('dance jesus');
  });

  it('trims the user query before appending', () => {
    expect(buildChristianBiasedQuery('  happy  ', () => 'blessed')).toBe('happy blessed');
  });

  it('defaults to picking one of the real Christian themes when no picker is injected', () => {
    const result = buildChristianBiasedQuery('celebration');
    const theme = result.replace('celebration ', '');
    expect(CHRISTIAN_GIF_THEMES).toContain(theme);
  });
});
