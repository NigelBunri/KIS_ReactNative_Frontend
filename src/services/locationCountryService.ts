import { Platform } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import {
  PERMISSIONS,
  RESULTS,
  check,
  request,
  type PermissionStatus,
} from 'react-native-permissions';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const DEFAULT_COUNTRY_ISO = 'CM';
export const DEFAULT_CALLING_CODE = '+237';

// Persisted flags so we never re-request permission after first grant
const LOCATION_PERMISSION_GRANTED_KEY = 'KIS_LOC_PERM_GRANTED_V1';
// Cached last-known country for instant startup
const LOCATION_COUNTRY_CACHE_KEY = 'KIS_LOC_COUNTRY_CACHE_V1';

export const wasLocationPermissionEverGranted = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(LOCATION_PERMISSION_GRANTED_KEY)) === '1';
  } catch {
    return false;
  }
};

const persistPermissionGranted = async () => {
  try { await AsyncStorage.setItem(LOCATION_PERMISSION_GRANTED_KEY, '1'); } catch {}
};

export const cacheLocationCountry = async (iso: string, callingCode: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(LOCATION_COUNTRY_CACHE_KEY, JSON.stringify({ iso, callingCode }));
  } catch {}
};

export const getLastCachedLocationCountry = async (): Promise<{ iso: string; callingCode: string } | null> => {
  try {
    const raw = await AsyncStorage.getItem(LOCATION_COUNTRY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.iso ? parsed : null;
  } catch {
    return null;
  }
};

export const CALLING_CODE_BY_ISO: Record<string, string> = {
  // Africa
  CM: '+237', NG: '+234', GH: '+233', KE: '+254', ZA: '+27',
  CI: '+225', DZ: '+213', MA: '+212', TN: '+216', UG: '+256',
  RW: '+250', SN: '+221', NE: '+227', TD: '+235', GA: '+241',
  GQ: '+240', ET: '+251', TZ: '+255', MZ: '+258', AO: '+244',
  ZW: '+263', ZM: '+260', MW: '+265', BW: '+267', NA: '+264',
  SL: '+232', LR: '+231', GN: '+224', BJ: '+229', BF: '+226',
  ML: '+223', MR: '+222', GM: '+220', CV: '+238', ST: '+239',
  // Europe
  FR: '+33', DE: '+49', GB: '+44', IT: '+39', ES: '+34',
  PT: '+351', NL: '+31', BE: '+32', CH: '+41', AT: '+43',
  SE: '+46', NO: '+47', DK: '+45', FI: '+358', PL: '+48',
  RO: '+40', HU: '+36', CZ: '+420', SK: '+421', GR: '+30',
  // Americas
  US: '+1', CA: '+1', MX: '+52', BR: '+55', AR: '+54',
  CO: '+57', CL: '+56', PE: '+51', VE: '+58', EC: '+593',
  // Asia / Pacific
  IN: '+91', CN: '+86', JP: '+81', KR: '+82', AU: '+61',
  NZ: '+64', SG: '+65', MY: '+60', PH: '+63', ID: '+62',
  TH: '+66', VN: '+84', PK: '+92', BD: '+880', LK: '+94',
  // Middle East
  SA: '+966', AE: '+971', QA: '+974', KW: '+965', OM: '+968',
  IL: '+972', TR: '+90',
};

export const COUNTRY_NAMES: Record<string, string> = {
  CM: 'Cameroon', NG: 'Nigeria', GH: 'Ghana', KE: 'Kenya', ZA: 'South Africa',
  CI: "Côte d'Ivoire", DZ: 'Algeria', MA: 'Morocco', TN: 'Tunisia', UG: 'Uganda',
  RW: 'Rwanda', SN: 'Senegal', NE: 'Niger', TD: 'Chad', GA: 'Gabon',
  GQ: 'Eq. Guinea', ET: 'Ethiopia', TZ: 'Tanzania', MZ: 'Mozambique', AO: 'Angola',
  ZW: 'Zimbabwe', ZM: 'Zambia', MW: 'Malawi', BW: 'Botswana', NA: 'Namibia',
  SL: 'Sierra Leone', LR: 'Liberia', GN: 'Guinea', BJ: 'Benin', BF: 'Burkina Faso',
  ML: 'Mali', MR: 'Mauritania', GM: 'Gambia', CV: 'Cape Verde', ST: 'São Tomé',
  FR: 'France', DE: 'Germany', GB: 'United Kingdom', IT: 'Italy', ES: 'Spain',
  PT: 'Portugal', NL: 'Netherlands', BE: 'Belgium', CH: 'Switzerland', AT: 'Austria',
  SE: 'Sweden', NO: 'Norway', DK: 'Denmark', FI: 'Finland', PL: 'Poland',
  RO: 'Romania', HU: 'Hungary', CZ: 'Czech Rep.', SK: 'Slovakia', GR: 'Greece',
  US: 'United States', CA: 'Canada', MX: 'Mexico', BR: 'Brazil', AR: 'Argentina',
  CO: 'Colombia', CL: 'Chile', PE: 'Peru', VE: 'Venezuela', EC: 'Ecuador',
  IN: 'India', CN: 'China', JP: 'Japan', KR: 'South Korea', AU: 'Australia',
  NZ: 'New Zealand', SG: 'Singapore', MY: 'Malaysia', PH: 'Philippines', ID: 'Indonesia',
  TH: 'Thailand', VN: 'Vietnam', PK: 'Pakistan', BD: 'Bangladesh', LK: 'Sri Lanka',
  SA: 'Saudi Arabia', AE: 'UAE', QA: 'Qatar', KW: 'Kuwait', OM: 'Oman',
  IL: 'Israel', TR: 'Turkey',
};

export class LocationCountryError extends Error {
  code:
    | 'permission_required'
    | 'permission_blocked'
    | 'permission_unavailable'
    | 'location_unavailable'
    | 'location_service_off';
  permissionStatus?: PermissionStatus;

  constructor(
    code:
      | 'permission_required'
      | 'permission_blocked'
      | 'permission_unavailable'
      | 'location_unavailable'
      | 'location_service_off',
    message: string,
    permissionStatus?: PermissionStatus,
  ) {
    super(message);
    this.code = code;
    this.permissionStatus = permissionStatus;
  }
}

const FINE_PERMISSION =
  Platform.OS === 'ios'
    ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
    : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

const COARSE_PERMISSION =
  Platform.OS === 'android' ? PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION : null;

const normalizeCountryIso = (value: string | null | undefined) => {
  const raw = String(value || '').trim().toUpperCase();
  return raw.length === 2 ? raw : '';
};

export const callingCodeForCountry = (countryIso: string | null | undefined) => {
  const iso = normalizeCountryIso(countryIso);
  return CALLING_CODE_BY_ISO[iso] || DEFAULT_CALLING_CODE;
};

export const ensureLocationPermission = async (requestIfNeeded: boolean) => {
  // Check current status first — no dialog shown here
  let status = await check(FINE_PERMISSION);

  if (status === RESULTS.GRANTED || status === RESULTS.LIMITED) {
    await persistPermissionGranted();
    return { granted: true, status, coarse: false };
  }

  // Only show the OS permission dialog if:
  //   - the caller explicitly wants to request AND
  //   - this permission has NEVER been granted before (don't re-ask after revocation)
  if (requestIfNeeded && status === RESULTS.DENIED) {
    const wasGranted = await wasLocationPermissionEverGranted();
    if (!wasGranted) {
      status = await request(FINE_PERMISSION);
      if (status === RESULTS.GRANTED || status === RESULTS.LIMITED) {
        await persistPermissionGranted();
        return { granted: true, status, coarse: false };
      }
    }
  }

  // On Android: fall back to coarse location (network-based, works indoors / no GPS)
  if (COARSE_PERMISSION && (status === RESULTS.DENIED || status === RESULTS.BLOCKED)) {
    let coarseStatus = await check(COARSE_PERMISSION);
    if (requestIfNeeded && coarseStatus === RESULTS.DENIED) {
      const wasGranted = await wasLocationPermissionEverGranted();
      if (!wasGranted) {
        coarseStatus = await request(COARSE_PERMISSION);
      }
    }
    if (coarseStatus === RESULTS.GRANTED || coarseStatus === RESULTS.LIMITED) {
      await persistPermissionGranted();
      return { granted: true, status: coarseStatus, coarse: true };
    }
  }

  return { granted: false, status, coarse: false };
};

export const getCurrentCoordinates = (coarse = false) =>
  new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: Number(position?.coords?.latitude),
          longitude: Number(position?.coords?.longitude),
        });
      },
      (error) => reject(error),
      {
        enableHighAccuracy: !coarse,
        timeout: coarse ? 8000 : 15000,
        maximumAge: 30000,
        forceRequestLocation: true,
        showLocationDialog: true,
      },
    );
  });

