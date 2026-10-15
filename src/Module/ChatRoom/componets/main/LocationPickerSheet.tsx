import React, { useCallback, useRef, useEffect, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { KISIcon } from '@/constants/kisIcons';
import type { LocationMessage } from '../../chatTypes';

async function getCurrentLocation(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    const Geolocation = require('react-native-geolocation-service').default;
    Geolocation.getCurrentPosition(
      (pos: any) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err: any) => reject(err),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000, forceRequestLocation: true },
    );
  });
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
      { headers: { 'User-Agent': 'KIS-App' } },
    );
    const json = await res.json();
    return json?.display_name ?? `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }
}

// AND-032: this sheet previously only ever offered the device's current
// GPS position — there was no way to pick anywhere else, which is what
// "no location search" was reporting. Forward-geocodes a free-text query
// into coordinates + a display address using the same free, keyless
// Nominatim endpoint reverseGeocode() above already relies on (no new
// third-party credential needed).
export async function searchLocation(query: string): Promise<{ latitude: number; longitude: number; address: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
      { headers: { 'User-Agent': 'KIS-App' } },
    );
    const json = await res.json();
    const first = Array.isArray(json) ? json[0] : null;
    if (!first) return null;
    const latitude = Number(first.lat);
    const longitude = Number(first.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude, address: first.display_name ?? query };
  } catch {
    return null;
  }
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onSendLocation: (loc: LocationMessage) => void;
  palette: any;
};

export const LocationPickerSheet: React.FC<Props> = ({
  visible,
  onClose,
  onSendLocation,
  palette,
}) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<LocationMessage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
    if (visible && !location) {
      fetchLocation();
    }
  }, [visible]);

  const fetchLocation = useCallback(async () => {
    setLoading(true);
    try {
      const { latitude, longitude } = await getCurrentLocation();
      const address = await reverseGeocode(latitude, longitude);
      setLocation({ latitude, longitude, address, title: 'Current Location' });
    } catch (err: any) {
      Alert.alert(
        'Location',
        'Unable to get your location. Please enable location permissions in Settings.',
        [{ text: 'OK' }],
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    try {
      const result = await searchLocation(q);
      if (!result) {
        Alert.alert('Location', `Couldn't find "${q}". Try a different search.`);
        return;
      }
      setLocation({
        latitude: result.latitude,
        longitude: result.longitude,
        address: result.address,
        title: q,
      });
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] });

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: palette.surface ?? palette.bg,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: palette.divider }]} />
        <View style={[styles.header, { borderBottomColor: palette.divider }]}>
          <Text style={[styles.title, { color: palette.text }]}>Share Location</Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
            <KISIcon name="close" size={22} color={palette.text} />
          </Pressable>
        </View>

        <View style={styles.body}>
          {/* AND-032: location search — previously this sheet only ever
              offered the device's current GPS fix, with no way to pick
              anywhere else. */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              placeholder="Search for a place or address"
              placeholderTextColor={palette.subtext}
              style={{
                flex: 1,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: palette.divider,
                backgroundColor: palette.surfaceSoft ?? palette.card,
                paddingHorizontal: 14,
                paddingVertical: 10,
                color: palette.text,
              }}
            />
            <Pressable
              onPress={handleSearch}
              disabled={searching || !searchQuery.trim()}
              accessibilityRole="button"
              accessibilityLabel="Search location"
              style={{
                paddingHorizontal: 16,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: searchQuery.trim() ? palette.primary : palette.divider,
              }}
            >
              {searching ? (
                <ActivityIndicator size="small" color={palette.onPrimary ?? '#fff'} />
              ) : (
                <KISIcon name="search" size={18} color={searchQuery.trim() ? (palette.onPrimary ?? '#fff') : palette.subtext} />
              )}
            </Pressable>
          </View>

          {/* Map placeholder */}
          <View
            style={[
              styles.mapPlaceholder,
              { backgroundColor: palette.surfaceSoft ?? palette.card },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={palette.primary} />
            ) : location ? (
              <>
                <Image
                  source={{
                    uri: `https://static-maps.yandex.ru/1.x/?lang=en_US&ll=${location.longitude},${location.latitude}&z=15&l=map&size=650,220&pt=${location.longitude},${location.latitude},pm2rdm`,
                  }}
                  style={{ width: '100%', height: '100%', borderRadius: 10 }}
                  resizeMode="cover"
                />
                <View style={{ position: 'absolute', bottom: 6, left: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: palette.ivory, fontSize: 11 }}>
                    {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                  </Text>
                </View>
              </>
            ) : (
              <KISIcon name="info" size={28} color={palette.subtext} />
            )}
          </View>

          {location && (
            <View style={styles.addressCard}>
              <KISIcon name="pin" size={16} color={palette.primary} focused />
              <Text
                style={[styles.addressText, { color: palette.text }]}
                numberOfLines={3}
              >
                {location.address}
              </Text>
            </View>
          )}

          {/* Refresh */}
          {!loading && (
            <Pressable
              style={[styles.refreshBtn, { borderColor: palette.divider }]}
              onPress={fetchLocation}
              accessibilityRole="button"
              accessibilityLabel="Refresh location"
            >
              <KISIcon name="refresh" size={16} color={palette.primary} />
              <Text style={[styles.refreshText, { color: palette.primary }]}>
                Refresh Location
              </Text>
            </Pressable>
          )}

          {/* Send */}
          <Pressable
            style={[
              styles.sendBtn,
              { backgroundColor: location ? palette.primary : palette.divider },
            ]}
            disabled={!location || loading}
            accessibilityRole="button"
            accessibilityLabel="Send this location"
            onPress={() => {
              if (location) {
                onSendLocation(location);
                onClose();
              }
            }}
          >
            <KISIcon
              name="send"
              size={18}
              color={location ? palette.onPrimary : palette.subtext}
              focused
            />
            <Text
              style={[
                styles.sendText,
                { color: location ? (palette.onPrimary) : palette.subtext },
              ]}
            >
              Send Location
            </Text>
          </Pressable>

          {/* Live location */}
          <Pressable
            style={[
              styles.sendBtn,
              { backgroundColor: location ? '#E53935' : palette.divider, marginTop: 8 },
            ]}
            disabled={!location || loading}
            accessibilityRole="button"
            accessibilityLabel="Share live location for 15 minutes"
            onPress={() => {
              if (!location) return;
              // Unlike the one-time pin above, this continuously shares the
              // user's real-time position with everyone in the chat for a
              // full 15 minutes - a materially different privacy commitment
              // that fired on a single tap with no chance to back out. A
              // short confirm costs one tap but prevents an accidental share
              // of live whereabouts for a quarter of an hour.
              Alert.alert(
                'Share live location?',
                'Your real-time location will be visible to everyone in this chat for the next 15 minutes.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Share',
                    onPress: () => {
                      onSendLocation({ ...location, isLive: true, expiresAt: Date.now() + 15 * 60 * 1000 });
                      onClose();
                    },
                  },
                ],
              );
            }}
          >
            <KISIcon
              name="pin"
              size={18}
              color={location ? '#fff' : palette.subtext}
              focused
            />
            <Text
              style={[
                styles.sendText,
                { color: location ? '#fff' : palette.subtext },
              ]}
            >
              Share Live Location (15 min)
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: 32,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 17, fontWeight: '700' },
  body: { padding: 20, gap: 16 },
  mapPlaceholder: {
    height: 180,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coordText: { fontSize: 12, fontWeight: '500' },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 4,
  },
  addressText: { flex: 1, fontSize: 14, lineHeight: 20 },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  refreshText: { fontSize: 13, fontWeight: '600' },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 15,
    borderRadius: 16,
    marginTop: 4,
  },
  sendText: { fontSize: 16, fontWeight: '700' },
});
