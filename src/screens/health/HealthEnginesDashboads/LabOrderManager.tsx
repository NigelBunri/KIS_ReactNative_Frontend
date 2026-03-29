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

type Props = {
  institutionId: string;
  engineKey: string;
};

type LabTest = {
  id: string;
  name: string;
  price: number;
  turnaroundHours: number;
  sortOrder: number;
};

type LabOrder = {
  id: string;
  patientName: string;
  tests: LabTest[];
  urgency: 'Routine' | 'Urgent' | 'STAT';
  status: 'Ordered' | 'Sample Collected' | 'Processing' | 'Completed' | 'Cancelled';
  createdAt: number;
};

const toKiscLabel = (value: number) => Number(value || 0).toFixed(3).replace(/\.?0+$/, '');

export default function LabOrderManager({ institutionId, engineKey }: Props) {
  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === 'light' ? 'light' : 'dark');
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  const [engineEnabled, setEngineEnabled] = useState(true);
  const [labMargin, setLabMargin] = useState('0');

  const [labCatalog, setLabCatalog] = useState<LabTest[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [editingTestId, setEditingTestId] = useState<string | null>(null);

  const [newTestName, setNewTestName] = useState('');
  const [newTestPrice, setNewTestPrice] = useState('');
  const [newTestTurnaround, setNewTestTurnaround] = useState('');

  const [patientName, setPatientName] = useState('');
  const [selectedTests, setSelectedTests] = useState<LabTest[]>([]);
  const [urgency, setUrgency] = useState<LabOrder['urgency']>('Routine');
  const [orders, setOrders] = useState<LabOrder[]>([]);

  const loadCatalog = useCallback(async () => {
    if (!institutionId || !engineKey) return;
    setCatalogLoading(true);
    try {
      const response = await fetchInstitutionEngineManagedItems(institutionId, engineKey, {
        itemKind: 'lab_test',
        rootOnly: true,
        includeInactive: true,
      });
      if (!response?.success) {
        throw new Error(response?.message || 'Unable to load lab catalog.');
      }
      const rows = Array.isArray(response?.data?.results) ? response.data.results : [];
      const mapped: LabTest[] = rows
        .map((row: any, index: number) => ({
          id: String(row?.id || `lab-${index + 1}`),
          name: String(row?.name || '').trim() || `Lab Test ${index + 1}`,
          price: microToKisc(Number(row?.amount_micro || 0)),
          turnaroundHours: Math.max(1, Number(row?.value_int || 0) || 1),
          sortOrder: Number.isFinite(Number(row?.sort_order)) ? Number(row.sort_order) : index + 1,
        }))
        .sort((a: LabTest, b: LabTest) => a.sortOrder - b.sortOrder);
      setLabCatalog(mapped);
    } catch (error: any) {
      Alert.alert('Lab order engine', error?.message || 'Unable to load lab catalog.');
    } finally {
      setCatalogLoading(false);
    }
  }, [engineKey, institutionId]);

  useEffect(() => {
    loadCatalog().catch(() => undefined);
  }, [loadCatalog]);

  const resetCatalogForm = useCallback(() => {
    setNewTestName('');
    setNewTestPrice('');
    setNewTestTurnaround('');
    setEditingTestId(null);
  }, []);

  const saveLabTest = useCallback(async () => {
    const name = newTestName.trim();
    const price = Number(newTestPrice || 0);
    const turnaround = Math.max(1, Math.floor(Number(newTestTurnaround || 0)));
    if (!name || !Number.isFinite(price) || price < 0) {
      Alert.alert('Lab test', 'Provide test name, valid price, and turnaround time.');
      return;
    }

    setCatalogSaving(true);
    try {
      if (!editingTestId) {
        const response = await createInstitutionEngineManagedItem(institutionId, engineKey, {
          item_kind: 'lab_test',
          name,
          amount_micro: kiscToMicro(price),
          value_int: turnaround,
          status: 'active',
        });
        if (!response?.success) {
          throw new Error(response?.message || 'Unable to add lab test.');
        }
      } else {
        const response = await updateInstitutionEngineManagedItem(institutionId, engineKey, editingTestId, {
          name,
          amount_micro: kiscToMicro(price),
          value_int: turnaround,
        });
        if (!response?.success) {
          throw new Error(response?.message || 'Unable to update lab test.');
        }
      }
      resetCatalogForm();
      await loadCatalog();
    } catch (error: any) {
      Alert.alert('Lab test', error?.message || 'Unable to save lab test.');
    } finally {
      setCatalogSaving(false);
    }
  }, [editingTestId, engineKey, institutionId, loadCatalog, newTestName, newTestPrice, newTestTurnaround, resetCatalogForm]);

  const editLabTest = useCallback((test: LabTest) => {
    setEditingTestId(test.id);
    setNewTestName(test.name);
    setNewTestPrice(toKiscLabel(test.price));
    setNewTestTurnaround(String(test.turnaroundHours));
  }, []);

  const removeLabTest = useCallback((id: string) => {
    Alert.alert('Delete lab test', 'This will remove this lab test from the catalog.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setCatalogSaving(true);
          deleteInstitutionEngineManagedItem(institutionId, engineKey, id)
            .then((response: any) => {
              if (!response?.success) {
                throw new Error(response?.message || 'Unable to delete lab test.');
              }
              if (editingTestId === id) {
                resetCatalogForm();
              }
              return loadCatalog();
            })
            .catch((error: any) => {
              Alert.alert('Lab test', error?.message || 'Unable to delete lab test.');
            })
            .finally(() => setCatalogSaving(false));
        },
      },
    ]);
  }, [editingTestId, engineKey, institutionId, loadCatalog, resetCatalogForm]);

  const toggleTestSelection = useCallback((test: LabTest) => {
    setSelectedTests((prev) =>
      prev.find((row) => row.id === test.id) ? prev.filter((row) => row.id !== test.id) : [...prev, test],
    );
  }, []);

  const createOrder = useCallback(() => {
    if (!patientName.trim() || selectedTests.length === 0) {
      Alert.alert('Create order', 'Enter patient name and select at least one test.');
      return;
    }
    const nextOrder: LabOrder = {
      id: Date.now().toString(),
      patientName: patientName.trim(),
      tests: selectedTests,
      urgency,
      status: 'Ordered',
      createdAt: Date.now(),
    };
    setOrders((prev) => [...prev, nextOrder]);
    setPatientName('');
    setSelectedTests([]);
  }, [patientName, selectedTests, urgency]);

  const updateStatus = useCallback((id: string, statusValue: LabOrder['status']) => {
    setOrders((prev) => prev.map((row) => (row.id === id ? { ...row, status: statusValue } : row)));
  }, []);

  const totalOrders = orders.length;
  const completedOrders = orders.filter((row) => row.status === 'Completed').length;
  const totalRevenue = useMemo(
    () =>
      orders.reduce((sum, order) => {
        const subtotal = order.tests.reduce((testSum, test) => testSum + test.price, 0);
        return sum + subtotal + Number(labMargin || 0);
      }, 0),
    [labMargin, orders],
  );

  return (
    <ScrollView style={{ padding: spacing.md }}>
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Lab Engine Configuration</Text>

        <KISButton
          title={engineEnabled ? 'Disable Engine' : 'Enable Engine'}
          onPress={() => setEngineEnabled((prev) => !prev)}
          variant="outline"
        />

        <TextInput
          placeholder="Platform Margin Per Order (KISC)"
          value={labMargin}
          keyboardType="numeric"
          onChangeText={setLabMargin}
          style={input(palette, spacing)}
        />
      </View>

      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Lab Test Catalog</Text>

        {catalogLoading ? (
          <View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={palette.primary} />
            <Text style={{ marginTop: spacing.xs, color: palette.subtext }}>Loading catalog...</Text>
          </View>
        ) : null}

        {labCatalog.map((test) => (
          <View key={test.id} style={itemCard(palette, spacing)}>
            <Text style={{ color: palette.text }}>{test.name}</Text>
            <Text style={{ color: palette.subtext }}>
              {toKiscLabel(test.price)} KISC • {test.turnaroundHours}h
            </Text>
            <View style={{ marginTop: spacing.xs, gap: spacing.xs }}>
              <KISButton title="Edit Test" variant="outline" onPress={() => editLabTest(test)} />
              <KISButton title="Delete Test" variant="outline" onPress={() => removeLabTest(test.id)} />
            </View>
          </View>
        ))}

        <Text style={{ ...typography.h3, color: palette.text }}>
          {editingTestId ? 'Edit Test' : 'Add New Test'}
        </Text>

        <TextInput placeholder="Test Name" value={newTestName} onChangeText={setNewTestName} style={input(palette, spacing)} />
        <TextInput
          placeholder="Price (KISC)"
          value={newTestPrice}
          keyboardType="numeric"
          onChangeText={setNewTestPrice}
          style={input(palette, spacing)}
        />
        <TextInput
          placeholder="Turnaround (hours)"
          value={newTestTurnaround}
          keyboardType="numeric"
          onChangeText={setNewTestTurnaround}
          style={input(palette, spacing)}
        />

        <View style={{ gap: spacing.xs }}>
          <KISButton
            title={catalogSaving ? 'Saving...' : editingTestId ? 'Update Test' : 'Add Test'}
            onPress={() => {
              saveLabTest().catch(() => undefined);
            }}
            disabled={catalogSaving}
          />
          {editingTestId ? (
            <KISButton title="Cancel Edit" variant="outline" onPress={resetCatalogForm} disabled={catalogSaving} />
          ) : null}
        </View>
      </View>

      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Create Lab Order</Text>

        <TextInput placeholder="Patient Name" value={patientName} onChangeText={setPatientName} style={input(palette, spacing)} />

        {labCatalog.map((test) => (
          <TouchableOpacity
            key={test.id}
            onPress={() => toggleTestSelection(test)}
            style={[
              itemCard(palette, spacing),
              selectedTests.find((selected) => selected.id === test.id) ? { borderWidth: 2, borderColor: palette.primary } : null,
            ]}
          >
            <Text style={{ color: palette.text }}>{test.name}</Text>
          </TouchableOpacity>
        ))}

        <Text style={{ color: palette.text }}>Urgency:</Text>
        {['Routine', 'Urgent', 'STAT'].map((level) => (
          <KISButton
            key={level}
            title={level}
            onPress={() => setUrgency(level as LabOrder['urgency'])}
            variant={urgency === level ? 'primary' : 'outline'}
          />
        ))}

        <KISButton title="Create Order" onPress={createOrder} />
      </View>

      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Active Orders</Text>

        {orders.map((order) => (
          <View key={order.id} style={itemCard(palette, spacing)}>
            <Text style={{ color: palette.text }}>{order.patientName}</Text>
            <Text style={{ color: palette.subtext }}>
              {order.tests.length} tests • {order.urgency}
            </Text>
            <Text style={{ color: palette.subtext }}>Status: {order.status}</Text>

            {['Sample Collected', 'Processing', 'Completed', 'Cancelled'].map((statusValue) => (
              <KISButton
                key={statusValue}
                title={statusValue}
                onPress={() => updateStatus(order.id, statusValue as LabOrder['status'])}
                variant="outline"
              />
            ))}
          </View>
        ))}
      </View>

      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Lab Analytics</Text>

        <Text style={{ color: palette.text }}>Total Orders: {totalOrders}</Text>
        <Text style={{ color: palette.text }}>Completed Orders: {completedOrders}</Text>
        <Text style={{ color: palette.text }}>Revenue Generated: {toKiscLabel(totalRevenue)} KISC</Text>
        <Text style={{ color: palette.text }}>
          Completion Rate: {totalOrders === 0 ? 0 : Math.round((completedOrders / totalOrders) * 100)}%
        </Text>
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

const itemCard = (palette: any, spacing: any) => ({
  backgroundColor: palette.background,
  padding: spacing.sm,
  borderRadius: 12,
  marginVertical: spacing.xs,
});
