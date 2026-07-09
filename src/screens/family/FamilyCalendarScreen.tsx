import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';
import FamilySelect from './components/FamilySelect';

type Props = NativeStackScreenProps<RootStackParamList, 'FamilyCalendar'>;

type FamilyEvent = {
  id: string;
  title: string;
  event_type: string;
  date: string;
  reminder?: boolean;
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const EVENT_TYPES = ['birthday', 'anniversary', 'holiday', 'meeting', 'other'];

function buildCalendarGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function FamilyCalendarScreen({}: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState('birthday');
  const [formDate, setFormDate] = useState('');
  const [formReminder, setFormReminder] = useState(false);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getRequest(ROUTES.family.events)
        .then((res: any) => {
          if (!active) return;
          setEvents(Array.isArray(res) ? res : res?.results ?? []);
        })
        .catch(() => setEvents([]))
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, []),
  );

  const cells = buildCalendarGrid(year, month);
  const gutter = layout.pageGutter;
  const cellSize = Math.floor((layout.width - gutter * 2 - 6) / 7);

  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
  const dayEvents = events.filter((e) => e.date?.startsWith(dateStr));

  // Which days have events this month?
  const eventDays = new Set(
    events
      .filter((e) => {
        const d = new Date(e.date);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .map((e) => new Date(e.date).getDate()),
  );

  function prevMonth() {
    if (month === 0) { setYear(year - 1); setMonth(11); } else setMonth(month - 1);
    setSelectedDay(1);
  }
  function nextMonth() {
    if (month === 11) { setYear(year + 1); setMonth(0); } else setMonth(month + 1);
    setSelectedDay(1);
  }

  async function handleAddEvent() {
    if (!formTitle.trim() || !formDate.trim()) {
      Alert.alert('Title and date are required');
      return;
    }
    setSaving(true);
    try {
      const newEvent = (await postRequest(ROUTES.family.events, {
        title: formTitle.trim(),
        event_type: formType,
        date: formDate.trim(),
        reminder: formReminder,
      })) as unknown as FamilyEvent;
      setEvents((prev) => [...prev, newEvent]);
      setShowForm(false);
      setFormTitle('');
      setFormDate('');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to add event');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, }]}>
        <ActivityIndicator style={styles.flex} color={palette.gold} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        {/* Month nav */}
        <View style={[styles.monthNav, { paddingHorizontal: gutter }]}>
          <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <KISIcon name="chevron-back-outline" size={24} color={palette.text} />
          </TouchableOpacity>
          <Text style={[styles.monthTitle, { color: palette.text }]}>
            {MONTHS[month]} {year}
          </Text>
          <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <KISIcon name="chevron-forward-outline" size={24} color={palette.text} />
          </TouchableOpacity>
        </View>

        {/* Day headers */}
        <View style={[styles.grid, { paddingHorizontal: gutter }]}>
          {DAYS.map((d) => (
            <View key={d} style={[styles.cell, { width: cellSize }]}>
              <Text style={[styles.dayHeader, { color: palette.subtext }]}>{d}</Text>
            </View>
          ))}

          {/* Calendar cells */}
          {cells.map((day, idx) => {
            const isToday =
              day === today.getDate() &&
              month === today.getMonth() &&
              year === today.getFullYear();
            const isSelected = day === selectedDay;
            const hasEvent = day !== null && eventDays.has(day);
            return (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.cell,
                  { width: cellSize },
                  isSelected && day !== null && { backgroundColor: palette.primary, borderRadius: cellSize / 2 },
                ]}
                onPress={() => day !== null && setSelectedDay(day)}
                disabled={day === null}
                hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
              >
                {day !== null && (
                  <>
                    <Text
                      style={[
                        styles.dayNum,
                        {
                          color: isSelected
                            ? palette.ivory
                            : isToday
                            ? palette.gold
                            : palette.text,
                          fontWeight: isToday ? '700' : '400',
                        },
                      ]}
                    >
                      {day}
                    </Text>
                    {hasEvent && (
                      <View style={[styles.dot, { backgroundColor: isSelected ? palette.ivory : palette.gold }]} />
                    )}
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Events list */}
        <View style={[styles.eventList, { paddingHorizontal: gutter }]}>
          <Text style={[styles.dateLabel, { color: palette.text }]}>
            {MONTHS[month]} {selectedDay}
          </Text>
          {dayEvents.length === 0 ? (
            <Text style={[styles.noEvents, { color: palette.subtext }]}>No events this day</Text>
          ) : (
            dayEvents.map((e) => (
              <View key={e.id} style={[styles.eventItem, { backgroundColor: palette.card, borderColor: palette.divider }]}>
                <KISIcon name="calendar-outline" size={18} color={palette.gold} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.eventTitle, { color: palette.text }]}>{e.title}</Text>
                  <Text style={[styles.eventType, { color: palette.subtext }]}>{e.event_type}</Text>
                </View>
                {e.reminder && <KISIcon name="notifications-outline" size={16} color={palette.primary} />}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: palette.gold }]}
        onPress={() => setShowForm(true)}
        activeOpacity={0.85}
      >
        <KISIcon name="add" size={28} color={palette.bg} />
      </TouchableOpacity>

      {/* Add Event Modal */}
      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: palette.surface }]}>
            <Text style={[styles.modalTitle, { color: palette.text }]}>Add Event</Text>

            <TextInput
              style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider, color: palette.text }]}
              placeholder="Event title"
              placeholderTextColor={palette.subtext}
              value={formTitle}
              onChangeText={setFormTitle}
            />
            <View style={[styles.pickerWrapper, { borderColor: palette.divider, backgroundColor: palette.card }]}>
              <FamilySelect
                value={formType}
                onChange={setFormType}
                placeholder="Event type"
                options={EVENT_TYPES.map((t) => ({
                  label: t.charAt(0).toUpperCase() + t.slice(1),
                  value: t,
                }))}
              />
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: palette.card, borderColor: palette.divider, color: palette.text }]}
              placeholder="Date (YYYY-MM-DD)"
              placeholderTextColor={palette.subtext}
              value={formDate}
              onChangeText={setFormDate}
            />

            <View style={styles.reminderRow}>
              <Text style={[styles.reminderLabel, { color: palette.text }]}>Reminder</Text>
              <TouchableOpacity
                onPress={() => setFormReminder((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <KISIcon
                  name={formReminder ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={formReminder ? palette.primary : palette.subtext}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <KISButton title="Cancel" variant="ghost" onPress={() => setShowForm(false)} style={{ flex: 1 }} />
              <KISButton
                title={saving ? 'Saving…' : 'Add Event'}
                onPress={handleAddEvent}
                disabled={saving}
                loading={saving}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  monthTitle: { fontSize: 18, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { alignItems: 'center', paddingVertical: 6, height: 44 },
  dayHeader: { fontSize: 12, fontWeight: '600' },
  dayNum: { fontSize: 15 },
  dot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 2 },
  eventList: { marginTop: 20 },
  dateLabel: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  noEvents: { fontSize: 14, fontStyle: 'italic' },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  eventTitle: { fontSize: 15, fontWeight: '600' },
  eventType: { fontSize: 12, marginTop: 2 },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 48,
  },
  pickerWrapper: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  reminderLabel: { fontSize: 15 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
});
