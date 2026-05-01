import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import BibleSectionCard from './BibleSectionCard';
import TranslationPicker from './TranslationPicker';
import KISButton from '@/constants/KISButton';
import KISDateTimeInput from '@/constants/KISDateTimeInput';
import { KISIcon } from '@/constants/kisIcons';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import { deleteRequest } from '@/network/delete';
import ROUTES from '@/network';
import type {
  BibleReaderPayload,
  BibleTranslation,
  BibleVerse,
} from '@/screens/tabs/bible/useBibleData';
import {
  buildLocalBibleEvent,
  deleteLocalBibleEvent,
  mergeBibleEventsWithLocal,
  upsertLocalBibleEvent,
} from '@/services/bibleUserPersistence';
import {
  deleteBibleReadingEventReminders,
  scheduleBibleReadingEventReminders,
} from '@/services/inAppNotificationService';

type PlannerView = 'month' | 'week' | 'day';
type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';
type EventStatus = 'scheduled' | 'completed' | 'missed' | 'cancelled';

type PlannerEvent = {
  id: string;
  translation?: string | number | null;
  passage_ref: string;
  verse_refs?: string[];
  chapter_refs?: string[];
  start_at: string;
  end_at?: string | null;
  recurrence: Recurrence;
  reminder_offsets: number[];
  reminder_channels: string[];
  status: EventStatus;
  source?: string;
  sync_status?: 'synced' | 'local_pending';
};

const recurrenceOptions: Recurrence[] = ['none', 'daily', 'weekly', 'monthly'];
const statusOptions: EventStatus[] = [
  'scheduled',
  'completed',
  'missed',
  'cancelled',
];
const reminderOffsetOptions = [0, 10, 15, 30, 60, 1440];
const reminderChannelOptions = ['in_app', 'push', 'alarm'];

const listFromResponse = (data: any) => {
  const payload = data?.results ?? data ?? [];
  return Array.isArray(payload) ? payload : [];
};

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const monthName = (date: Date) =>
  date.toLocaleString(undefined, { month: 'long', year: 'numeric' });
