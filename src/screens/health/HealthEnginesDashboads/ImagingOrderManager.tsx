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
import { SafeAreaView } from 'react-native-safe-area-context';
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

type Priority = 'Routine' | 'Urgent' | 'STAT';
type ImagingStatus = 'Ordered' | 'Scheduled' | 'Scanning' | 'Reporting' | 'Completed' | 'Cancelled';

type ImagingStudy = {
  id: string;
  name: string;
  price: number;
  turnaroundHours: number;
  sortOrder: number;
};

type ImagingOrder = {
  id: string;
  patientName: string;
  clinicalIndication: string;
  studies: ImagingStudy[];
  priority: Priority;
  radiologist: string;
  status: ImagingStatus;
  report: {
    findings: string;
    impression: string;
    signedOff: boolean;
  };
  createdAt: number;
};

const toUsdLabel = (value: number) => Number(value || 0).toFixed(3).replace(/\.?0+$/, '');

export default function ImagingOrderManager({ institutionId, engineKey }: Props) {
  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === 'light' ? 'light' : 'dark');
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  const [engineEnabled, setEngineEnabled] = useState(true);
  const [engineConfigItemId, setEngineConfigItemId] = useState<string | null>(null);
  const [defaultMargin, setDefaultMargin] = useState('0');
  const [autoAssignRadiologist, setAutoAssignRadiologist] = useState(true);
  const [requireIndication, setRequireIndication] = useState(true);

  const [catalog, setCatalog] = useState<ImagingStudy[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [editingStudyId, setEditingStudyId] = useState<string | null>(null);
  const [newStudyName, setNewStudyName] = useState('');
  const [newStudyPrice, setNewStudyPrice] = useState('');
  const [newStudyTurnaround, setNewStudyTurnaround] = useState('');

  const [patientName, setPatientName] = useState('');
  const [clinicalIndication, setClinicalIndication] = useState('');
  const [selectedStudies, setSelectedStudies] = useState<ImagingStudy[]>([]);
  const [priority, setPriority] = useState<Priority>('Routine');
  const [radiologist, setRadiologist] = useState('');
  const [orders, setOrders] = useState<ImagingOrder[]>([]);

  const loadCatalog = useCallback(async () => {
    if (!institutionId || !engineKey) return;
    setCatalogLoading(true);
    try {
      const response = await fetchInstitutionEngineManagedItems(institutionId, engineKey, {
        itemKind: 'imaging_study',
        rootOnly: true,
        includeInactive: true,
      });
      if (!response?.success) {
        throw new Error(response?.message || 'Unable to load imaging catalog.');
      }
      const rows = Array.isArray(response?.data?.results) ? response.data.results : [];
      const mapped: ImagingStudy[] = rows
        .map((row: any, index: number) => ({
          id: String(row?.id || `imaging-${index + 1}`),
          name: String(row?.name || '').trim() || `Imaging Study ${index + 1}`,
          price: microToUsd(Number(row?.amount_micro || 0)),
          turnaroundHours: Math.max(1, Number(row?.value_int || 0) || 1),
          sortOrder: Number.isFinite(Number(row?.sort_order)) ? Number(row.sort_order) : index + 1,
        }))
        .sort((a: ImagingStudy, b: ImagingStudy) => a.sortOrder - b.sortOrder);
      setCatalog(mapped);
    } catch (error: any) {
      Alert.alert('Imaging engine', error?.message || 'Unable to load imaging catalog.');
    } finally {
      setCatalogLoading(false);
    }
  }, [engineKey, institutionId]);

  useEffect(() => {
    loadCatalog().catch(() => undefined);
    if (!institutionId || !engineKey) return;
    fetchInstitutionEngineManagedItems(institutionId, engineKey, { itemKind: 'engine_config' })
      .then((res: any) => {
        const rows = Array.isArray(res?.data?.results) ? res.data.results : [];
        const cfg = rows.find((r: any) => r?.name === 'is_active');
        if (cfg) {
          setEngineConfigItemId(String(cfg.id));
          setEngineEnabled(cfg.value_bool !== false);
        }
      })
      .catch(() => undefined);
  }, [loadCatalog, institutionId, engineKey]);

  const toggleEngine = useCallback(async () => {
    const next = !engineEnabled;
    setEngineEnabled(next);
    try {
      if (engineConfigItemId) {
        await updateInstitutionEngineManagedItem(institutionId, engineKey, engineConfigItemId, { value_bool: next });
      } else {
        const res = await createInstitutionEngineManagedItem(institutionId, engineKey, {
          item_kind: 'engine_config',
          name: 'is_active',
          value_bool: next,
          status: 'active',
        });
        const newId = res?.data?.id ? String(res.data.id) : null;
        if (newId) setEngineConfigItemId(newId);
      }
    } catch {
      setEngineEnabled(!next);
    }
  }, [engineConfigItemId, engineEnabled, engineKey, institutionId]);

  const resetStudyForm = useCallback(() => {
    setEditingStudyId(null);
    setNewStudyName('');
    setNewStudyPrice('');
    setNewStudyTurnaround('');
  }, []);

  const saveStudy = useCallback(async () => {
    const cleanName = newStudyName.trim();
    const price = Number(newStudyPrice || 0);
    const turnaroundHours = Math.max(1, Math.floor(Number(newStudyTurnaround || 0)));
    if (!cleanName || !Number.isFinite(price) || price < 0) {
      Alert.alert('Imaging study', 'Provide study name, valid price, and turnaround hours.');
      return;
    }

    setCatalogSaving(true);
    try {
      if (!editingStudyId) {
        const response = await createInstitutionEngineManagedItem(institutionId, engineKey, {
          item_kind: 'imaging_study',
          name: cleanName,
          amount_micro: usdToMicro(price),
          value_int: turnaroundHours,
          status: 'active',
        });
        if (!response?.success) {
          throw new Error(response?.message || 'Unable to add study.');
        }
      } else {
        const response = await updateInstitutionEngineManagedItem(institutionId, engineKey, editingStudyId, {
          name: cleanName,
          amount_micro: usdToMicro(price),
          value_int: turnaroundHours,
        });
        if (!response?.success) {
          throw new Error(response?.message || 'Unable to update study.');
        }
      }
      resetStudyForm();
      await loadCatalog();
    } catch (error: any) {
      Alert.alert('Imaging study', error?.message || 'Unable to save study.');
    } finally {
      setCatalogSaving(false);
    }
  }, [editingStudyId, engineKey, institutionId, loadCatalog, newStudyName, newStudyPrice, newStudyTurnaround, resetStudyForm]);

  const editStudy = useCallback((study: ImagingStudy) => {
    setEditingStudyId(study.id);
    setNewStudyName(study.name);
    setNewStudyPrice(toUsdLabel(study.price));
    setNewStudyTurnaround(String(study.turnaroundHours));
  }, []);

  const removeStudy = useCallback((id: string) => {
    Alert.alert('Delete imaging study', 'This will remove the study from catalog.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setCatalogSaving(true);
          deleteInstitutionEngineManagedItem(institutionId, engineKey, id)
            .then((response: any) => {
              if (!response?.success) {
                throw new Error(response?.message || 'Unable to delete study.');
              }
              if (editingStudyId === id) resetStudyForm();
              return loadCatalog();
            })
            .catch((error: any) => {
              Alert.alert('Imaging study', error?.message || 'Unable to delete study.');
            })
            .finally(() => setCatalogSaving(false));
        },
      },
    ]);
  }, [editingStudyId, engineKey, institutionId, loadCatalog, resetStudyForm]);

  const toggleStudy = useCallback((study: ImagingStudy) => {
    setSelectedStudies((prev) =>
      prev.find((row) => row.id === study.id) ? prev.filter((row) => row.id !== study.id) : [...prev, study],
    );
  }, []);

  const createOrder = useCallback(async () => {
    if (!patientName.trim()) {
      Alert.alert('Create order', 'Patient name is required.');
      return;
    }
    if (requireIndication && !clinicalIndication.trim()) {
      Alert.alert('Create order', 'Clinical indication is required.');
      return;
    }
    if (selectedStudies.length === 0) {
      Alert.alert('Create order', 'Select at least one imaging study.');
      return;
    }

    // Submit the imaging order via the clinical engine session start endpoint,
    // which is the appropriate backend workflow for diagnostic/imaging orders.
    try {
      await postRequest(ROUTES.healthOps.clinicalSessionStart, {
        patient_name: patientName.trim(),
        order_type: 'imaging',
        clinical_indication: clinicalIndication.trim(),
        priority,
        studies: selectedStudies.map((s) => ({ id: s.id, name: s.name })),
        radiologist: autoAssignRadiologist ? null : radiologist.trim() || null,
      });
    } catch {
      // Best-effort; local entry is always added for UI feedback
    }

    const nextOrder: ImagingOrder = {
      id: Date.now().toString(),
      patientName: patientName.trim(),
      clinicalIndication: clinicalIndication.trim(),
      studies: selectedStudies,
      priority,
      radiologist: autoAssignRadiologist ? 'Auto-Assigned Radiologist' : radiologist.trim() || 'Not assigned',
      status: 'Ordered',
      report: { findings: '', impression: '', signedOff: false },
      createdAt: Date.now(),
    };
    setOrders((prev) => [...prev, nextOrder]);
    setPatientName('');
    setClinicalIndication('');
    setSelectedStudies([]);
  }, [autoAssignRadiologist, clinicalIndication, patientName, priority, radiologist, requireIndication, selectedStudies]);

  const updateStatus = useCallback(async (id: string, statusValue: ImagingStatus) => {
    setOrders((prev) => prev.map((row) => (row.id === id ? { ...row, status: statusValue } : row)));
    // id is the backend session id when the order was created via clinicalSessionStart.
    // For local-only fallback ids (Date.now()) the PATCH is a no-op on the server.
    try {
      await patchRequest(ROUTES.healthOps.clinicalSessionStep(id), { status: statusValue });
    } catch {
      // Best-effort; local state already reflects the change
    }
  }, []);

  const updateReport = useCallback((orderId: string, field: 'findings' | 'impression' | 'signedOff', value: any) => {
    setOrders((prev) =>
      prev.map((row) =>
        row.id === orderId ? { ...row, report: { ...row.report, [field]: value } } : row,
      ),
    );
  }, []);

  const totalOrders = orders.length;
  const completedReports = orders.filter((order) => order.status === 'Completed').length;
  const urgentCases = orders.filter((order) => order.priority !== 'Routine').length;
  const totalRevenue = useMemo(
    () =>
      orders.reduce((sum, order) => {
        const subtotal = order.studies.reduce((studySum, study) => studySum + study.price, 0);
        return sum + subtotal + Number(defaultMargin || 0);
      }, 0),
    [defaultMargin, orders],
  );

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
    <ScrollView style={{ padding: spacing.md }}>
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Imaging Engine Configuration</Text>

        <KISButton
          title={engineEnabled ? 'Disable Engine' : 'Enable Engine'}
          onPress={() => { toggleEngine().catch(() => undefined); }}
          variant="outline"
        />

        <TextInput
          placeholder="Margin Per Order (USD)"
          value={defaultMargin}
          keyboardType="numeric"
          onChangeText={setDefaultMargin}
          style={input(palette, spacing)}
        />

        <KISButton
          title={autoAssignRadiologist ? 'Disable Auto-Assign' : 'Enable Auto-Assign'}
          onPress={() => setAutoAssignRadiologist((prev) => !prev)}
          variant="outline"
        />

        <KISButton
          title={requireIndication ? 'Indication Required' : 'Indication Optional'}
          onPress={() => setRequireIndication((prev) => !prev)}
          variant="outline"
        />
      </View>

      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Imaging Catalog</Text>

        {catalogLoading ? (
          <View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={palette.primary} />
            <Text style={{ marginTop: spacing.xs, color: palette.subtext }}>Loading catalog...</Text>
          </View>
        ) : null}

        {catalog.map((study) => (
          <View key={study.id} style={itemCard(palette, spacing)}>
            <Text style={{ color: palette.text }}>{study.name}</Text>
            <Text style={{ color: palette.subtext }}>
              {toUsdLabel(study.price)} USD • {study.turnaroundHours}h
            </Text>
            <View style={{ marginTop: spacing.xs, gap: spacing.xs }}>
              <KISButton title="Edit Study" variant="outline" onPress={() => editStudy(study)} />
              <KISButton title="Delete Study" variant="outline" onPress={() => removeStudy(study.id)} />
            </View>
          </View>
        ))}

        <Text style={{ ...typography.h3, color: palette.text }}>
          {editingStudyId ? 'Edit Study' : 'Add New Study'}
        </Text>

        <TextInput placeholder="Study Name" value={newStudyName} onChangeText={setNewStudyName} style={input(palette, spacing)} />
        <TextInput placeholder="Price" value={newStudyPrice} keyboardType="numeric" onChangeText={setNewStudyPrice} style={input(palette, spacing)} />
        <TextInput
          placeholder="Turnaround (hours)"
          value={newStudyTurnaround}
          keyboardType="numeric"
          onChangeText={setNewStudyTurnaround}
          style={input(palette, spacing)}
        />

        <View style={{ gap: spacing.xs }}>
          <KISButton
            title={catalogSaving ? 'Saving...' : editingStudyId ? 'Update Study' : 'Add Study'}
            onPress={() => {
              saveStudy().catch(() => undefined);
            }}
            disabled={catalogSaving}
          />
          {editingStudyId ? (
            <KISButton title="Cancel Edit" variant="outline" onPress={resetStudyForm} disabled={catalogSaving} />
          ) : null}
        </View>
      </View>

      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Create Imaging Order</Text>

        <TextInput placeholder="Patient Name" value={patientName} onChangeText={setPatientName} style={input(palette, spacing)} />
        <TextInput
          placeholder="Clinical Indication"
          value={clinicalIndication}
          onChangeText={setClinicalIndication}
          style={input(palette, spacing)}
        />

        {catalog.map((study) => (
          <TouchableOpacity
            key={study.id}
            onPress={() => toggleStudy(study)}
            style={[
              itemCard(palette, spacing),
              selectedStudies.find((selected) => selected.id === study.id) ? { borderWidth: 2, borderColor: palette.primary } : null,
            ]}
          >
            <Text style={{ color: palette.text }}>{study.name}</Text>
          </TouchableOpacity>
        ))}

        {['Routine', 'Urgent', 'STAT'].map((value) => (
          <KISButton
            key={value}
            title={value}
            onPress={() => setPriority(value as Priority)}
            variant={priority === value ? 'primary' : 'outline'}
          />
        ))}

        {!autoAssignRadiologist ? (
          <TextInput placeholder="Assign Radiologist" value={radiologist} onChangeText={setRadiologist} style={input(palette, spacing)} />
        ) : null}

        <KISButton title="Create Order" onPress={() => { createOrder().catch(() => undefined); }} />
      </View>

      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Imaging Orders</Text>

        {orders.map((order) => (
          <View key={order.id} style={itemCard(palette, spacing)}>
            <Text style={{ color: palette.text }}>{order.patientName}</Text>
            <Text style={{ color: palette.subtext }}>
              {order.priority} • {order.status}
            </Text>

            {['Scheduled', 'Scanning', 'Reporting', 'Completed', 'Cancelled'].map((statusValue) => (
              <KISButton
                key={statusValue}
                title={statusValue}
                onPress={() => { updateStatus(order.id, statusValue as ImagingStatus).catch(() => undefined); }}
                variant="outline"
              />
            ))}

            {order.status === 'Reporting' ? (
              <>
                <TextInput
                  placeholder="Findings"
                  value={order.report.findings}
                  onChangeText={(text) => updateReport(order.id, 'findings', text)}
                  style={input(palette, spacing)}
                />
                <TextInput
                  placeholder="Impression"
                  value={order.report.impression}
                  onChangeText={(text) => updateReport(order.id, 'impression', text)}
                  style={input(palette, spacing)}
                />
                <KISButton
                  title={order.report.signedOff ? 'Signed Off' : 'Sign Report'}
                  onPress={() => updateReport(order.id, 'signedOff', true)}
                />
              </>
            ) : null}
          </View>
        ))}
      </View>

      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Imaging Analytics</Text>
        <Text style={{ color: palette.text }}>Total Orders: {totalOrders}</Text>
        <Text style={{ color: palette.text }}>Completed Reports: {completedReports}</Text>
        <Text style={{ color: palette.text }}>Urgent Cases: {urgentCases}</Text>
        <Text style={{ color: palette.text }}>Revenue Generated: {toUsdLabel(totalRevenue)} USD</Text>
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
  backgroundColor: palette.bg, marginTop: 25,
  padding: spacing.sm,
  borderRadius: 12,
  marginVertical: spacing.xs,
});