export const reverseGeocodeCountryIso = async (latitude: number, longitude: number) => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(
      latitude,
    )}&lon=${encodeURIComponent(longitude)}&zoom=3&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'KISApp/1.0 (location-country-service)' },
    });
    const data = await res.json();
    return normalizeCountryIso(data?.address?.country_code);
  } catch {
    return '';
  }
};

/** Detect country from IP address — no location permission needed. */
export const detectCountryFromIP = async (): Promise<string> => {
  const apis = [
    async () => {
      const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) });
      const d = await res.json();
      return normalizeCountryIso(d?.country_code ?? d?.country);
    },
    async () => {
      const res = await fetch('https://ip-api.com/json/?fields=countryCode', { signal: AbortSignal.timeout(5000) });
      const d = await res.json();
      return normalizeCountryIso(d?.countryCode);
    },
  ];
  for (const api of apis) {
    try {
      const iso = await api();
      if (iso && CALLING_CODE_BY_ISO[iso]) return iso;
    } catch { /* try next */ }
  }
  return '';
};

export const resolveLocationCountry = async (requestIfNeeded: boolean) => {
  const permission = await ensureLocationPermission(requestIfNeeded);

  // Track whether GPS is specifically off (distinct from "no permission")
  let locationServiceOff = false;

  if (permission.granted) {
    let coords: { latitude: number; longitude: number } | null = null;
    try {
      coords = await getCurrentCoordinates(permission.coarse);
    } catch (err: any) {
      // error.code === 2 means POSITION_UNAVAILABLE — device location service is OFF
      if (err?.code === 2) {
        locationServiceOff = true;
      }
      // All other GPS failures fall through to IP
    }

    if (coords) {
      const isoFromGeo = await reverseGeocodeCountryIso(coords.latitude, coords.longitude);
      if (isoFromGeo) {
        const callingCode = callingCodeForCountry(isoFromGeo);
        await cacheLocationCountry(isoFromGeo, callingCode);
        return {
          countryISO: isoFromGeo,
          callingCode,
          permissionStatus: permission.status,
          source: 'gps' as const,
          locationServiceOff: false,
        };
      }
    }
  }

  // GPS unavailable or service off — try silent IP-based detection
  const isoFromIP = await detectCountryFromIP();
  if (isoFromIP) {
    const callingCode = callingCodeForCountry(isoFromIP);
    await cacheLocationCountry(isoFromIP, callingCode);
    return {
      countryISO: isoFromIP,
      callingCode,
      permissionStatus: permission.status,
      source: 'ip' as const,
      locationServiceOff,  // pass through so caller can notify the user
    };
  }

  // Nothing worked — surface the most specific error
  if (locationServiceOff) {
    throw new LocationCountryError(
      'location_service_off',
      'Location services are turned off on your device. Please enable them in Settings.',
      permission.status,
    );
  }

  if (!permission.granted) {
    if (permission.status === RESULTS.BLOCKED) {
      throw new LocationCountryError(
        'permission_blocked',
        'Location permission is blocked. Please enable it in Settings.',
        permission.status,
      );
    }
    if (permission.status === RESULTS.UNAVAILABLE) {
      throw new LocationCountryError(
        'permission_unavailable',
        'Location is unavailable on this device.',
        permission.status,
      );
    }
    throw new LocationCountryError(
      'permission_required',
      'Location permission is required.',
      permission.status,
    );
  }

  throw new LocationCountryError(
    'location_unavailable',
    'Could not determine your location.',
    permission.status,
  );
};
