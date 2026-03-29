
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Switch,
} from "react-native";
import { useKISTheme } from "@/theme/useTheme";
import KISTextInput from "@/constants/KISTextInput";
import {
  DayAvailability,
  formatDateKey,
  getDayKey,
  normalizeDayAvailability,
  normalizeTimeToken,
  ServiceAvailability,
} from "@/screens/market/availabilityUtils";

const VIEW_MODES = ["year", "month", "week", "day"] as const;
type ViewMode = typeof VIEW_MODES[number];

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const getWeekDates = (reference: Date) => {
  const copy = new Date(reference);
  const weekday = copy.getDay();
  const diff = (weekday + 6) % 7;
  copy.setDate(copy.getDate() - diff);
  const result: Date[] = [];
  for (let index = 0; index < 7; index += 1) {
    const next = new Date(copy);
    next.setDate(copy.getDate() + index);
    result.push(next);
  }
  return result;
};

const getMonthGrid = (reference: Date) => {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;
  const grid: Array<Date | null> = [];
  for (let index = 0; index < startOffset; index += 1) grid.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    grid.push(new Date(year, month, day));
  }
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
};

const formatDateLabel = (value: Date) =>
  value.toLocaleString(undefined, { weekday: "long", month: "short", day: "numeric" });

const AvailabilityScheduler = ({
  value,
  onChange,
}: {
  value: ServiceAvailability;
  onChange: (next: ServiceAvailability) => void;
}) => {
  const { palette } = useKISTheme();
  const [viewMode, setViewMode] = useState<ViewMode>("year");
  const [referenceDate, setReferenceDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [timeInput, setTimeInput] = useState("");

  const handleUpdate = (updater: (current: ServiceAvailability) => ServiceAvailability) => {
    onChange(updater(value));
  };

  useEffect(() => {
    if (value.date_range?.start_date) {
      const parts = value.date_range.start_date.split("-").map((item) => Number(item));
      if (parts.length === 3 && parts.every((segment) => Number.isFinite(segment))) {
        const parsed = new Date(parts[0], parts[1] - 1, parts[2]);
        if (!Number.isNaN(parsed.getTime())) {
          setReferenceDate(parsed);
          setSelectedDate(parsed);
        }
      }
    }
  }, [value.date_range]);

  const getDateAvailability = (date: Date): DayAvailability => {
    const key = formatDateKey(date);
    return value.specific_dates[key] ?? value.days[getDayKey(date)];
  };

  const updateDateAvailability = (date: Date, patch: Partial<DayAvailability>) => {
    const dateKey = formatDateKey(date);
    const weekday = getDayKey(date);
    const base = value.specific_dates[dateKey] ?? value.days[weekday];
    const merged: Partial<DayAvailability> = { ...base, ...patch };
    if (patch.all_day) {
      merged.times = [];
    }
    const normalized = normalizeDayAvailability(merged);
    handleUpdate((current) => ({
      ...current,
      specific_dates: { ...current.specific_dates, [dateKey]: normalized },
    }));
  };

  const toggleDayEnabled = (date: Date) => {
    const entry = getDateAvailability(date);
    updateDateAvailability(date, { enabled: !entry.enabled });
  };

  const applyDaySelection = (dates: Date[], enabled: boolean) => {
    handleUpdate((current) => {
      const nextSpecific = { ...current.specific_dates };
      dates.forEach((date) => {
        const key = formatDateKey(date);
        const base = nextSpecific[key] ?? current.days[getDayKey(date)];
        nextSpecific[key] = normalizeDayAvailability({ ...base, enabled });
      });
      return { ...current, specific_dates: nextSpecific };
    });
  };

  const handleAddTime = () => {
    if (!selectedDate) return;
    const normalized = normalizeTimeToken(timeInput);
    if (!normalized) return;
    const entry = getDateAvailability(selectedDate);
    if (entry.times.includes(normalized)) {
      setTimeInput("");
      return;
    }
    updateDateAvailability(selectedDate, {
      all_day: false,
      times: [...entry.times, normalized],
    });
    setTimeInput("");
  };

  const handleRemoveTime = (time: string) => {
    if (!selectedDate) return;
    const entry = getDateAvailability(selectedDate);
    const remaining = entry.times.filter((slot) => slot !== time);
    updateDateAvailability(selectedDate, {
      times: remaining,
      all_day: remaining.length === 0 ? true : entry.all_day,
    });
  };

  const monthLabel = `${MONTH_LABELS[referenceDate.getMonth()]} ${referenceDate.getFullYear()}`;
  const setMonthRange = (date: Date) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    handleUpdate((current) => ({
      ...current,
      date_range: {
        start_date: formatDateKey(start),
        end_date: formatDateKey(end),
      },
    }));
  };

  const changeMonth = (offset: number) => {
    const next = new Date(referenceDate);
    next.setMonth(next.getMonth() + offset);
    setReferenceDate(next);
    const start = new Date(next.getFullYear(), next.getMonth(), 1);
    setSelectedDate(start);
    setMonthRange(next);
  };

  const renderMonthView = () => {
    const grid = getMonthGrid(referenceDate);
    return (
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Pressable onPress={() => changeMonth(-1)}>
            <Text style={{ color: palette.primary }}>Prev</Text>
          </Pressable>
          <Text style={{ color: palette.text, fontWeight: "600" }}>{monthLabel}</Text>
          <Pressable onPress={() => changeMonth(1)}>
            <Text style={{ color: palette.primary }}>Next</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
          <Pressable onPress={() => applyDaySelection(grid.filter(Boolean) as Date[], true)}>
            <Text style={{ color: palette.primary }}>Select all days</Text>
          </Pressable>
          <Pressable onPress={() => applyDaySelection(grid.filter(Boolean) as Date[], false)}>
            <Text style={{ color: palette.primary }}>Unselect all</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
          {WEEKDAY_LABELS.map((label) => (
            <Text key={label} style={{ width: 40, color: palette.subtext, fontSize: 11, textAlign: "center" }}>
              {label}
            </Text>
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {grid.map((date, index) => {
            if (!date) {
              return <View key={`placeholder-${index}`} style={{ width: 40, height: 48 }} />;
            }
            const entry = getDateAvailability(date);
            const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
            return (
              <Pressable
                key={formatDateKey(date)}
                onPress={() => setSelectedDate(date)}
                style={{
                  width: 40,
                  height: 48,
                  borderRadius: 12,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? palette.primary : palette.divider,
                  backgroundColor: entry.enabled ? palette.surface : palette.divider,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: entry.enabled ? palette.text : palette.subtext }}>{date.getDate()}</Text>
                <Switch
                  value={entry.enabled}
                  onValueChange={() => toggleDayEnabled(date)}
                  style={{ marginTop: 2 }}
                  trackColor={{ true: palette.primarySoft, false: palette.dropzone }}
                  thumbColor={entry.enabled ? palette.primary : palette.surface}
                />
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  const renderWeekView = () => {
    const weekDates = getWeekDates(referenceDate);
    return (
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {weekDates.map((date) => {
            const entry = getDateAvailability(date);
            const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
            return (
              <Pressable
                key={formatDateKey(date)}
                onPress={() => setSelectedDate(date)}
                style={{
                  flex: 1,
                  padding: 8,
                  borderRadius: 12,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? palette.primary : palette.divider,
                  backgroundColor: entry.enabled ? palette.surface : palette.divider,
                }}
              >
                <Text style={{ color: entry.enabled ? palette.text : palette.subtext, fontSize: 12, fontWeight: "600" }}>
                  {date.toLocaleDateString(undefined, { weekday: "short" })}
                </Text>
                <Text style={{ color: palette.subtext, fontSize: 11 }}>
                  {entry.enabled ? (entry.all_day ? "All day" : `${entry.times.length} slots`) : "Disabled"}
                </Text>
                <Switch
                  value={entry.enabled}
                  onValueChange={() => toggleDayEnabled(date)}
                  trackColor={{ true: palette.primarySoft, false: palette.dropzone }}
                  thumbColor={entry.enabled ? palette.primary : palette.surface}
                />
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  const renderYearView = () => {
    const activeMonthIndex = value.date_range?.start_date
      ? new Date(value.date_range.start_date).getMonth()
      : referenceDate.getMonth();
    const yearLabel = referenceDate.getFullYear();
    return (
      <View style={{ gap: 8 }}>
        <Text style={{ color: palette.subtext, fontSize: 12 }}>Year {yearLabel}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {MONTH_LABELS.map((label, index) => {
            const isActive = index === activeMonthIndex;
            return (
              <Pressable
                key={label}
                onPress={() => {
                  const updated = new Date(referenceDate);
                  updated.setMonth(index);
                  updated.setDate(1);
                  setReferenceDate(updated);
                  setSelectedDate(updated);
                  setMonthRange(updated);
                  setViewMode("month");
                }}
                style={{
                  width: "23%",
                  borderRadius: 12,
                  padding: 10,
                  borderWidth: 1,
                  borderColor: isActive ? palette.primary : palette.divider,
                  alignItems: "center",
                  backgroundColor: isActive ? `${palette.primary}22` : palette.surface,
                }}
              >
                <Text style={{ color: palette.text }}>{label.slice(0, 3)}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  const renderDayView = () => {
    if (!selectedDate) return null;
    const entry = getDateAvailability(selectedDate);
    return (
      <View style={{ padding: 8 }}>
        <Text style={{ color: palette.subtext, fontSize: 11 }}>Day view</Text>
        <Text style={{ color: palette.text, fontSize: 16, fontWeight: "700" }}>{formatDateLabel(selectedDate)}</Text>
        <Text style={{ color: palette.text, marginTop: 4 }}>
          {entry.enabled ? (entry.all_day ? "Available all day" : `${entry.times.length} custom slots`) : "Not available"}
        </Text>
      </View>
    );
  };

  const renderView = () => {
    switch (viewMode) {
      case "year":
        return renderYearView();
      case "month":
        return renderMonthView();
      case "week":
        return renderWeekView();
      case "day":
        return renderDayView();
      default:
        return null;
    }
  };

  const selectedEntry = selectedDate ? getDateAvailability(selectedDate) : null;

  return (
    <View style={{ gap: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {VIEW_MODES.map((mode) => {
            const active = viewMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => setViewMode(mode)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: active ? palette.primary : palette.divider,
                  backgroundColor: active ? `${palette.primary}22` : palette.surface,
                }}
              >
                <Text style={{ color: active ? palette.primaryStrong : palette.text, fontSize: 13 }}>{mode.toUpperCase()}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View
        style={{
          borderWidth: 1,
          borderColor: palette.divider,
          borderRadius: 16,
          padding: 12,
          backgroundColor: palette.surfaceElevated,
        }}
      >
        {renderView()}
      </View>

      <View
        style={{
          borderWidth: 1,
          borderColor: palette.divider,
          borderRadius: 16,
          padding: 12,
          backgroundColor: palette.surface,
        }}
      >
        <Text style={{ color: palette.subtext, fontSize: 11 }}>Slot duration</Text>
        <Text style={{ color: palette.text, fontWeight: "700", marginBottom: 6 }}>{value.slot_duration_minutes} minutes</Text>
        <KISTextInput
          label="Slot duration (minutes)"
          value={String(value.slot_duration_minutes)}
          onChangeText={(text) => {
            const minuteValue = Number(text.replace(/[^0-9]/g, "")) || 0;
            const normalized = Math.max(5, Math.min(180, minuteValue));
            handleUpdate((current) => ({ ...current, slot_duration_minutes: normalized }));
          }}
          keyboardType="numeric"
        />
      </View>

      {selectedEntry && (
        <View
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: palette.divider,
            padding: 12,
            backgroundColor: palette.surfaceElevated,
          }}
        >
          <Text style={{ color: palette.text, fontWeight: "700", fontSize: 15 }}>Selected day settings</Text>
          <Text style={{ color: palette.subtext, fontSize: 12, marginBottom: 6 }}>{formatDateLabel(selectedDate)}</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            {["All Day", "Specific times"].map((option) => {
              const isAllDay = option === "All Day";
              const active = isAllDay ? selectedEntry.all_day : !selectedEntry.all_day;
              return (
                <Pressable
                  key={option}
                  onPress={() => updateDateAvailability(selectedDate, { all_day: isAllDay })}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: active ? palette.primary : palette.divider,
                    backgroundColor: active ? `${palette.primary}22` : palette.surface,
                  }}
                >
                  <Text style={{ color: active ? palette.primaryStrong : palette.text }}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
          {!selectedEntry.all_day && (
            <View style={{ gap: 6 }}>
              <Text style={{ color: palette.subtext, fontSize: 12 }}>Defined slots</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {selectedEntry.times.length === 0 && <Text style={{ color: palette.subtext }}>No custom times yet.</Text>}
                {selectedEntry.times.map((slot) => (
                  <Pressable
                    key={slot}
                    onPress={() => handleRemoveTime(slot)}
                    style={{
                      borderWidth: 1,
                      borderColor: palette.divider,
                      borderRadius: 999,
                      paddingVertical: 4,
                      paddingHorizontal: 10,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Text style={{ color: palette.text }}>{slot}</Text>
                    <Text style={{ color: palette.primary }}>×</Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <KISTextInput
                  label="Add slot"
                  value={timeInput}
                  onChangeText={setTimeInput}
                  placeholder="HH:MM"
                  keyboardType="numeric"
                  style={{ flex: 1 }}
                />
                <Pressable
                  onPress={handleAddTime}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 14,
                    backgroundColor: palette.primary,
                  }}
                >
                  <Text style={{ color: "#fff" }}>Add</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export default AvailabilityScheduler;