const readableDateTime = (value?: string | null) => {
  if (!value) return 'No time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
  });
};
const tomorrowAt = (hour: number) => {
  const date = addDays(new Date(), 1);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

export default function BiblePlansPanel() {
  const { palette } = useKISTheme();
  const [view, setView] = useState<PlannerView>('month');
  const [cursor, setCursor] = useState(startOfDay(new Date()));
  const [events, setEvents] = useState<PlannerEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [translations, setTranslations] = useState<BibleTranslation[]>([]);
  const [selectedTranslation, setSelectedTranslation] = useState<
    string | undefined
  >();
  const [reference, setReference] = useState('John 3:16-18');
  const [selectionReader, setSelectionReader] =
    useState<BibleReaderPayload | null>(null);
  const [loadingSelection, setLoadingSelection] = useState(false);
  const [selectedVerses, setSelectedVerses] = useState<Set<string>>(new Set());
  const [startAt, setStartAt] = useState(tomorrowAt(7));
  const [endAt, setEndAt] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('none');
  const [reminderOffsets, setReminderOffsets] = useState<number[]>([15]);
  const [reminderChannels, setReminderChannels] = useState<string[]>([
    'in_app',
  ]);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const dateRange = useMemo(() => {
    if (view === 'day') {
      const start = startOfDay(cursor);
      return { from: isoDate(start), to: isoDate(start) };
    }
    if (view === 'week') {
      const start = addDays(startOfDay(cursor), -startOfDay(cursor).getDay());
      const end = addDays(start, 6);
      return { from: isoDate(start), to: isoDate(end) };
    }
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    return { from: isoDate(start), to: isoDate(end) };
  }, [cursor, view]);

  const selectedVerseIds = Array.from(selectedVerses);
  const selectedReference =
    selectedVerseIds.length && selectionReader
      ? selectionReader.verses
          .filter(verse => selectedVerses.has(String(verse.id)))
          .map(
            verse =>
              `${selectionReader.reference?.split(':')[0] ?? reference}:${
                verse.number
              }`,
          )
          .join(', ')
      : selectionReader?.reference ?? reference;

  const loadTranslations = useCallback(async () => {
    const res = await getRequest(ROUTES.bible.translations, {
      errorMessage: 'Unable to load public Bible translations.',
    });
    const payload = listFromResponse(res?.data);
    setTranslations(payload);
    setSelectedTranslation(current => current ?? payload[0]?.code);
  }, []);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const res = await getRequest(ROUTES.bible.readingEvents, {
      params: { date_from: dateRange.from, date_to: dateRange.to },
      errorMessage: 'Unable to load reading planner.',
      forceNetwork: true,
    });
    const merged = await mergeBibleEventsWithLocal(
      res?.success ? listFromResponse(res?.data) : [],
      dateRange.from,
      dateRange.to,
    );
    setEvents(merged as PlannerEvent[]);
    if (!res?.success)
      setMessage(res?.message || 'Showing saved local reading events.');
    setLoading(false);
  }, [dateRange.from, dateRange.to]);

  useEffect(() => {
    loadTranslations();
  }, [loadTranslations]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const loadSelection = async () => {
    if (!selectedTranslation || !reference.trim()) return;
    setLoadingSelection(true);
    setSelectedVerses(new Set());
    const res = await getRequest(ROUTES.bible.reader, {
      params: { translation: selectedTranslation, reference: reference.trim() },
      errorMessage: 'Unable to load selected Bible passage.',
      forceNetwork: true,
    });
    setSelectionReader(res?.success ? res.data : null);
    setMessage(
      res?.success
        ? ''
        : res?.message || 'Unable to load selected Bible passage.',
    );
    setLoadingSelection(false);
  };

  const toggleVerse = (verse: BibleVerse) => {
    setSelectedVerses(prev => {
      const next = new Set(prev);
      const id = String(verse.id);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectChapter = () => {
    if (!selectionReader?.verses?.length) return;
    setSelectedVerses(
      new Set(selectionReader.verses.map(verse => String(verse.id))),
    );
  };

  const toggleOffset = (offset: number) => {
    setReminderOffsets(prev =>
      prev.includes(offset)
        ? prev.filter(item => item !== offset)
        : [...prev, offset].sort((a, b) => a - b),
    );
  };

  const toggleChannel = (channel: string) => {
    setReminderChannels(prev =>
      prev.includes(channel)
        ? prev.filter(item => item !== channel)
        : [...prev, channel],
    );
  };

  const resetForm = () => {
    setEditingEventId(null);
    setStartAt(tomorrowAt(7));
    setEndAt('');
    setRecurrence('none');
    setReminderOffsets([15]);
    setReminderChannels(['in_app']);
    setSelectedVerses(new Set());
  };

  const createEvent = async () => {
    if (!selectedTranslation || !selectionReader) {
      Alert.alert(
        'Load scripture first',
        'Choose a public translation and load a Bible reference before scheduling.',
      );
      return;
    }
    const chapterId = selectionReader.chapter?.id;
    if (!selectedVerseIds.length && !chapterId) {
      Alert.alert(
        'Select scripture',
        'Select verses or load a chapter before scheduling.',
      );
      return;
    }
    setSaving(true);
    const res = await postRequest(
      ROUTES.bible.readingEventFromSelection,
      {
        translation: selectedTranslation,
        verses: selectedVerseIds,
        chapters: selectedVerseIds.length ? [] : [chapterId],
        passage_ref: selectedReference,
        start_at: startAt,
        end_at: endAt || null,
        recurrence,
        reminder_offsets: reminderOffsets,
        reminder_channels: reminderChannels,
        source: 'planner',
      },
      { errorMessage: 'Unable to create Bible reading event.' },
    );
    setSaving(false);
    const localEvent = buildLocalBibleEvent({
      serverEvent: res?.success ? res.data : undefined,
      translation: selectedTranslation,
      passageRef: selectedReference,
      verseRefs: selectedVerseIds.length ? selectedReference.split(', ') : [],
      chapterRefs: selectedVerseIds.length ? [] : [selectedReference],
      startAt,
      endAt: endAt || null,
      recurrence,
      reminderOffsets,
      reminderChannels,
      source: 'planner',
      pending: !res?.success,
    });
    await upsertLocalBibleEvent(localEvent);
    await scheduleBibleReadingEventReminders(localEvent);
    setMessage(
      res?.success
        ? 'Reading event created.'
        : res?.message ||
            'Reading event saved locally and will sync when available.',
    );
    resetForm();
    loadEvents();
  };

  const startEdit = (event: PlannerEvent) => {
    setEditingEventId(event.id);
    setStartAt(event.start_at);
    setEndAt(event.end_at || '');
    setRecurrence(event.recurrence || 'none');
    setReminderOffsets(event.reminder_offsets || []);
    setReminderChannels(event.reminder_channels || []);
    setMessage(`Editing schedule for ${event.passage_ref}`);
  };

  const updateEvent = async () => {
    if (!editingEventId) return;
    const existing = events.find(
      event => String(event.id) === String(editingEventId),
    );
    setSaving(true);
    const res = await patchRequest(
      `${ROUTES.bible.readingEvents}${editingEventId}/`,
      {
        start_at: startAt,
        end_at: endAt || null,
        recurrence,
        reminder_offsets: reminderOffsets,
        reminder_channels: reminderChannels,
      },
      { errorMessage: 'Unable to update reading event.' },
    );
    setSaving(false);
    if (existing) {
      const localEvent = {
        ...buildLocalBibleEvent({
          serverEvent: res?.success ? res.data : undefined,
          translation:
            existing.translation != null
              ? String(existing.translation)
              : selectedTranslation,
          passageRef: existing.passage_ref,
          verseRefs: existing.verse_refs ?? [],
          chapterRefs: existing.chapter_refs ?? [],
          startAt,
          endAt: endAt || null,
          recurrence,
          reminderOffsets,
          reminderChannels,
          status: existing.status,
          source: existing.source ?? 'planner',
          pending: !res?.success || existing.sync_status === 'local_pending',
        }),
        id: String(
          res?.success ? res.data?.id ?? editingEventId : editingEventId,
        ),
      };
      await upsertLocalBibleEvent(localEvent);
      await scheduleBibleReadingEventReminders(localEvent);
    }
    setMessage(
      res?.success
        ? 'Reading event updated.'
        : res?.message ||
            'Reading event updated locally and will sync when available.',
    );
    resetForm();
    loadEvents();
  };

  const updateStatus = async (event: PlannerEvent, status: EventStatus) => {
    const res = await patchRequest(
      `${ROUTES.bible.readingEvents}${event.id}/`,
      { status },
      { errorMessage: 'Unable to update reading status.' },
    );
    const localEvent = buildLocalBibleEvent({
      serverEvent: res?.success ? res.data : undefined,
      translation:
        event.translation != null
          ? String(event.translation)
          : selectedTranslation,
      passageRef: event.passage_ref,
      verseRefs: event.verse_refs ?? [],
      chapterRefs: event.chapter_refs ?? [],
      startAt: event.start_at,
      endAt: event.end_at ?? null,
      recurrence: event.recurrence,
      reminderOffsets: event.reminder_offsets ?? [],
      reminderChannels: event.reminder_channels ?? [],
      status,
      source: event.source ?? 'planner',
      pending: !res?.success || event.sync_status === 'local_pending',
    });
    await upsertLocalBibleEvent({
      ...localEvent,
      id: String(res?.success ? res.data?.id ?? event.id : event.id),
    });
    setMessage(
      res?.success
        ? `Marked ${status}.`
        : res?.message || `Marked ${status} locally.`,
    );
    loadEvents();
  };

  const deleteEvent = async (event: PlannerEvent) => {
    const res = await deleteRequest(
      `${ROUTES.bible.readingEvents}${event.id}/`,
      {
        errorMessage: 'Unable to delete reading event.',
      },
    );
    await deleteLocalBibleEvent(event.id);
    await deleteBibleReadingEventReminders(event.id);
    setMessage(
      res?.success
        ? 'Reading event deleted.'
        : res?.message || 'Reading event removed locally.',
    );
    loadEvents();
  };

  const visibleDays = useMemo(() => {
    if (view === 'day') return [startOfDay(cursor)];
    if (view === 'week') {
      const start = addDays(startOfDay(cursor), -startOfDay(cursor).getDay());
      return Array.from({ length: 7 }, (_, index) => addDays(start, index));
    }
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const blanks = start.getDay();
    const count = new Date(
      cursor.getFullYear(),
      cursor.getMonth() + 1,
      0,
    ).getDate();
    return [
      ...Array.from({ length: blanks }, (_, index) =>
        addDays(start, index - blanks),
      ),
      ...Array.from(
        { length: count },
        (_, index) =>
          new Date(cursor.getFullYear(), cursor.getMonth(), index + 1),
      ),
    ];
  }, [cursor, view]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, PlannerEvent[]>();
    events.forEach(event => {
      const key = isoDate(new Date(event.start_at));
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    });
    return map;
  }, [events]);

  const selectedDayEvents = eventsByDate.get(isoDate(cursor)) ?? [];
  const visibleRangeEvents = useMemo(
    () =>
      [...events].sort((a, b) =>
        String(a.start_at).localeCompare(String(b.start_at)),
      ),
    [events],
  );

  return (
    <View style={styles.stack}>
      <BibleSectionCard>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: palette.text }]}>
              Reading Planner
            </Text>
            <Text style={{ color: palette.subtext, marginTop: 4 }}>
              Bible-only calendar for selected passages, chapters, and verses.
            </Text>
          </View>
          <View
            style={[styles.badge, { backgroundColor: palette.primarySoft }]}
          >
            <Text style={{ color: palette.primaryStrong, fontWeight: '900' }}>
              Bible only
            </Text>
          </View>
        </View>

        <View style={styles.segmentRow}>
          {(['month', 'week', 'day'] as PlannerView[]).map(item => {
            const active = view === item;
            return (
              <TouchableOpacity
                key={item}
                onPress={() => setView(item)}
                style={[
                  styles.segment,
                  {
                    borderColor: palette.divider,
                    backgroundColor: active
                      ? palette.primarySoft
                      : palette.surface,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? palette.primaryStrong : palette.text,
                    fontWeight: '800',
                  }}
                >
                  {item[0].toUpperCase() + item.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.navRow}>
          <KISButton
            title="Previous"
            size="xs"
            variant="outline"
            onPress={() =>
              setCursor(
                addDays(
                  cursor,
                  view === 'month' ? -30 : view === 'week' ? -7 : -1,
                ),
              )
            }
          />
          <Text style={[styles.monthTitle, { color: palette.text }]}>
            {monthName(cursor)}
          </Text>
          <KISButton
            title="Next"
            size="xs"
            variant="outline"
            onPress={() =>
              setCursor(
                addDays(
                  cursor,
                  view === 'month' ? 30 : view === 'week' ? 7 : 1,
                ),
              )
            }
          />
        </View>
      </BibleSectionCard>

      <BibleSectionCard>
        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={palette.primaryStrong} />
            <Text style={{ color: palette.subtext }}>
              Loading reading events...
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.calendarGrid}>
              {visibleDays.map((day, index) => {
                const key = isoDate(day);
                const count = eventsByDate.get(key)?.length ?? 0;
                const active = key === isoDate(cursor);
                const muted =
                  view === 'month' && day.getMonth() !== cursor.getMonth();
                return (
                  <TouchableOpacity
                    key={`${key}-${index}`}
                    onPress={() => setCursor(day)}
                    style={[
                      styles.dayCell,
                      {
                        borderColor: active
                          ? palette.primaryStrong
                          : palette.divider,
                        backgroundColor: active
                          ? palette.primarySoft
                          : palette.surface,
                        opacity: muted ? 0.45 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: active ? palette.primaryStrong : palette.text,
                        fontWeight: '900',
                      }}
                    >
                      {day.getDate()}
                    </Text>
                    {count ? (
                      <Text style={{ color: palette.subtext, fontSize: 11 }}>
                        {count} reading{count > 1 ? 's' : ''}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
            {!events.length ? (
              <View style={styles.stateBox}>
                <KISIcon name="calendar" size={24} color={palette.subtext} />
                <Text style={{ color: palette.text, fontWeight: '900' }}>
                  No readings scheduled
                </Text>
                <Text style={{ color: palette.subtext, textAlign: 'center' }}>
                  Load a Bible passage below and schedule it into your planner.
                </Text>
              </View>
            ) : null}
          </>
        )}
      </BibleSectionCard>

      <BibleSectionCard>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>
          Events for {isoDate(cursor)}
        </Text>
        {selectedDayEvents.length ? (
          <View style={styles.stack}>
            {selectedDayEvents.map(event => (
              <View
                key={event.id}
                style={[styles.eventCard, { borderColor: palette.divider }]}
              >
                <View style={styles.headerRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: palette.text, fontWeight: '900' }}>
                      {event.passage_ref}
                    </Text>
                    <Text style={{ color: palette.subtext, marginTop: 4 }}>
                      {readableDateTime(event.start_at)} · {event.recurrence}
                    </Text>
                    <Text
                      style={{
                        color: palette.primaryStrong,
                        marginTop: 4,
                        fontWeight: '800',
                      }}
                    >
                      {event.status}
                    </Text>
                    {event.sync_status === 'local_pending' ? (
                      <Text
                        style={{
                          color: palette.subtext,
                          marginTop: 4,
                          fontWeight: '800',
                        }}
                      >
                        Saved locally. It will sync when the API is available.
                      </Text>
                    ) : null}
                  </View>
                  <KISButton
                    title="Edit"
                    size="xs"
                    variant="outline"
                    onPress={() => startEdit(event)}
                  />
                </View>

                <View style={styles.refWrap}>
                  {(event.verse_refs?.length
                    ? event.verse_refs
                    : event.chapter_refs ?? []
                  ).map(ref => (
                    <View
                      key={ref}
                      style={[styles.refChip, { borderColor: palette.divider }]}
                    >
                      <Text
                        style={{
                          color: palette.primaryStrong,
                          fontWeight: '700',
                        }}
                      >
                        {ref}
                      </Text>
                    </View>
                  ))}
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.optionRow}
                >
                  {statusOptions.map(status => (
                    <KISButton
                      key={status}
                      title={status}
                      size="xs"
                      variant={
                        event.status === status ? 'secondary' : 'outline'
                      }
                      onPress={() => updateStatus(event, status)}
                    />
                  ))}
                  <KISButton
                    title="Delete"
                    size="xs"
                    variant="ghost"
                    onPress={() => deleteEvent(event)}
                  />
                </ScrollView>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: palette.subtext }}>
            No Bible readings scheduled for this day.
          </Text>
        )}
      </BibleSectionCard>

      {visibleRangeEvents.length ? (
        <BibleSectionCard>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            Upcoming in this {view}
          </Text>
          <View style={styles.stack}>
            {visibleRangeEvents.slice(0, 12).map(event => (
              <TouchableOpacity
                key={`range-${event.id}`}
                onPress={() => setCursor(startOfDay(new Date(event.start_at)))}
                style={[
                  styles.compactEventRow,
                  {
                    borderColor: palette.divider,
                    backgroundColor: palette.surface,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.text, fontWeight: '900' }}>
                    {event.passage_ref}
                  </Text>
                  <Text style={{ color: palette.subtext, marginTop: 3 }}>
                    {readableDateTime(event.start_at)} · {event.status}
                    {event.sync_status === 'local_pending' ? ' · local' : ''}
                  </Text>
                </View>
                <KISIcon
                  name="chevron-right"
                  size={18}
                  color={palette.subtext}
                />
              </TouchableOpacity>
            ))}
          </View>
        </BibleSectionCard>
      ) : null}

      <BibleSectionCard>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>
          {editingEventId ? 'Edit schedule' : 'Create from selected scripture'}
        </Text>
        {!editingEventId ? (
          <>
            <TranslationPicker
              translations={translations}
              selected={selectedTranslation}
              onSelect={setSelectedTranslation}
            />
            <View style={styles.referenceRow}>
              <TextInput
                value={reference}
                onChangeText={setReference}
                placeholder="John 3:16-18"
                placeholderTextColor={palette.subtext}
                style={[
                  styles.input,
                  { borderColor: palette.divider, color: palette.text },
                ]}
              />
              <KISButton
                title={loadingSelection ? '...' : 'Load'}
                size="xs"
                onPress={loadSelection}
              />
            </View>

            {selectionReader ? (
              <View
                style={[
                  styles.selectionBox,
                  {
                    borderColor: palette.divider,
                    backgroundColor: palette.surface,
                  },
                ]}
              >
                <View style={styles.headerRow}>
                  <Text
                    style={{ color: palette.text, fontWeight: '900', flex: 1 }}
                  >
                    {selectionReader.reference}
                  </Text>
                  <KISButton
                    title="Select chapter"
                    size="xs"
                    variant="outline"
                    onPress={selectChapter}
                  />
                </View>
                <View style={styles.stack}>
                  {selectionReader.verses.map(verse => {
                    const active = selectedVerses.has(String(verse.id));
                    return (
                      <TouchableOpacity
                        key={verse.id}
                        onPress={() => toggleVerse(verse)}
                        style={[
                          styles.verseRow,
                          {
                            borderColor: active
                              ? palette.primaryStrong
                              : palette.divider,
                            backgroundColor: active
                              ? palette.primarySoft
                              : 'transparent',
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: active
                              ? palette.primaryStrong
                              : palette.subtext,
                            fontWeight: '900',
                          }}
                        >
                          {verse.number}
                        </Text>
                        <Text
                          style={{
                            color: palette.text,
                            flex: 1,
                            lineHeight: 22,
                          }}
                        >
                          {verse.text}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : (
              <Text style={{ color: palette.subtext }}>
                Planner events must begin from a selected Bible passage, not
                free-form activity text.
              </Text>
            )}
          </>
        ) : null}

        <KISDateTimeInput
          label="Start"
          value={startAt}
          onChange={setStartAt}
          mode="datetime"
        />
        <KISDateTimeInput
          label="End (optional)"
          value={endAt || null}
          onChange={setEndAt}
          mode="datetime"
        />

        <Text style={[styles.label, { color: palette.subtext }]}>
          Recurrence
        </Text>
        <View style={styles.optionRow}>
          {recurrenceOptions.map(item => (
            <TouchableOpacity
              key={item}
              onPress={() => setRecurrence(item)}
              style={[
                styles.optionChip,
                {
                  borderColor: palette.divider,
                  backgroundColor:
                    recurrence === item ? palette.primarySoft : palette.surface,
                },
              ]}
            >
              <Text
                style={{
                  color:
                    recurrence === item ? palette.primaryStrong : palette.text,
                  fontWeight: '800',
                }}
              >
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: palette.subtext }]}>
          Reminder offsets
        </Text>
        <View style={styles.optionRow}>
          {reminderOffsetOptions.map(offset => {
            const active = reminderOffsets.includes(offset);
            const label =
              offset === 0
                ? 'At time'
                : offset >= 1440
                ? `${offset / 1440} day`
                : `${offset} min`;
            return (
              <TouchableOpacity
                key={offset}
                onPress={() => toggleOffset(offset)}
                style={[
                  styles.optionChip,
                  {
                    borderColor: palette.divider,
                    backgroundColor: active
                      ? palette.primarySoft
                      : palette.surface,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? palette.primaryStrong : palette.text,
                    fontWeight: '800',
                  }}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.label, { color: palette.subtext }]}>
          Reminder channels
        </Text>
        <View style={styles.optionRow}>
          {reminderChannelOptions.map(channel => {
            const active = reminderChannels.includes(channel);
            return (
              <TouchableOpacity
                key={channel}
                onPress={() => toggleChannel(channel)}
                style={[
                  styles.optionChip,
                  {
                    borderColor: palette.divider,
                    backgroundColor: active
                      ? palette.primarySoft
                      : palette.surface,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? palette.primaryStrong : palette.text,
                    fontWeight: '800',
                  }}
                >
                  {channel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.navRow}>
          <KISButton
            title={editingEventId ? 'Update event' : 'Create event'}
            size="sm"
            loading={saving}
            onPress={editingEventId ? updateEvent : createEvent}
          />
          {editingEventId ? (
            <KISButton
              title="Cancel"
              size="sm"
              variant="outline"
              onPress={resetForm}
            />
          ) : null}
        </View>
        {message ? (
          <Text style={{ color: palette.primaryStrong, fontWeight: '800' }}>
            {message}
          </Text>
        ) : null}
      </BibleSectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '900' },
  sectionTitle: { fontSize: 18, fontWeight: '900' },
  monthTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '900' },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  segmentRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  segment: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dayCell: {
    width: '13.45%',
    aspectRatio: 1,
    borderWidth: 2,
    borderRadius: 10,
    padding: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateBox: {
    minHeight: 130,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  eventCard: { borderWidth: 2, borderRadius: 12, padding: 12, gap: 10 },
  compactEventRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  refWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  refChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  referenceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  selectionBox: { borderWidth: 2, borderRadius: 12, padding: 12, gap: 12 },
  verseRow: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 2,
    borderRadius: 10,
    padding: 10,
  },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: {
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  label: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
});
