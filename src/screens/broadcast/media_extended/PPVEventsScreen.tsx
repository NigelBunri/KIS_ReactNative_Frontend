import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PPVEvents'>;

type PPVEvent = {
  id: string;
  title: string;
  scheduled_at: string;
  price: number;
  currency?: string;
  viewer_count: number;
  has_ticket?: boolean;
  thumbnail_url?: string;
};

export default function PPVEventsScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const sp = layout.pageGutter;

  const [events, setEvents] = useState<PPVEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticketLoading, setTicketLoading] = useState<string | null>(null);
  const [watchLoading, setWatchLoading] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await getRequest(ROUTES.mediaExtended.ppvEvents);
      setEvents(res?.data ?? res ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    fetchEvents();
    return () => { active = false; };
  }, [fetchEvents]));

  const handleBuyTicket = async (event: PPVEvent) => {
    Alert.alert(
      'Buy Ticket',
      `Purchase ticket for "${event.title}" — ${event.currency ?? 'USD'} ${event.price}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy',
          onPress: async () => {
            setTicketLoading(event.id);
            try {
              await postRequest(ROUTES.mediaExtended.ppvPurchase(event.id), {
                price_paid: event.price,
              });
              await fetchEvents();
              Alert.alert('Success', 'Ticket purchased! Tap Watch to view the event.');
            } catch {
              Alert.alert('Error', 'Purchase failed. Please try again.');
            } finally {
              setTicketLoading(null);
            }
          },
        },
      ],
    );
  };

  const handleWatch = async (event: PPVEvent) => {
    setWatchLoading(event.id);
    try {
      const res: any = await getRequest(ROUTES.mediaExtended.ppvStream(event.id));
      const streamUrl = res?.data?.stream_url ?? res?.stream_url ?? null;
      if (streamUrl) {
        await Linking.openURL(streamUrl);
      } else {
        Alert.alert('Not Available', 'Stream is not available yet.');
      }
    } catch {
      Alert.alert('Error', 'Could not load stream.');
    } finally {
      setWatchLoading(null);
    }
  };

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg },
    header: { padding: sp, paddingBottom: sp + 4 },
    backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, minHeight: 44 },
    backLabel: { fontSize: 16, color: palette.ivory, marginLeft: 4 },
    headerTitle: { fontSize: 24, fontWeight: '700', color: palette.ivory },
    scroll: { flex: 1 },
    content: { padding: sp, paddingBottom: 80 },
    card: {
      backgroundColor: palette.card,
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 16,
    },
    thumbnail: {
      height: 160,
      backgroundColor: palette.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cardBody: { padding: sp },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
    eventTitle: { fontSize: 16, fontWeight: '700', color: palette.text, flex: 1, marginRight: 8 },
    price: { fontSize: 16, fontWeight: '700', color: palette.gold },
    metaRow: { flexDirection: 'row', gap: 16, marginBottom: 12, flexWrap: 'wrap' },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 13, color: palette.subtext },
    ticketBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: palette.primary,
      alignSelf: 'flex-start',
      marginBottom: 10,
    },
    ticketText: { fontSize: 12, fontWeight: '600', color: palette.ivory },
    actionsRow: { flexDirection: 'row', gap: 10 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    empty: { textAlign: 'center', color: palette.subtext, padding: sp * 2 },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={[palette.gradientStart, palette.gradientEnd]} style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <KISIcon name="chevron-back-outline" size={22} color={palette.ivory} />
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>PPV Events</Text>
      </LinearGradient>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {events.length === 0 && (
          <Text style={styles.empty}>No events scheduled.</Text>
        )}
        {events.map((event) => (
          <View key={event.id} style={styles.card}>
            <View style={styles.thumbnail}>
              <KISIcon name="videocam-outline" size={48} color={palette.primary} />
            </View>
            <View style={styles.cardBody}>
              <View style={styles.titleRow}>
                <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
                <Text style={styles.price}>
                  {event.currency ?? 'USD'} {event.price}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <KISIcon name="calendar-outline" size={14} color={palette.subtext} />
                  <Text style={styles.metaText}>
                    {event.scheduled_at ? new Date(event.scheduled_at).toLocaleString() : 'TBA'}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <KISIcon name="eye-outline" size={14} color={palette.subtext} />
                  <Text style={styles.metaText}>{event.viewer_count ?? 0} viewers</Text>
                </View>
              </View>

              {event.has_ticket && (
                <View style={styles.ticketBadge}>
                  <KISIcon name="ticket-outline" size={14} color={palette.ivory} />
                  <Text style={styles.ticketText}>Ticket Owned</Text>
                </View>
              )}

              <View style={styles.actionsRow}>
                {event.has_ticket ? (
                  <KISButton
                    title="Watch"
                    variant="primary"
                    loading={watchLoading === event.id}
                    onPress={() => handleWatch(event)}
                    left={<KISIcon name="play-circle-outline" size={16} color={palette.ivory} />}
                    style={{ flex: 1 }}
                  />
                ) : (
                  <KISButton
                    title="Buy Ticket"
                    variant="primary"
                    loading={ticketLoading === event.id}
                    onPress={() => handleBuyTicket(event)}
                    left={<KISIcon name="ticket-outline" size={16} color={palette.ivory} />}
                    style={{ flex: 1 }}
                  />
                )}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
