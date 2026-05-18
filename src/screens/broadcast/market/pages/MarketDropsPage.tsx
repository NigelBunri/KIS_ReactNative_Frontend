import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import { KISIcon } from '@/constants/kisIcons';
import useMarketData from '@/screens/broadcast/market/hooks/useMarketData';
import { MarketDrop } from '@/screens/broadcast/market/api/market.types';

const fallbackCover = require('@/assets/logo-light.png');

type Props = {
  ownerId?: string | null;
  searchTerm?: string;
};

function useCountdown(endsAt?: string | null): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!endsAt) return;
    const target = new Date(endsAt).getTime();
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return remaining;
}

function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  return `${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
}

function formatStartAt(iso?: string): string {
  if (!iso) return 'Time TBA';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function PulseDot() {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1.7, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    ).start();
  }, [anim]);
  return (
    <Animated.View
      style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#e74c3c', transform: [{ scale: anim }] }}
    />
  );
}

function DropCard({ drop, onJoin }: { drop: MarketDrop; onJoin?: () => void }) {
  const { palette } = useKISTheme();
  const remaining = useCountdown(drop.ends_at);
  const startsRemaining = useCountdown(
    !drop.is_live && drop.starts_at && new Date(drop.starts_at) > new Date() ? drop.starts_at : null,
  );
  const imgSource = drop.cover_url ? { uri: drop.cover_url } : fallbackCover;
  const isEndingSoon = remaining !== null && remaining < 3600000 && remaining > 0;

  return (
    <View
      style={{
        borderWidth: 1.5,
        borderColor: drop.is_live ? '#e74c3c' : isEndingSoon ? '#f39c12' : palette.divider,
        backgroundColor: palette.surface,
        borderRadius: 20,
        overflow: 'hidden',
      }}
    >
      <View style={{ height: 140 }}>
        <Image source={imgSource} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' }} />

        <View style={{ position: 'absolute', top: 10, left: 10, flexDirection: 'row', gap: 6 }}>
          {drop.is_live ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                backgroundColor: '#e74c3c',
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 4,
              }}
            >
              <PulseDot />
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 11 }}>LIVE NOW</Text>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: 'rgba(0,0,0,0.5)',
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 4,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>UPCOMING</Text>
            </View>
          )}
        </View>

        <View style={{ position: 'absolute', bottom: 10, left: 12, right: 12, gap: 4 }}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 4 }} numberOfLines={1}>
            {drop.title ?? 'Drop'}
          </Text>
          {drop.shop_name && (
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '700', fontSize: 12 }}>
              {drop.shop_name}
            </Text>
          )}
        </View>
      </View>

      <View style={{ padding: 12, gap: 8 }}>
        {drop.is_live && remaining !== null && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: isEndingSoon ? '#e74c3c15' : palette.card,
              borderRadius: 10,
              padding: 10,
            }}
          >
            <KISIcon name="time-outline" size={16} color={isEndingSoon ? '#e74c3c' : palette.subtext} />
            <View>
              <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 11 }}>Ends in</Text>
              <Text
                style={{
                  color: isEndingSoon ? '#e74c3c' : palette.text,
                  fontWeight: '900',
                  fontSize: 18,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {remaining === 0 ? 'Ended' : formatCountdown(remaining)}
              </Text>
            </View>
          </View>
        )}

        {!drop.is_live && startsRemaining !== null && startsRemaining > 0 && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: palette.card,
              borderRadius: 10,
              padding: 10,
            }}
          >
            <KISIcon name="calendar-outline" size={16} color={palette.subtext} />
            <View>
              <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 11 }}>Starts in</Text>
              <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16, fontVariant: ['tabular-nums'] }}>
                {formatCountdown(startsRemaining)}
              </Text>
            </View>
          </View>
        )}

        {!drop.is_live && (!startsRemaining || startsRemaining === 0) && drop.starts_at && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <KISIcon name="calendar-outline" size={14} color={palette.subtext} />
            <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 13 }}>
              {formatStartAt(drop.starts_at)}
            </Text>
          </View>
        )}

        {drop.product_ids && drop.product_ids.length > 0 && (
          <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 12 }}>
            {drop.product_ids.length} product{drop.product_ids.length !== 1 ? 's' : ''} in this drop
          </Text>
        )}

        <Pressable
          onPress={onJoin}
          style={{
            borderWidth: 1.5,
            borderColor: drop.is_live ? '#e74c3c' : palette.primary,
            backgroundColor: drop.is_live ? '#e74c3c15' : palette.primarySoft,
            borderRadius: 12,
            paddingVertical: 10,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              color: drop.is_live ? '#e74c3c' : palette.primaryStrong,
              fontWeight: '900',
              fontSize: 14,
            }}
          >
            {drop.is_live ? 'Watch live drop' : 'Set reminder'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function MarketDropsPage({ ownerId = null, searchTerm = '' }: Props) {
  const { palette } = useKISTheme();
  const { home, loadingHome, reloadAll } = useMarketData({ ownerId, q: searchTerm });

  const liveDrops = (home.drops ?? []).filter((d) => d.is_live);
  const scheduled = (home.drops ?? []).filter((d) => !d.is_live);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
      <View style={{ paddingHorizontal: 12, gap: 20 }}>

        {/* Header strip */}
        <View
          style={{
            borderWidth: 1.5,
            borderColor: palette.divider,
            backgroundColor: palette.card,
            borderRadius: 20,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ gap: 4 }}>
            <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>⚡ Market Drops</Text>
            <Text style={{ color: palette.subtext, fontWeight: '700', fontSize: 13 }}>
              Live sales · Limited stock · USD checkout
            </Text>
          </View>
          <Pressable
            onPress={reloadAll}
            style={{
              borderWidth: 1.5,
              borderColor: palette.divider,
              backgroundColor: palette.surface,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: loadingHome ? palette.subtext : palette.text, fontWeight: '900', fontSize: 12 }}>
              {loadingHome ? 'Loading…' : 'Refresh'}
            </Text>
          </Pressable>
        </View>

        {/* Live drops */}
        {liveDrops.length > 0 && (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Live Now</Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: '#e74c3c',
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}
              >
                <PulseDot />
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 11 }}>{liveDrops.length}</Text>
              </View>
            </View>
            {liveDrops.map((d) => (
              <DropCard
                key={d.id}
                drop={d}
                onJoin={() => Alert.alert('Live Drop', `Joining "${d.title ?? 'drop'}"…`)}
              />
            ))}
          </View>
        )}

        {/* Scheduled drops */}
        {scheduled.length > 0 && (
          <View style={{ gap: 12 }}>
            <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Upcoming Drops</Text>
            {scheduled.slice(0, 8).map((d) => (
              <DropCard
                key={d.id}
                drop={d}
                onJoin={() => Alert.alert('Drop Reminder', `Reminder set for "${d.title ?? 'drop'}"`)}
              />
            ))}
          </View>
        )}

        {liveDrops.length === 0 && scheduled.length === 0 && !loadingHome && (
          <View
            style={{
              borderWidth: 1.5,
              borderColor: palette.divider,
              backgroundColor: palette.card,
              borderRadius: 20,
              padding: 32,
              alignItems: 'center',
              gap: 12,
            }}
          >
            <KISIcon name="flash-outline" size={40} color={palette.subtext} />
            <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>No drops yet</Text>
            <Text style={{ color: palette.subtext, fontWeight: '700', textAlign: 'center' }}>
              Live drops and scheduled sales from verified shops will appear here.
            </Text>
          </View>
        )}

        {/* Go live CTA */}
        <Pressable
          onPress={() => Alert.alert('Coming soon', 'Live drop studio will be available in an upcoming update.')}
          style={{
            borderWidth: 1.5,
            borderColor: palette.primary,
            backgroundColor: palette.primarySoft,
            borderRadius: 20,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: palette.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <KISIcon name="videocam-outline" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: palette.primaryStrong, fontWeight: '900', fontSize: 15 }}>
              Start a Live Drop
            </Text>
            <Text style={{ color: palette.primaryStrong, fontWeight: '700', fontSize: 12, opacity: 0.8 }}>
              Launch limited-time sales with countdown timers
            </Text>
          </View>
          <KISIcon name="chevron-forward-outline" size={18} color={palette.primaryStrong} />
        </Pressable>

      </View>
    </ScrollView>
  );
}
