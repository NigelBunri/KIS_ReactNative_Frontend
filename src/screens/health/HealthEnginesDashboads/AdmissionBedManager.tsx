import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { launchImageLibrary } from 'react-native-image-picker';
import KISButton from '@/constants/KISButton';
import { KISIcon } from '@/constants/kisIcons';
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

type Bed = {
  id: string;
  name: string;
  available: boolean;
  sortOrder: number;
};

type Room = {
  id: string;
  name: string;
  priceKisc: number;
  image?: string;
  beds: Bed[];
  expanded?: boolean;
  sortOrder: number;
};

const toKiscLabel = (value?: number | null) => {
  if (!Number.isFinite(Number(value))) return '0';
  return Number(value).toFixed(3).replace(/\.?0+$/, '');
};

const toSafeCount = (rawValue: string, fallback = 0) => {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
};

export default function AdmissionBedManager({ institutionId, engineKey }: Props) {
  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === 'light' ? 'light' : 'dark');
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [roomName, setRoomName] = useState('');
  const [price, setPrice] = useState('');
  const [bedCount, setBedCount] = useState('');
  const [image, setImage] = useState<string | undefined>();
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    if (!institutionId || !engineKey) return;
    setLoading(true);
    try {
      const [roomRes, bedRes] = await Promise.all([
        fetchInstitutionEngineManagedItems(institutionId, engineKey, {
          itemKind: 'room',
          rootOnly: true,
          includeInactive: true,
        }),
        fetchInstitutionEngineManagedItems(institutionId, engineKey, {
          itemKind: 'bed',
          includeInactive: true,
        }),
      ]);

      if (!roomRes?.success) {
        throw new Error(roomRes?.message || 'Unable to load rooms.');
      }

      const roomRows = Array.isArray(roomRes?.data?.results) ? roomRes.data.results : [];
      const bedRows = Array.isArray(bedRes?.data?.results) ? bedRes.data.results : [];

      const bedsByRoom = new Map<string, Bed[]>();
      bedRows.forEach((row: any, index: number) => {
        const parentId = String(row?.parent || '').trim();
        if (!parentId) return;
        const nextBed: Bed = {
          id: String(row?.id || `bed-${index}`),
          name: String(row?.name || '').trim() || `Bed ${index + 1}`,
          available: String(row?.status || '').trim().toLowerCase() !== 'occupied',
          sortOrder: Number.isFinite(Number(row?.sort_order)) ? Number(row.sort_order) : index + 1,
        };
        const list = bedsByRoom.get(parentId) || [];
        list.push(nextBed);
        bedsByRoom.set(parentId, list);
      });

      const mappedRooms = roomRows
        .map((row: any, index: number) => {
          const roomId = String(row?.id || '').trim();
          if (!roomId) return null;
          const mappedBeds = (bedsByRoom.get(roomId) || []).sort((a, b) => a.sortOrder - b.sortOrder);
          return {
            id: roomId,
            name: String(row?.name || '').trim() || `Room ${index + 1}`,
            priceKisc: microToKisc(Number(row?.amount_micro || 0)),
            image: String(row?.image_url || '').trim() || undefined,
            beds: mappedBeds,
            expanded: false,
            sortOrder: Number.isFinite(Number(row?.sort_order)) ? Number(row.sort_order) : index + 1,
          } as Room;
        })
        .filter(Boolean) as Room[];

      setRooms((prev) => {
        const prevExpanded = new Map<string, boolean>();
        prev.forEach((room) => prevExpanded.set(room.id, !!room.expanded));
        return mappedRooms
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((room) => ({ ...room, expanded: prevExpanded.get(room.id) || false }));
      });
    } catch (error: any) {
      Alert.alert('Admission & bed', error?.message || 'Unable to load room management data.');
    } finally {
      setLoading(false);
    }
  }, [engineKey, institutionId]);

  useEffect(() => {
    loadRooms().catch(() => undefined);
  }, [loadRooms]);

  const resetForm = useCallback(() => {
    setRoomName('');
    setPrice('');
    setBedCount('');
    setImage(undefined);
    setEditingRoomId(null);
  }, []);

  const handleSelectImage = useCallback(async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: 1,
    });
    if (result.didCancel) return;
    if (result.errorCode) {
      Alert.alert('Image Error', result.errorMessage || 'Unable to load selected image.');
      return;
    }
    const uri = result.assets?.[0]?.uri;
    if (uri) setImage(uri);
  }, []);

  const createOrUpdateRoom = useCallback(async () => {
    const name = roomName.trim();
    const priceKisc = Number(price);
    const desiredBedCount = toSafeCount(bedCount, 0);

    if (!name || !Number.isFinite(priceKisc) || priceKisc < 0 || desiredBedCount <= 0) {
      Alert.alert('Missing Fields', 'Provide room name, valid price, and at least one bed.');
      return;
    }

    setSaving(true);
    try {
      if (!editingRoomId) {
        const createdRoomRes = await createInstitutionEngineManagedItem(institutionId, engineKey, {
          item_kind: 'room',
          name,
          amount_micro: kiscToMicro(priceKisc),
          quantity: desiredBedCount,
          image_url: image || null,
          status: 'active',
        });
        if (!createdRoomRes?.success) {
          throw new Error(createdRoomRes?.message || 'Unable to create room.');
        }
        const createdRoomId = String(createdRoomRes?.data?.item?.id || '').trim();
        if (createdRoomId) {
          const createBeds = Array.from({ length: desiredBedCount }).map((_, index) =>
            createInstitutionEngineManagedItem(institutionId, engineKey, {
              item_kind: 'bed',
              parent: createdRoomId,
              name: `Bed ${index + 1}`,
              status: 'available',
              sort_order: index + 1,
            }),
          );
          await Promise.all(createBeds);
        }
      } else {
        const currentRoom = rooms.find((room) => room.id === editingRoomId);
        const previousBeds = [...(currentRoom?.beds || [])].sort((a, b) => a.sortOrder - b.sortOrder);
        const currentBedCount = previousBeds.length;

        const updateRoomRes = await updateInstitutionEngineManagedItem(
          institutionId,
          engineKey,
          editingRoomId,
          {
            name,
            amount_micro: kiscToMicro(priceKisc),
            quantity: desiredBedCount,
            image_url: image || null,
          },
        );
        if (!updateRoomRes?.success) {
          throw new Error(updateRoomRes?.message || 'Unable to update room.');
        }

        if (desiredBedCount > currentBedCount) {
          const additions = Array.from({ length: desiredBedCount - currentBedCount }).map((_, index) =>
            createInstitutionEngineManagedItem(institutionId, engineKey, {
              item_kind: 'bed',
              parent: editingRoomId,
              name: `Bed ${currentBedCount + index + 1}`,
              status: 'available',
              sort_order: currentBedCount + index + 1,
            }),
          );
          await Promise.all(additions);
        } else if (desiredBedCount < currentBedCount) {
          const overflow = [...previousBeds]
            .sort((a, b) => b.sortOrder - a.sortOrder)
            .slice(0, currentBedCount - desiredBedCount);
          await Promise.all(
            overflow.map((bed) =>
              deleteInstitutionEngineManagedItem(institutionId, engineKey, bed.id),
            ),
          );
        }
      }

      resetForm();
      await loadRooms();
    } catch (error: any) {
      Alert.alert('Admission & bed', error?.message || 'Unable to save room changes.');
    } finally {
      setSaving(false);
    }
  }, [bedCount, editingRoomId, engineKey, image, institutionId, loadRooms, price, resetForm, roomName, rooms]);

  const startEditingRoom = useCallback((roomId: string) => {
    const room = rooms.find((row) => row.id === roomId);
    if (!room) return;
    setEditingRoomId(room.id);
    setRoomName(room.name);
    setPrice(toKiscLabel(room.priceKisc));
    setBedCount(String(room.beds.length || 0));
    setImage(room.image);
  }, [rooms]);

  const deleteRoom = useCallback((roomId: string) => {
    Alert.alert(
      'Delete room',
      'This will remove the room and all of its beds. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setSaving(true);
            deleteInstitutionEngineManagedItem(institutionId, engineKey, roomId)
              .then((res: any) => {
                if (!res?.success) {
                  throw new Error(res?.message || 'Unable to delete room.');
                }
                if (editingRoomId === roomId) resetForm();
                return loadRooms();
              })
              .catch((error: any) => {
                Alert.alert('Admission & bed', error?.message || 'Unable to delete room.');
              })
              .finally(() => setSaving(false));
          },
        },
      ],
    );
  }, [editingRoomId, engineKey, institutionId, loadRooms, resetForm]);

  const toggleExpand = useCallback((roomId: string) => {
    LayoutAnimation.easeInEaseOut();
    setRooms((prev) => prev.map((room) => (room.id === roomId ? { ...room, expanded: !room.expanded } : room)));
  }, []);

  const toggleBedAvailability = useCallback(async (roomId: string, bedId: string) => {
    const targetRoom = rooms.find((room) => room.id === roomId);
    const bed = targetRoom?.beds.find((row) => row.id === bedId);
    if (!bed) return;
    const nextStatus = bed.available ? 'occupied' : 'available';
    const response = await updateInstitutionEngineManagedItem(institutionId, engineKey, bedId, {
      status: nextStatus,
    });
    if (!response?.success) {
      Alert.alert('Admission & bed', response?.message || 'Unable to update bed status.');
      return;
    }
    setRooms((prev) =>
      prev.map((room) =>
        room.id !== roomId
          ? room
          : {
              ...room,
              beds: room.beds.map((row) =>
                row.id === bedId ? { ...row, available: !row.available } : row,
              ),
            },
      ),
    );
  }, [engineKey, institutionId, rooms]);

  const changeLocalBedName = useCallback((roomId: string, bedId: string, newName: string) => {
    setRooms((prev) =>
      prev.map((room) =>
        room.id !== roomId
          ? room
          : {
              ...room,
              beds: room.beds.map((bed) => (bed.id === bedId ? { ...bed, name: newName } : bed)),
            },
      ),
    );
  }, []);

  const persistBedName = useCallback(async (bedId: string, nameValue: string) => {
    const trimmedName = String(nameValue || '').trim();
    if (!trimmedName) return;
    const response = await updateInstitutionEngineManagedItem(institutionId, engineKey, bedId, {
      name: trimmedName,
    });
    if (!response?.success) {
      Alert.alert('Admission & bed', response?.message || 'Unable to rename bed.');
    }
  }, [engineKey, institutionId]);

  return (
    <ScrollView style={{ padding: spacing.md }}>
      <View
        style={{
          padding: spacing.md,
          borderRadius: 16,
          backgroundColor: palette.surface,
          marginBottom: spacing.lg,
        }}
      >
        <Text style={{ ...typography.h2, color: palette.text }}>
          {editingRoomId ? 'Edit Room' : 'Create Room'}
        </Text>

        <TextInput
          placeholder="Room Name"
          placeholderTextColor={palette.subtext}
          value={roomName}
          onChangeText={setRoomName}
          style={inputStyle(palette, spacing)}
        />

        <TextInput
          placeholder="Price per Night (KISC)"
          placeholderTextColor={palette.subtext}
          keyboardType="numeric"
          value={price}
          onChangeText={setPrice}
          style={inputStyle(palette, spacing)}
        />

        <TextInput
          placeholder="Number of Beds"
          placeholderTextColor={palette.subtext}
          keyboardType="numeric"
          value={bedCount}
          onChangeText={setBedCount}
          style={inputStyle(palette, spacing)}
        />

        <KISButton variant="outline" title="Select Room Image" onPress={handleSelectImage} disabled={saving} />

        {image ? (
          <Image
            source={{ uri: image }}
            style={{
              height: 160,
              borderRadius: 14,
              marginVertical: spacing.sm,
            }}
            resizeMode="cover"
          />
        ) : null}

        <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
          <KISButton
            title={saving ? 'Saving...' : editingRoomId ? 'Update Room' : 'Create Room'}
            onPress={() => {
              createOrUpdateRoom().catch(() => undefined);
            }}
            disabled={saving}
          />
          {editingRoomId ? (
            <KISButton title="Cancel Edit" variant="outline" onPress={resetForm} disabled={saving} />
          ) : null}
          <KISButton
            title={loading ? 'Refreshing...' : 'Reload Rooms'}
            variant="outline"
            onPress={() => {
              loadRooms().catch(() => undefined);
            }}
            disabled={loading || saving}
          />
        </View>
      </View>

      <Text style={{ ...typography.h2, color: palette.text }}>Room Management</Text>

      {loading ? (
        <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={palette.primary} />
          <Text style={{ marginTop: spacing.xs, color: palette.subtext }}>Loading rooms...</Text>
        </View>
      ) : null}

      {rooms.map((room) => {
        const availableBeds = room.beds.filter((bed) => bed.available).length;
        const roomAvailable = availableBeds > 0;
        return (
          <View
            key={room.id}
            style={{
              backgroundColor: palette.surface,
              borderRadius: 16,
              padding: spacing.md,
              marginVertical: spacing.sm,
            }}
          >
            <TouchableOpacity onPress={() => toggleExpand(room.id)}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ ...typography.h3, color: palette.text, flex: 1, marginRight: spacing.sm }}>
                  {room.name}
                </Text>
                <KISIcon
                  name="chevron-down"
                  size={20}
                  color={palette.primary}
                  style={{
                    transform: [{ rotate: room.expanded ? '180deg' : '0deg' }],
                  }}
                />
              </View>
              <Text style={{ color: palette.text }}>{toKiscLabel(room.priceKisc)} KISC / Night</Text>
              <Text
                style={{
                  fontWeight: '600',
                  color: roomAvailable ? '#16a34a' : '#dc2626',
                }}
              >
                {roomAvailable ? `${availableBeds} Beds Available` : 'Fully Occupied'}
              </Text>
              <Text style={{ color: palette.subtext, marginTop: spacing.xs }}>
                {room.expanded ? 'Tap to hide beds' : 'Tap to view beds'}
              </Text>
            </TouchableOpacity>

            <View style={{ marginTop: spacing.sm, flexDirection: 'row', gap: spacing.xs }}>
              <View style={{ flex: 1 }}>
                <KISButton title="Edit Room" variant="outline" onPress={() => startEditingRoom(room.id)} disabled={saving} />
              </View>
              <View style={{ flex: 1 }}>
                <KISButton title="Delete Room" variant="outline" onPress={() => deleteRoom(room.id)} disabled={saving} />
              </View>
            </View>

            {room.expanded ? (
              <View style={{ marginTop: -130 }}>
                {room.image ? (
                  <Image
                    source={{ uri: room.image }}
                    style={{
                      height: 150,
                      borderRadius: 12,
                      marginBottom: spacing.sm,
                    }}
                  />
                ) : null}

                {room.beds.map((bed) => (
                  <View
                    key={bed.id}
                    style={{
                      padding: spacing.sm,
                      borderRadius: 10,
                      backgroundColor: bed.available ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)',
                      marginBottom: spacing.xs,
                    }}
                  >
                    <TextInput
                      value={bed.name}
                      onChangeText={(text) => changeLocalBedName(room.id, bed.id, text)}
                      onEndEditing={() => {
                        persistBedName(bed.id, bed.name).catch(() => undefined);
                      }}
                      style={{
                        color: palette.text,
                        fontWeight: '600',
                        marginBottom: spacing.xs,
                      }}
                    />

                    <KISButton
                      title={bed.available ? 'Mark Occupied' : 'Mark Available'}
                      onPress={() => {
                        toggleBedAvailability(room.id, bed.id).catch(() => undefined);
                      }}
                      variant="outline"
                    />
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const inputStyle = (palette: any, spacing: any) => ({
  borderWidth: 1,
  borderColor: palette.divider,
  padding: spacing.sm,
  borderRadius: 12,
  marginVertical: spacing.xs,
  color: palette.text,
});
