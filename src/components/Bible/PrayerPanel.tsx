import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import BibleSectionCard from './BibleSectionCard';
import { getRequest } from '@/network/get';
import ROUTES from '@/network';
import { KISIcon } from '@/constants/kisIcons';

type PrayerDay = {
  id: string;
  day: number;
  prayer_points: string[];
  exhortation: string;
  scripture_refs: string[];
};

type PrayerMonth = {
  id: string;
  year: number;
  month: number;
  title: string;
  theme: string;
  partner_name?: string;
  days?: PrayerDay[];
};

const listFromResponse = (data: any) => {
  const payload = data?.results ?? data ?? [];
  return Array.isArray(payload) ? payload : [];
};

const monthName = (month?: number) =>
  new Date(2026, Math.max(0, Number(month || 1) - 1), 1).toLocaleString('default', { month: 'long' });

const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();
const firstWeekday = (year: number, month: number) => new Date(year, month - 1, 1).getDay();

const stringList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
};

export default function PrayerPanel() {
  const { palette } = useKISTheme();
  const now = new Date();
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState<PrayerMonth | null>(null);
  const [days, setDays] = useState<PrayerDay[]>([]);
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [error, setError] = useState('');

  useEffect(() => {
    const loadPrayerCalendar = async () => {
      setLoading(true);
      setError('');
      const monthRes = await getRequest(`${ROUTES.bible.prayerMonthCurrent}?language=en`, {
        errorMessage: 'Unable to load current prayer month.',
      });
      if (!monthRes?.success) {
        setError(monthRes?.message || 'No prayer calendar is published for this month.');
        setMonth(null);
        setDays([]);
        setLoading(false);
        return;
      }
      const currentMonth = monthRes.data as PrayerMonth;
      setMonth(currentMonth);
      const dayRes = await getRequest(`${ROUTES.bible.prayerDays}?prayer_month=${currentMonth.id}`, {
        errorMessage: 'Unable to load prayer days.',
      });
      const nextDays = listFromResponse(dayRes?.data).map((day) => ({
        ...day,
        prayer_points: stringList(day.prayer_points),
        scripture_refs: stringList(day.scripture_refs),
      }));
      const embeddedDays = (currentMonth.days ?? []).map((day) => ({
        ...day,
        prayer_points: stringList(day.prayer_points),
        scripture_refs: stringList(day.scripture_refs),
      }));
      setDays(nextDays.length ? nextDays : embeddedDays);
      setLoading(false);
    };
    loadPrayerCalendar();
  }, []);

  const dayByNumber = useMemo(() => {
    const map = new Map<number, PrayerDay>();
    days.forEach((day) => map.set(Number(day.day), day));
    return map;
  }, [days]);

  const selected = dayByNumber.get(selectedDay) ?? null;
  const calendarDays = month
    ? [
        ...Array.from({ length: firstWeekday(month.year, month.month) }, () => null),
        ...Array.from({ length: daysInMonth(month.year, month.month) }, (_, index) => index + 1),
      ]
    : [];

  if (loading) {
    return (
      <BibleSectionCard>
        <View style={styles.stateBox}>
          <ActivityIndicator color={palette.primaryStrong} />
          <Text style={{ color: palette.subtext }}>Loading KCAN prayer calendar...</Text>
        </View>
      </BibleSectionCard>
    );
  }

  return (
    <View style={styles.stack}>
      <BibleSectionCard>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: palette.text }]}>Prayer Calendar</Text>
            <Text style={{ color: palette.subtext, marginTop: 4 }}>
              Monthly KCAN prayer points with exhortations and scripture references.
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: palette.primarySoft }]}>
            <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>KCAN</Text>
          </View>
        </View>
      </BibleSectionCard>

      {!month ? (
        <BibleSectionCard>
          <View style={styles.stateBox}>
            <KISIcon name="calendar" size={24} color={palette.subtext} />
            <Text style={{ color: palette.text, fontWeight: '900' }}>No prayer month published</Text>
            <Text style={{ color: palette.subtext, textAlign: 'center' }}>
              {error || 'KCAN prayer calendar content will appear here after publishing.'}
            </Text>
          </View>
        </BibleSectionCard>
      ) : (
        <>
          <BibleSectionCard>
            <Text style={[styles.monthTitle, { color: palette.text }]}>
              {month.title || `${monthName(month.month)} ${month.year}`}
            </Text>
            <Text style={{ color: palette.primaryStrong, fontWeight: '800', marginTop: 4 }}>
              {month.theme || `${monthName(month.month)} ${month.year}`}
            </Text>
            {month.partner_name ? (
              <Text style={{ color: palette.subtext, marginTop: 4 }}>{month.partner_name}</Text>
            ) : null}

            <View style={styles.weekHeader}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => (
                <Text key={`${label}-${index}`} style={[styles.weekLabel, { color: palette.subtext }]}>
                  {label}
                </Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {calendarDays.map((day, index) => {
                if (!day) {
                  return <View key={`blank-${index}`} style={styles.dayCellPlaceholder} />;
                }
                const hasPrayer = dayByNumber.has(day);
                const active = selectedDay === day;
                return (
                  <TouchableOpacity
                    key={day}
                    onPress={() => setSelectedDay(day)}
                    style={[
                      styles.dayCell,
                      {
                        borderColor: active ? palette.primaryStrong : palette.divider,
                        backgroundColor: active ? palette.primarySoft : palette.surface,
                        opacity: hasPrayer ? 1 : 0.55,
                      },
                    ]}
                  >
                    <Text style={{ color: active ? palette.primaryStrong : palette.text, fontWeight: '900' }}>
                      {day}
                    </Text>
                    {hasPrayer ? <View style={[styles.dot, { backgroundColor: palette.primaryStrong }]} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </BibleSectionCard>

          <BibleSectionCard>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Day {selectedDay} {selected ? '' : 'not published'}
            </Text>
            {selected ? (
              <>
                <View style={styles.points}>
                  {selected.prayer_points?.map((point, index) => (
                    <View key={`${point}-${index}`} style={[styles.pointRow, { borderColor: palette.divider }]}>
                      <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>{index + 1}</Text>
                      <Text style={{ color: palette.text, flex: 1, lineHeight: 22 }}>{point}</Text>
                    </View>
                  ))}
                </View>

                {selected.scripture_refs?.length ? (
                  <View style={styles.refWrap}>
                    {selected.scripture_refs.map((ref) => (
                      <View key={ref} style={[styles.refChip, { borderColor: palette.divider }]}>
                        <Text style={{ color: palette.primaryStrong, fontWeight: '700' }}>{ref}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={[styles.exhortationBox, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
                  <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' }}>
                    Exhortation
                  </Text>
                  <Text style={{ color: palette.text, lineHeight: 24, marginTop: 6 }}>{selected.exhortation}</Text>
                </View>
              </>
            ) : (
              <Text style={{ color: palette.subtext }}>
                KCAN has not published prayer points for this day yet.
              </Text>
            )}
          </BibleSectionCard>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '900' },
  sectionTitle: { fontSize: 18, fontWeight: '900' },
  monthTitle: { fontSize: 22, fontWeight: '900' },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  stateBox: { minHeight: 170, alignItems: 'center', justifyContent: 'center', gap: 10 },
  weekHeader: { flexDirection: 'row', marginTop: 14 },
  weekLabel: { flex: 1, textAlign: 'center', fontWeight: '900' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  dayCell: {
    width: '13.45%',
    aspectRatio: 1,
    borderWidth: 2,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dayCellPlaceholder: {
    width: '13.45%',
    aspectRatio: 1,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  points: { gap: 8 },
  pointRow: { borderWidth: 2, borderRadius: 12, padding: 10, flexDirection: 'row', gap: 10 },
  refWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  refChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  exhortationBox: { borderWidth: 2, borderRadius: 12, padding: 12 },
});
