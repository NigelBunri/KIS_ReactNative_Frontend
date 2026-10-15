// AND-034: GIF search ("no gif found") always failed in production builds
// because the key lookup used `process.env.TENOR_API_KEY`, which this app
// never populates at runtime (there's no react-native-config / dotenv babel
// plugin — see scripts/sync-env.cjs, the one real env mechanism, which
// bakes values into src/env.ts's APP_ENV at build time instead). These
// tests pin the fixed behavior: the key must come from APP_ENV, and a
// missing key must short-circuit to an empty result without ever hitting
// the network (rather than sending a blank `key=` to Tenor).

describe('searchTenor (AND-034 key resolution)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetModules();
    jest.dontMock('@/env');
  });

  it('does not call fetch at all when no production key is configured (non-dev)', async () => {
    jest.resetModules();
    (global as any).__DEV__ = false;
    jest.doMock('@/env', () => ({ APP_ENV: { KIS_TENOR_API_KEY: '' } }));
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as any;

    const { searchTenor } = require('../src/Module/ChatRoom/componets/main/GifPickerSheet');
    const results = await searchTenor('cats');

    expect(results).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('uses the configured KIS_TENOR_API_KEY (not a hardcoded/dev-only key) when present', async () => {
    jest.resetModules();
    (global as any).__DEV__ = false;
    jest.doMock('@/env', () => ({ APP_ENV: { KIS_TENOR_API_KEY: 'REAL_PROD_KEY' } }));
    const fetchSpy = jest.fn().mockResolvedValue({
      json: async () => ({
        results: [
          {
            id: 'g1',
            title: 'cat',
            media_formats: {
              gif: { url: 'https://example.com/g1.gif', dims: [100, 50] },
              tinygif: { url: 'https://example.com/g1-preview.gif' },
            },
          },
        ],
      }),
    });
    global.fetch = fetchSpy as any;

    const { searchTenor } = require('../src/Module/ChatRoom/componets/main/GifPickerSheet');
    const results = await searchTenor('cats');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('key=REAL_PROD_KEY');
    expect(results).toEqual([
      {
        id: 'g1',
        title: 'cat',
        url: 'https://example.com/g1.gif',
        previewUrl: 'https://example.com/g1-preview.gif',
        width: 100,
        height: 50,
      },
    ]);
  });
});
