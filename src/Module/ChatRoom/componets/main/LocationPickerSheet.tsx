import React, { useCallback, useRef, useEffect, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
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
          <Pressable onPress={onClose} hitSlop={8}>
            <KISIcon name="close" size={22} color={palette.text} />
          </Pressable>
        </View>

        <View style={styles.body}>
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
            onPress={() => {
              if (location) {
                onSendLocation({ ...location, isLive: true, expiresAt: Date.now() + 15 * 60 * 1000 });
                onClose();
              }
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
