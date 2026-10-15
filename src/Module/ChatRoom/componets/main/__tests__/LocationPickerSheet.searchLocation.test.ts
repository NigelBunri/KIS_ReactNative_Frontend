// Regression coverage for AND-032 ("no location search" — LocationPickerSheet
// only ever offered the device's current GPS fix, with no way to pick
// anywhere else). searchLocation() forward-geocodes a free-text query via
// the same free, keyless Nominatim endpoint reverseGeocode() already used
// in this file, so no new third-party credential is needed.

import { searchLocation } from '../LocationPickerSheet';

describe('searchLocation (AND-032)', () => {
  const originalFetch = (globalThis as any).fetch;

  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
  });

  it('resolves the first Nominatim result into lat/lng/address', async () => {
    (globalThis as any).fetch = jest.fn().mockResolvedValue({
      json: async () => [
        { lat: '40.7128', lon: '-74.0060', display_name: 'New York, NY, USA' },
      ],
    }) as any;

    const result = await searchLocation('New York');

    expect(result).toEqual({
      latitude: 40.7128,
      longitude: -74.006,
      address: 'New York, NY, USA',
    });
    expect((globalThis as any).fetch).toHaveBeenCalledWith(
      expect.stringContaining('nominatim.openstreetmap.org/search'),
      expect.objectContaining({ headers: expect.objectContaining({ 'User-Agent': 'KIS-App' }) }),
    );
  });

  it('returns null when no result is found', async () => {
    (globalThis as any).fetch = jest.fn().mockResolvedValue({ json: async () => [] }) as any;

    const result = await searchLocation('a place that does not exist anywhere');

    expect(result).toBeNull();
  });

  it('returns null on a network error rather than throwing', async () => {
    (globalThis as any).fetch = jest.fn().mockRejectedValue(new Error('network down')) as any;

    const result = await searchLocation('Paris');

    expect(result).toBeNull();
  });

  it('returns null when the response has non-numeric coordinates', async () => {
    (globalThis as any).fetch = jest.fn().mockResolvedValue({
      json: async () => [{ lat: 'not-a-number', lon: '-74.0060', display_name: 'Bad data' }],
    }) as any;

    const result = await searchLocation('garbage');

    expect(result).toBeNull();
  });
});
