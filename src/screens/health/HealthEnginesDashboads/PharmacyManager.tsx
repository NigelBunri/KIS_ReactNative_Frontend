import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import KISButton from '@/constants/KISButton';
import {
  createInstitutionEngineManagedItem,
  deleteInstitutionEngineManagedItem,
  fetchInstitutionEngineManagedItems,
  usdToMicro,
  microToUsd,
  updateInstitutionEngineManagedItem,
} from '@/services/healthOpsEngineManagerService';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import ROUTES from '@/network';
import { getHealthThemeColors } from '@/theme/health/colors';
import { HEALTH_THEME_SPACING } from '@/theme/health/spacing';
import { HEALTH_THEME_TYPOGRAPHY } from '@/theme/health/typography';

type Props = {
  institutionId: string;
  engineKey: string;
};

type Medication = {
  id: string;
  name: string;
  category: string;
  stock: number;
  price: number;
  expiryDate: string;
  sortOrder: number;
};

type OrderStatus = 'Pending' | 'Processing' | 'Ready' | 'Delivered' | 'Cancelled';
type Priority = 'Normal' | 'Urgent';

type PrescriptionOrder = {
  id: string;
  patientName: string;
  medications: Medication[];
  pharmacist?: string;
  status: OrderStatus;
  priority: Priority;
  totalPrice: number;
};

const toUsdLabel = (value: number) => Number(value || 0).toFixed(3).replace(/\.?0+$/, '');

