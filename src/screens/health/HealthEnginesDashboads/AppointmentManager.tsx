import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
  useColorScheme,
} from 'react-native';
import KISButton from '@/constants/KISButton';
import {
  createInstitutionEngineManagedItem,
  deleteInstitutionEngineManagedItem,
  fetchInstitutionEngineManagedItems,
  kiscToMicro,
  microToKisc,
  updateInstitutionEngineManagedItem,
} from '@/services/healthOpsEngineManagerService';
import { getHealthThemeColors } from '@/theme/health/colors';
import { HEALTH_THEME_SPACING } from '@/theme/health/spacing';
import { HEALTH_THEME_TYPOGRAPHY } from '@/theme/health/typography';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

type Props = {
  institutionId: string;
  engineKey: string;
};

type AppointmentType = {
  id: string;
  name: string;
  duration: number;
  price: number;
  buffer: number;
  enabled: boolean;
  sortOrder: number;
};

type Slot = {
  id: string;
  time: string;
  available: boolean;
};

const toKiscLabel = (value: number) => Number(value || 0).toFixed(3).replace(/\.?0+$/, '');

export default function AppointmentManager({ institutionId, engineKey }: Props) {
  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === 'light' ? 'light' : 'dark');
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [typeName, setTypeName] = useState('');
  const [duration, setDuration] = useState('');
  const [price, setPrice] = useState('');
  const [buffer, setBuffer] = useState('');
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);

  const [startHour, setStartHour] = useState('09');
  const [endHour, setEndHour] = useState('17');

  const loadTypes = useCallback(async () => {
    if (!institutionId || !engineKey) return;
    setLoading(true);
    try {
      const response = await fetchInstitutionEngineManagedItems(institutionId, engineKey, {
        itemKind: 'appointment_type',
        rootOnly: true,
        includeInactive: true,
      });
      if (!response?.success) {
        throw new Error(response?.message || 'Unable to load appointment types.');
      }
      const rows = Array.isArray(response?.data?.results) ? response.data.results : [];
      const mapped: AppointmentType[] = rows.map((row: any, index: number) => ({
        id: String(row?.id || `type-${index + 1}`),
        name: String(row?.name || '').trim() || `Type ${index + 1}`,
        duration: Math.max(1, Number(row?.quantity || 0) || 1),
        price: microToKisc(Number(row?.amount_micro || 0)),
        buffer: Math.max(0, Number(row?.value_int || 0) || 0),
        enabled: String(row?.status || '').trim().toLowerCase() !== 'disabled',
        sortOrder: Number.isFinite(Number(row?.sort_order)) ? Number(row.sort_order) : index + 1,
      }));
      setTypes(mapped.sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (error: any) {
      Alert.alert('Appointment engine', error?.message || 'Unable to load appointment types.');
    } finally {
      setLoading(false);
    }
  }, [engineKey, institutionId]);

  useEffect(() => {
    loadTypes().catch(() => undefined);
  }, [loadTypes]);

  const resetForm = useCallback(() => {
    setTypeName('');
    setDuration('');
    setPrice('');
    setBuffer('');
    setEditingTypeId(null);
  }, []);

  const createOrUpdateType = useCallback(async () => {
    const cleanName = typeName.trim();
    const durationValue = Math.max(1, Math.floor(Number(duration || 0)));
    const priceValue = Number(price || 0);
    const bufferValue = Math.max(0, Math.floor(Number(buffer || 0)));
    if (!cleanName || !Number.isFinite(priceValue) || priceValue < 0) {
      Alert.alert('Appointment type', 'Provide type name, duration, and valid price.');
      return;
    }

    setSaving(true);
    try {
      if (!editingTypeId) {
        const response = await createInstitutionEngineManagedItem(institutionId, engineKey, {
          item_kind: 'appointment_type',
          name: cleanName,
          quantity: durationValue,
          value_int: bufferValue,
          amount_micro: kiscToMicro(priceValue),
          status: 'enabled',
        });
        if (!response?.success) {
          throw new Error(response?.message || 'Unable to create appointment type.');
        }
      } else {
        const response = await updateInstitutionEngineManagedItem(institutionId, engineKey, editingTypeId, {
          name: cleanName,
          quantity: durationValue,
          value_int: bufferValue,
          amount_micro: kiscToMicro(priceValue),
        });
        if (!response?.success) {
          throw new Error(response?.message || 'Unable to update appointment type.');
        }
      }
      resetForm();
      await loadTypes();
    } catch (error: any) {
      Alert.alert('Appointment type', error?.message || 'Unable to save appointment type.');
    } finally {
      setSaving(false);
    }
  }, [buffer, duration, editingTypeId, engineKey, institutionId, loadTypes, price, resetForm, typeName]);

  const startEditingType = useCallback((row: AppointmentType) => {
    setEditingTypeId(row.id);
    setTypeName(row.name);
    setDuration(String(row.duration));
    setPrice(toKiscLabel(row.price));
    setBuffer(String(row.buffer));
  }, []);

  const removeType = useCallback((id: string) => {
    Alert.alert('Delete appointment type', 'This will remove the appointment type. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setSaving(true);
          deleteInstitutionEngineManagedItem(institutionId, engineKey, id)
            .then((response: any) => {
              if (!response?.success) {
                throw new Error(response?.message || 'Unable to delete appointment type.');
              }
              if (editingTypeId === id) {
                resetForm();
              }
              return loadTypes();
            })
            .catch((error: any) => {
              Alert.alert('Appointment type', error?.message || 'Unable to delete appointment type.');
            })
            .finally(() => setSaving(false));
        },
      },
    ]);
  }, [editingTypeId, engineKey, institutionId, loadTypes, resetForm]);

  const toggleType = useCallback(async (id: string) => {
    const row = types.find((item) => item.id === id);
    if (!row) return;
    const response = await updateInstitutionEngineManagedItem(institutionId, engineKey, id, {
      status: row.enabled ? 'disabled' : 'enabled',
    });
    if (!response?.success) {
      Alert.alert('Appointment type', response?.message || 'Unable to update type status.');
      return;
    }
    setTypes((prev) => prev.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item)));
  }, [engineKey, institutionId, types]);

  const generateSlots = useCallback(() => {
    const activeType = types.find((item) => item.enabled);
    if (!activeType) {
      Alert.alert('Appointment slots', 'Enable at least one appointment type.');
      return;
    }
    const start = Number(startHour);
    const end = Number(endHour);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      Alert.alert('Appointment slots', 'Invalid schedule window.');
      return;
    }
    const generated: Slot[] = [];
    let currentMinutes = start * 60;
    while (currentMinutes < end * 60) {
      const hours = Math.floor(currentMinutes / 60);
      const minutes = currentMinutes % 60;
      const label = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      generated.push({ id: `${Date.now()}-${label}`, time: label, available: true });
      currentMinutes += activeType.duration + activeType.buffer;
    }
    setSlots(generated);
  }, [endHour, startHour, types]);

  const toggleSlot = useCallback((id: string) => {
    LayoutAnimation.easeInEaseOut();
    setSlots((prev) => prev.map((slot) => (slot.id === id ? { ...slot, available: !slot.available } : slot)));
  }, []);

  const totalPotentialRevenue = useMemo(() => {
    const active = types.find((item) => item.enabled);
    return slots.filter((slot) => slot.available).length * Number(active?.price || 0);
  }, [slots, types]);

  return (
    <ScrollView style={{ padding: spacing.md }}>
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>
          {editingTypeId ? 'Edit Appointment Type' : 'Appointment Type'}
        </Text>

        <TextInput
          placeholder="Type Name (e.g General Consultation)"
          placeholderTextColor={palette.subtext}
          value={typeName}
          onChangeText={setTypeName}
          style={input(palette, spacing)}
        />
        <TextInput
          placeholder="Duration (minutes)"
          keyboardType="numeric"
          value={duration}
          onChangeText={setDuration}
          style={input(palette, spacing)}
        />
        <TextInput
          placeholder="Price (KISC)"
          keyboardType="numeric"
          value={price}
          onChangeText={setPrice}
          style={input(palette, spacing)}
        />
        <TextInput
          placeholder="Buffer Between Sessions (minutes)"
          keyboardType="numeric"
          value={buffer}
          onChangeText={setBuffer}
          style={input(palette, spacing)}
        />

        <View style={{ gap: spacing.xs }}>
          <KISButton
            title={saving ? 'Saving...' : editingTypeId ? 'Update Type' : 'Create Type'}
            onPress={() => {
              createOrUpdateType().catch(() => undefined);
            }}
            disabled={saving}
          />
          {editingTypeId ? (
            <KISButton title="Cancel Edit" variant="outline" onPress={resetForm} disabled={saving} />
          ) : null}
          <KISButton
            title={loading ? 'Refreshing...' : 'Reload Types'}
            variant="outline"
            onPress={() => {
              loadTypes().catch(() => undefined);
            }}
            disabled={loading || saving}
          />
        </View>
      </View>

      {loading ? (
        <View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={palette.primary} />
          <Text style={{ color: palette.subtext, marginTop: spacing.xs }}>Loading appointment types...</Text>
        </View>
      ) : null}

      {types.map((type) => (
        <View key={type.id} style={card(palette, spacing)}>
          <Text style={{ ...typography.h3, color: palette.text }}>{type.name}</Text>
          <Text style={{ color: palette.text }}>
            {type.duration} mins • {toKiscLabel(type.price)} KISC
          </Text>

          <View style={{ marginTop: spacing.xs, gap: spacing.xs }}>
            <KISButton
              title={type.enabled ? 'Disable' : 'Enable'}
              onPress={() => {
                toggleType(type.id).catch(() => undefined);
              }}
              variant="outline"
            />
            <KISButton title="Edit Type" variant="outline" onPress={() => startEditingType(type)} />
            <KISButton title="Delete Type" variant="outline" onPress={() => removeType(type.id)} />
          </View>
        </View>
      ))}

      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Doctor Schedule</Text>

        <TextInput placeholder="Start Hour (24h format)" value={startHour} onChangeText={setStartHour} style={input(palette, spacing)} />
        <TextInput placeholder="End Hour (24h format)" value={endHour} onChangeText={setEndHour} style={input(palette, spacing)} />

        <KISButton title="Generate Slots" onPress={generateSlots} />
      </View>

      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Time Slots</Text>
        {slots.map((slot) => (
          <TouchableOpacity
            key={slot.id}
            onPress={() => toggleSlot(slot.id)}
            style={{
              padding: spacing.sm,
              borderRadius: 10,
              marginVertical: spacing.xs,
              backgroundColor: slot.available ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)',
            }}
          >
            <Text style={{ color: palette.text }}>
              {slot.time} — {slot.available ? 'Available' : 'Blocked'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Analytics</Text>
        <Text style={{ color: palette.text }}>Available Slots: {slots.filter((slot) => slot.available).length}</Text>
        <Text style={{ color: palette.text }}>Potential Revenue: {toKiscLabel(totalPotentialRevenue)} KISC</Text>
      </View>
    </ScrollView>
  );
}

const card = (palette: any, spacing: any) => ({
  backgroundColor: palette.surface,
  padding: spacing.md,
  borderRadius: 16,
  marginBottom: spacing.lg,
});

const input = (palette: any, spacing: any) => ({
  borderWidth: 1,
  borderColor: palette.divider,
  padding: spacing.sm,
  borderRadius: 12,
  marginVertical: spacing.xs,
  color: palette.text,
});
