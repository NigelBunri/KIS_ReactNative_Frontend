import React, { forwardRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import ViewShot from 'react-native-view-shot';

export type SharePayload = {
  mode: 'text' | 'image';
  text: string;
  imageUri?: string | null;
  watermarkColor: string;
  subtitle?: string;
};

type Props = {
  payload: SharePayload | null;
};

const CARD_SIZE = 720;

const ShareRenderer = forwardRef<ViewShot, Props>(({ payload }, ref) => {
  if (!payload) return null;

  const { mode, text, imageUri, watermarkColor, subtitle } = payload;

  return (
    <ViewShot
      ref={ref}
      options={{ format: 'png', quality: 0.95 }}
      style={styles.capture}
    >
      <View style={styles.card}>
        {mode === 'image' && imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.textWrap}>
            <Text style={styles.text} numberOfLines={8}>
              {text}
            </Text>
          </View>
        )}

        <View style={[styles.badge, { backgroundColor: watermarkColor }]}>
          <Text style={styles.badgeText}>KIS</Text>
        </View>
        {subtitle ? (
          <View style={[styles.subtitle, { borderColor: watermarkColor }]}>
            <Text style={[styles.subtitleText, { color: watermarkColor }]} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
        ) : null}
      </View>
    </ViewShot>
  );
});

ShareRenderer.displayName = 'ShareRenderer';

const styles = StyleSheet.create({
  capture: {
    position: 'absolute',
    left: -9999,
    top: -9999,
  },
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    backgroundColor: '#0B1220',
    borderRadius: 32,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  textWrap: {
    flex: 1,
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#F8FAFC',
    fontSize: 32,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 42,
  },
  badge: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  badgeText: {
    color: '#0B1220',
    fontWeight: '800',
    letterSpacing: 1,
  },
  subtitle: {
    position: 'absolute',
    left: 24,
    bottom: 24,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 2,
    backgroundColor: '#0B1220',
  },
  subtitleText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

export default ShareRenderer;
