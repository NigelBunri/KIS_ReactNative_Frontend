import { Platform } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import {
  PERMISSIONS,
  RESULTS,
  check,
  request,
  type PermissionStatus,
} from 'react-native-permissions';

export const DEFAULT_COUNTRY_ISO = 'CM';
export const DEFAULT_CALLING_CODE = '+237';

export const CALLING_CODE_BY_ISO: Record<string, string> = {
  CM: '+237',
  NG: '+234',
  GH: '+233',
  KE: '+254',
  ZA: '+27',
  CI: '+225',
  DZ: '+213',
  MA: '+212',
  TN: '+216',
  UG: '+256',
  RW: '+250',
  SN: '+221',
  NE: '+227',
  TD: '+235',
  GA: '+241',
  GQ: '+240',
  FR: '+33',
  DE: '+49',
  GB: '+44',
  IT: '+39',
  ES: '+34',
  US: '+1',
  CA: '+1',
  BR: '+55',
  MX: '+52',
  IN: '+91',
  CN: '+86',
  JP: '+81',
  KR: '+82',
  AU: '+61',
  NZ: '+64',
};

export class LocationCountryError extends Error {
  code:
    | 'permission_required'
    | 'permission_blocked'
    | 'permission_unavailable'
    | 'location_unavailable';
  permissionStatus?: PermissionStatus;

  constructor(
    code:
      | 'permission_required'
      | 'permission_blocked'
      | 'permission_unavailable'
      | 'location_unavailable',
    message: string,
    permissionStatus?: PermissionStatus,
  ) {
    super(message);
    this.code = code;
    this.permissionStatus = permissionStatus;
  }
}

const LOCATION_PERMISSION =
  Platform.OS === 'ios'
    ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
    : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

const normalizeCountryIso = (value: string | null | undefined) => {
  const raw = String(value || '').trim().toUpperCase();
  return raw.length === 2 ? raw : '';
};

export const callingCodeForCountry = (countryIso: string | null | undefined) => {
  const iso = normalizeCountryIso(countryIso);
  return CALLING_CODE_BY_ISO[iso] || DEFAULT_CALLING_CODE;
};

export const ensureLocationPermission = async (requestIfNeeded: boolean) => {
  let status = await check(LOCATION_PERMISSION);
  if (requestIfNeeded && status === RESULTS.DENIED) {
    status = await request(LOCATION_PERMISSION);
  }
  const granted = status === RESULTS.GRANTED || status === RESULTS.LIMITED;
  return { granted, status };
};

export const getCurrentCoordinates = () =>
  new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: Number(position?.coords?.latitude),
          longitude: Number(position?.coords?.longitude),
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
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

export const resolveLocationCountry = async (requestIfNeeded: boolean) => {
  const permission = await ensureLocationPermission(requestIfNeeded);
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

  let coords: { latitude: number; longitude: number } | null = null;
  try {
    coords = await getCurrentCoordinates();
  } catch {
    throw new LocationCountryError(
      'location_unavailable',
      'Turn on device location services to continue.',
      permission.status,
    );
  }

  const isoFromGeo = await reverseGeocodeCountryIso(coords.latitude, coords.longitude);
  const countryISO = isoFromGeo || DEFAULT_COUNTRY_ISO;

  return {
    countryISO,
    callingCode: callingCodeForCountry(countryISO),
    latitude: coords.latitude,
    longitude: coords.longitude,
    permissionStatus: permission.status,
  };
};