export default function PharmacyManager({ institutionId, engineKey }: Props) {
  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === 'light' ? 'light' : 'dark');
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  const [engineEnabled, setEngineEnabled] = useState(true);
  const [engineConfigItemId, setEngineConfigItemId] = useState<string | null>(null);
  const [defaultMarkup, setDefaultMarkup] = useState('10');
  const [autoAssign, setAutoAssign] = useState(true);

  const [inventory, setInventory] = useState<Medication[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventorySaving, setInventorySaving] = useState(false);
  const [editingMedicationId, setEditingMedicationId] = useState<string | null>(null);

  const [newMed, setNewMed] = useState({ name: '', category: '', stock: '', price: '', expiryDate: '' });

  const [orders, setOrders] = useState<PrescriptionOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [selectedMeds, setSelectedMeds] = useState<Medication[]>([]);
  const [priority, setPriority] = useState<Priority>('Normal');
  const [pharmacist, setPharmacist] = useState('');

  const toggleEngine = useCallback(async () => {
    const next = !engineEnabled;
    setEngineEnabled(next);
    try {
      const payload = { item_kind: 'engine_config', name: 'is_active', value_text: next ? 'true' : 'false', status: 'active' };
      if (!engineConfigItemId) {
        const res = await createInstitutionEngineManagedItem(institutionId, engineKey, payload);
        if (res?.data?.id) setEngineConfigItemId(String(res.data.id));
      } else {
        await updateInstitutionEngineManagedItem(institutionId, engineKey, engineConfigItemId, payload);
      }
    } catch {
      // non-critical, local state already flipped
    }
  }, [engineConfigItemId, engineEnabled, engineKey, institutionId]);

  const loadOrders = useCallback(async () => {
    if (!institutionId || !engineKey) return;
    setOrdersLoading(true);
    try {
      const response = await fetchInstitutionEngineManagedItems(institutionId, engineKey, {
        itemKind: 'pharmacy_order',
        rootOnly: true,
        includeInactive: true,
      });
      const rows = Array.isArray(response?.data?.results) ? response.data.results : [];
      const mapped: PrescriptionOrder[] = rows.map((row: any, index: number) => {
        let meds: Medication[] = [];
        try { meds = JSON.parse(row?.description || '[]'); } catch { meds = []; }
        return {
          id: String(row?.id || `order-${index + 1}`),
          patientName: String(row?.name || '').split(' - ')[0] || 'Unknown',
          medications: meds,
          pharmacist: String(row?.value_text || 'Not assigned'),
          status: (String(row?.status || 'Pending').charAt(0).toUpperCase() + String(row?.status || 'Pending').slice(1)) as OrderStatus,
          priority: (Number(row?.value_int || 0) > 0 ? 'Urgent' : 'Normal') as Priority,
          totalPrice: microToUsd(Number(row?.amount_micro || 0)),
        };
      });
      setOrders(mapped);
    } catch {
      // non-critical — order list stays empty
    } finally {
      setOrdersLoading(false);
    }
  }, [engineKey, institutionId]);

  const loadInventory = useCallback(async () => {
    if (!institutionId || !engineKey) return;
    setInventoryLoading(true);
    try {
      const response = await fetchInstitutionEngineManagedItems(institutionId, engineKey, {
        itemKind: 'medication',
        rootOnly: true,
        includeInactive: true,
      });
      if (!response?.success) {
        throw new Error(response?.message || 'Unable to load medication inventory.');
      }
      const rows = Array.isArray(response?.data?.results) ? response.data.results : [];
      const mapped: Medication[] = rows
        .map((row: any, index: number) => ({
          id: String(row?.id || `med-${index + 1}`),
          name: String(row?.name || '').trim() || `Medication ${index + 1}`,
          category: String(row?.description || '').split('|')[0]?.trim() || 'General',
          stock: Math.max(0, Number(row?.quantity || 0) || 0),
          price: microToUsd(Number(row?.amount_micro || 0)),
          expiryDate: String(row?.value_date || '').trim() || '',
          sortOrder: Number.isFinite(Number(row?.sort_order)) ? Number(row.sort_order) : index + 1,
        }))
        .sort((a: Medication, b: Medication) => a.sortOrder - b.sortOrder);
      setInventory(mapped);
    } catch (error: any) {
      Alert.alert('Pharmacy', error?.message || 'Unable to load medication inventory.');
    } finally {
      setInventoryLoading(false);
    }
  }, [engineKey, institutionId]);

  useEffect(() => {
    loadInventory().catch(() => undefined);
    loadOrders().catch(() => undefined);
    fetchInstitutionEngineManagedItems(institutionId, engineKey, { itemKind: 'engine_config', rootOnly: true, includeInactive: false })
      .then((res: any) => {
        const rows = Array.isArray(res?.data?.results) ? res.data.results : [];
        const cfg = rows.find((r: any) => r?.name === 'is_active');
        if (cfg) {
          setEngineConfigItemId(String(cfg.id));
          setEngineEnabled(String(cfg.value_text) !== 'false');
        }
      })
      .catch(() => {});
  }, [engineKey, institutionId, loadInventory, loadOrders]);

  const resetMedicationForm = useCallback(() => {
    setEditingMedicationId(null);
    setNewMed({ name: '', category: '', stock: '', price: '', expiryDate: '' });
  }, []);

  const saveMedication = useCallback(async () => {
    const cleanName = newMed.name.trim();
    const cleanCategory = newMed.category.trim();
    const stock = Math.max(0, Math.floor(Number(newMed.stock || 0)));
    const price = Number(newMed.price || 0);
    const expiryDate = String(newMed.expiryDate || '').trim();

    if (!cleanName || !cleanCategory || !Number.isFinite(price) || price < 0 || !expiryDate) {
      Alert.alert('Medication', 'Provide name, category, stock, price, and expiry date.');
      return;
    }

    setInventorySaving(true);
    try {
      const payload = {
        item_kind: 'medication',
        name: cleanName,
        description: cleanCategory,
        quantity: stock,
        amount_micro: usdToMicro(price),
        value_date: expiryDate,
        status: stock > 0 ? 'in_stock' : 'out_of_stock',
      };
      if (!editingMedicationId) {
        const response = await createInstitutionEngineManagedItem(institutionId, engineKey, payload);
        if (!response?.success) {
          throw new Error(response?.message || 'Unable to add medication.');
        }
      } else {
        const response = await updateInstitutionEngineManagedItem(institutionId, engineKey, editingMedicationId, payload);
        if (!response?.success) {
          throw new Error(response?.message || 'Unable to update medication.');
        }
      }
      resetMedicationForm();
      await loadInventory();
    } catch (error: any) {
      Alert.alert('Medication', error?.message || 'Unable to save medication.');
    } finally {
      setInventorySaving(false);
    }
  }, [editingMedicationId, engineKey, institutionId, loadInventory, newMed, resetMedicationForm]);

  const editMedication = useCallback((med: Medication) => {
    setEditingMedicationId(med.id);
    setNewMed({
      name: med.name,
      category: med.category,
      stock: String(med.stock),
      price: toUsdLabel(med.price),
      expiryDate: med.expiryDate,
    });
  }, []);

  const removeMedication = useCallback((id: string) => {
    Alert.alert('Delete medication', 'This will remove the medication from inventory.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setInventorySaving(true);
          deleteInstitutionEngineManagedItem(institutionId, engineKey, id)
            .then((response: any) => {
              if (!response?.success) {
                throw new Error(response?.message || 'Unable to delete medication.');
              }
              if (editingMedicationId === id) resetMedicationForm();
              return loadInventory();
            })
            .catch((error: any) => {
              Alert.alert('Medication', error?.message || 'Unable to delete medication.');
            })
            .finally(() => setInventorySaving(false));
        },
      },
    ]);
  }, [editingMedicationId, engineKey, institutionId, loadInventory, resetMedicationForm]);

  const updateStock = useCallback((id: string, stock: number) => {
    setInventory((prev) => prev.map((row) => (row.id === id ? { ...row, stock } : row)));
  }, []);

  const toggleMedSelection = useCallback((med: Medication) => {
    setSelectedMeds((prev) =>
      prev.find((row) => row.id === med.id) ? prev.filter((row) => row.id !== med.id) : [...prev, med],
    );
  }, []);

  const createOrder = useCallback(async () => {
    if (!patientName.trim() || selectedMeds.length === 0) {
      Alert.alert('Prescription order', 'Enter patient name and select medications.');
      return;
    }

    const totalPrice = selectedMeds.reduce((sum, med) => sum + med.price, 0) + Number(defaultMarkup || 0);
    const assignedPharmacist = autoAssign ? 'Auto Pharmacist' : pharmacist.trim();

    setCreatingOrder(true);
    let remoteId: string | undefined;
    try {
      const res = await postRequest(ROUTES.healthOps.pharmacySessionStart, {
        patient_name: patientName.trim(),
        medications: selectedMeds.map((m) => ({ id: m.id, name: m.name })),
        pharmacist: assignedPharmacist || null,
        priority,
        total_price: totalPrice,
      });
      remoteId = res?.data?.id ?? res?.id;
    } catch {
      // Best-effort; local entry is always added for UI feedback
    } finally {
      setCreatingOrder(false);
    }

    const nextOrder: PrescriptionOrder = {
      id: remoteId ?? Date.now().toString(),
      patientName: patientName.trim(),
      medications: selectedMeds,
      pharmacist: assignedPharmacist || 'Not assigned',
      status: 'Pending',
      priority,
      totalPrice,
    };

    selectedMeds.forEach((med) => {
      const currentStock = inventory.find((row) => row.id === med.id)?.stock || 0;
      updateStock(med.id, Math.max(0, currentStock - 1));
    });

    setOrders((prev) => [...prev, nextOrder]);
    setPatientName('');
    setSelectedMeds([]);
    setPharmacist('');
    void loadOrders();
  }, [autoAssign, defaultMarkup, inventory, loadOrders, patientName, pharmacist, priority, selectedMeds, updateStock]);

  const updateOrderStatus = useCallback(async (id: string, statusValue: OrderStatus) => {
    // Optimistic update first for instant UI response
    setOrders((prev) => prev.map((row) => (row.id === id ? { ...row, status: statusValue } : row)));
    try {
      await patchRequest(ROUTES.healthOps.pharmacySession(id), { status: statusValue });
    } catch {
      // Best-effort; local state already reflects the change
    }
  }, []);

  const totalMedications = inventory.length;
  const outOfStock = inventory.filter((med) => med.stock <= 0).length;
  const totalOrders = orders.length;
  const completedOrders = orders.filter((row) => row.status === 'Delivered').length;
  const revenue = useMemo(() => orders.reduce((sum, row) => sum + row.totalPrice, 0), [orders]);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
    <ScrollView style={{ padding: spacing.md }}>
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Pharmacy Configuration</Text>
        <KISButton
          title={engineEnabled ? 'Disable Engine' : 'Enable Engine'}
          onPress={() => { toggleEngine().catch(() => undefined); }}
          variant="outline"
        />
        <TextInput
          placeholder="Default Markup (USD)"
          value={defaultMarkup}
          keyboardType="numeric"
          onChangeText={setDefaultMarkup}
          style={input(palette, spacing)}
        />
        <KISButton
          title={autoAssign ? 'Disable Auto-Assign Pharmacist' : 'Enable Auto-Assign Pharmacist'}
          onPress={() => setAutoAssign((prev) => !prev)}
          variant="outline"
        />
      </View>

      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Medication Inventory</Text>

        {inventoryLoading ? (
          <View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={palette.primary} />
            <Text style={{ marginTop: spacing.xs, color: palette.subtext }}>Loading inventory...</Text>
          </View>
        ) : null}

        {inventory.map((med) => (
          <View key={med.id} style={itemCard(palette, spacing)}>
            <Text style={{ color: palette.text }}>
              {med.name} ({med.category})
            </Text>
            <Text style={{ color: palette.subtext }}>
              Stock: {med.stock} • Price: {toUsdLabel(med.price)} USD • Exp: {med.expiryDate}
            </Text>
            <View style={{ marginTop: spacing.xs, gap: spacing.xs }}>
              <KISButton title="Edit Medication" variant="outline" onPress={() => editMedication(med)} />
              <KISButton title="Delete Medication" variant="outline" onPress={() => removeMedication(med.id)} />
            </View>
          </View>
        ))}

        <Text style={{ ...typography.h3, color: palette.text }}>
          {editingMedicationId ? 'Edit Medication' : 'Add Medication'}
        </Text>

        <TextInput
          placeholder="Name"
          value={newMed.name}
          onChangeText={(text) => setNewMed((prev) => ({ ...prev, name: text }))}
          style={input(palette, spacing)}
        />
        <TextInput
          placeholder="Category"
          value={newMed.category}
          onChangeText={(text) => setNewMed((prev) => ({ ...prev, category: text }))}
          style={input(palette, spacing)}
        />
        <TextInput
          placeholder="Stock"
          value={newMed.stock}
          keyboardType="numeric"
          onChangeText={(text) => setNewMed((prev) => ({ ...prev, stock: text }))}
          style={input(palette, spacing)}
        />
        <TextInput
          placeholder="Price (USD)"
          value={newMed.price}
          keyboardType="numeric"
          onChangeText={(text) => setNewMed((prev) => ({ ...prev, price: text }))}
          style={input(palette, spacing)}
        />
        <TextInput
          placeholder="Expiry Date YYYY-MM-DD"
          value={newMed.expiryDate}
          onChangeText={(text) => setNewMed((prev) => ({ ...prev, expiryDate: text }))}
          style={input(palette, spacing)}
        />

        <View style={{ gap: spacing.xs }}>
          <KISButton
            title={inventorySaving ? 'Saving...' : editingMedicationId ? 'Update Medication' : 'Add Medication'}
            onPress={() => {
              saveMedication().catch(() => undefined);
            }}
            disabled={inventorySaving}
          />
          {editingMedicationId ? (
            <KISButton title="Cancel Edit" variant="outline" onPress={resetMedicationForm} disabled={inventorySaving} />
          ) : null}
        </View>
      </View>

      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Create Prescription Order</Text>
        <TextInput placeholder="Patient Name" value={patientName} onChangeText={setPatientName} style={input(palette, spacing)} />

        <Text style={{ ...typography.h3, color: palette.text }}>Select Medications</Text>
        {inventory.map((med) => (
          <TouchableOpacity
            key={med.id}
            onPress={() => toggleMedSelection(med)}
            style={[
              itemCard(palette, spacing),
              selectedMeds.find((selected) => selected.id === med.id) ? { borderWidth: 2, borderColor: palette.primary } : null,
            ]}
          >
            <Text style={{ color: palette.text }}>
              {med.name} ({med.stock} in stock)
            </Text>
          </TouchableOpacity>
        ))}

        {!autoAssign ? (
          <TextInput placeholder="Assign Pharmacist" value={pharmacist} onChangeText={setPharmacist} style={input(palette, spacing)} />
        ) : null}

        {['Normal', 'Urgent'].map((value) => (
          <KISButton
            key={value}
            title={value}
            onPress={() => setPriority(value as Priority)}
            variant={priority === value ? 'primary' : 'outline'}
          />
        ))}

        <KISButton
          title={creatingOrder ? 'Creating...' : 'Create Order'}
          onPress={() => { createOrder().catch(() => undefined); }}
          disabled={creatingOrder}
        />
      </View>

      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Prescription Orders</Text>
        {orders.map((order) => (
          <View key={order.id} style={itemCard(palette, spacing)}>
            <Text style={{ color: palette.text }}>{order.patientName}</Text>
            <Text style={{ color: palette.subtext }}>
              Priority: {order.priority} • Status: {order.status} • Price: {toUsdLabel(order.totalPrice)} USD
            </Text>
            {['Pending', 'Processing', 'Ready', 'Delivered', 'Cancelled'].map((statusValue) => (
              <KISButton
                key={statusValue}
                title={statusValue}
                onPress={() => { updateOrderStatus(order.id, statusValue as OrderStatus).catch(() => undefined); }}
                variant="outline"
              />
            ))}
          </View>
        ))}
      </View>

      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Pharmacy Analytics</Text>
        <Text style={{ color: palette.text }}>Total Medications: {totalMedications}</Text>
        <Text style={{ color: palette.text }}>Out of Stock: {outOfStock}</Text>
        <Text style={{ color: palette.text }}>Total Orders: {totalOrders}</Text>
        <Text style={{ color: palette.text }}>Completed Orders: {completedOrders}</Text>
        <Text style={{ color: palette.text }}>Revenue: {toUsdLabel(revenue)} USD</Text>
      </View>
    </ScrollView>
    </SafeAreaView>
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

const itemCard = (palette: any, spacing: any) => ({
  backgroundColor: palette.bg,
  padding: spacing.sm,
  borderRadius: 12,
  marginVertical: spacing.xs,
});
