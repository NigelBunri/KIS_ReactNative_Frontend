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

type Drug = {
  id: string;
  name: string;
  strength: string;
  form: string;
  defaultDosage: string;
  price: number;
  controlled: boolean;
  sortOrder: number;
};

type PrescriptionItem = {
  drug: Drug;
  dosage: string;
  frequency: string;
  duration: string;
  refills: number;
};

type Prescription = {
  id: string;
  patient: string;
  items: PrescriptionItem[];
  status: 'active' | 'expired' | 'dispensed';
  createdAt: number;
  expanded?: boolean;
};

const META_DELIMITER = '||';

const encodeDrugMeta = (strength: string, form: string, defaultDosage: string) =>
  [strength, form, defaultDosage].map((value) => String(value || '').replace(/\|\|/g, '')).join(META_DELIMITER);

const decodeDrugMeta = (raw: string) => {
  const [strength = '', form = '', defaultDosage = ''] = String(raw || '').split(META_DELIMITER);
  return { strength, form, defaultDosage };
};

const toKiscLabel = (value: number) => Number(value || 0).toFixed(3).replace(/\.?0+$/, '');

export default function EPrescriptionManager({ institutionId, engineKey }: Props) {
  const scheme = useColorScheme();
  const palette = getHealthThemeColors(scheme === 'light' ? 'light' : 'dark');
  const spacing = HEALTH_THEME_SPACING;
  const typography = HEALTH_THEME_TYPOGRAPHY;

  const [enabled, setEnabled] = useState(true);
  const [defaultValidity, setDefaultValidity] = useState('30');
  const [allowControlled, setAllowControlled] = useState(false);
  const [maxRefills, setMaxRefills] = useState('2');

  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [drugsLoading, setDrugsLoading] = useState(false);
  const [drugsSaving, setDrugsSaving] = useState(false);
  const [editingDrugId, setEditingDrugId] = useState<string | null>(null);

  const [drugName, setDrugName] = useState('');
  const [strength, setStrength] = useState('');
  const [form, setForm] = useState('');
  const [defaultDosage, setDefaultDosage] = useState('');
  const [drugPrice, setDrugPrice] = useState('');
  const [controlled, setControlled] = useState(false);

  const [patientName, setPatientName] = useState('');
  const [selectedDrug, setSelectedDrug] = useState<Drug | null>(null);
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [duration, setDuration] = useState('');
  const [refills, setRefills] = useState('0');

  const [currentItems, setCurrentItems] = useState<PrescriptionItem[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);

  const loadDrugs = useCallback(async () => {
    if (!institutionId || !engineKey) return;
    setDrugsLoading(true);
    try {
      const response = await fetchInstitutionEngineManagedItems(institutionId, engineKey, {
        itemKind: 'prescription_drug',
        rootOnly: true,
        includeInactive: true,
      });
      if (!response?.success) {
        throw new Error(response?.message || 'Unable to load drug catalog.');
      }
      const rows = Array.isArray(response?.data?.results) ? response.data.results : [];
      const mapped: Drug[] = rows
        .map((row: any, index: number) => {
          const meta = decodeDrugMeta(String(row?.description || ''));
          return {
            id: String(row?.id || `drug-${index + 1}`),
            name: String(row?.name || '').trim() || `Drug ${index + 1}`,
            strength: meta.strength,
            form: meta.form,
            defaultDosage: meta.defaultDosage,
            price: microToKisc(Number(row?.amount_micro || 0)),
            controlled: Number(row?.value_int || 0) > 0,
            sortOrder: Number.isFinite(Number(row?.sort_order)) ? Number(row.sort_order) : index + 1,
          } as Drug;
        })
        .sort((a: Drug, b: Drug) => a.sortOrder - b.sortOrder);
      setDrugs(mapped);
    } catch (error: any) {
      Alert.alert('E-prescription', error?.message || 'Unable to load drug catalog.');
    } finally {
      setDrugsLoading(false);
    }
  }, [engineKey, institutionId]);

  useEffect(() => {
    loadDrugs().catch(() => undefined);
  }, [loadDrugs]);

  const resetDrugForm = useCallback(() => {
    setEditingDrugId(null);
    setDrugName('');
    setStrength('');
    setForm('');
    setDefaultDosage('');
    setDrugPrice('');
    setControlled(false);
  }, []);

  const saveDrug = useCallback(async () => {
    const name = drugName.trim();
    const price = Number(drugPrice || 0);
    if (!name || !Number.isFinite(price) || price < 0) {
      Alert.alert('Drug', 'Provide drug name and valid price.');
      return;
    }

    setDrugsSaving(true);
    try {
      const payload = {
        item_kind: 'prescription_drug',
        name,
        description: encodeDrugMeta(strength, form, defaultDosage),
        amount_micro: kiscToMicro(price),
        value_int: controlled ? 1 : 0,
        status: 'active',
      };
      if (!editingDrugId) {
        const response = await createInstitutionEngineManagedItem(institutionId, engineKey, payload);
        if (!response?.success) {
          throw new Error(response?.message || 'Unable to add drug.');
        }
      } else {
        const response = await updateInstitutionEngineManagedItem(institutionId, engineKey, editingDrugId, payload);
        if (!response?.success) {
          throw new Error(response?.message || 'Unable to update drug.');
        }
      }
      resetDrugForm();
      await loadDrugs();
    } catch (error: any) {
      Alert.alert('Drug', error?.message || 'Unable to save drug.');
    } finally {
      setDrugsSaving(false);
    }
  }, [controlled, defaultDosage, drugName, drugPrice, editingDrugId, engineKey, form, institutionId, loadDrugs, resetDrugForm, strength]);

  const editDrug = useCallback((drug: Drug) => {
    setEditingDrugId(drug.id);
    setDrugName(drug.name);
    setStrength(drug.strength);
    setForm(drug.form);
    setDefaultDosage(drug.defaultDosage);
    setDrugPrice(toKiscLabel(drug.price));
    setControlled(drug.controlled);
  }, []);

  const removeDrug = useCallback((id: string) => {
    Alert.alert('Delete drug', 'This will remove the drug from catalog.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setDrugsSaving(true);
          deleteInstitutionEngineManagedItem(institutionId, engineKey, id)
            .then((response: any) => {
              if (!response?.success) {
                throw new Error(response?.message || 'Unable to delete drug.');
              }
              if (editingDrugId === id) {
                resetDrugForm();
              }
              return loadDrugs();
            })
            .catch((error: any) => {
              Alert.alert('Drug', error?.message || 'Unable to delete drug.');
            })
            .finally(() => setDrugsSaving(false));
        },
      },
    ]);
  }, [editingDrugId, engineKey, institutionId, loadDrugs, resetDrugForm]);

  const addItem = useCallback(() => {
    if (!selectedDrug) return;
    if (selectedDrug.controlled && !allowControlled) {
      Alert.alert('E-prescription', 'Controlled drugs are disabled in configuration.');
      return;
    }
    if (Number(refills || 0) > Number(maxRefills || 0)) {
      Alert.alert('E-prescription', 'Refill count exceeds the configured limit.');
      return;
    }

    const item: PrescriptionItem = {
      drug: selectedDrug,
      dosage,
      frequency,
      duration,
      refills: Number(refills || 0),
    };
    setCurrentItems((prev) => [...prev, item]);
    setSelectedDrug(null);
    setDosage('');
    setFrequency('');
    setDuration('');
    setRefills('0');
  }, [allowControlled, dosage, duration, frequency, maxRefills, refills, selectedDrug]);

  const generatePrescription = useCallback(() => {
    if (!patientName.trim() || currentItems.length === 0) {
      Alert.alert('Prescription', 'Enter patient name and add at least one drug item.');
      return;
    }
    const next: Prescription = {
      id: Date.now().toString(),
      patient: patientName.trim(),
      items: currentItems,
      status: 'active',
      createdAt: Date.now(),
      expanded: false,
    };
    setPrescriptions((prev) => [...prev, next]);
    setCurrentItems([]);
    setPatientName('');
  }, [currentItems, patientName]);

  const toggleExpand = useCallback((id: string) => {
    LayoutAnimation.easeInEaseOut();
    setPrescriptions((prev) => prev.map((item) => (item.id === id ? { ...item, expanded: !item.expanded } : item)));
  }, []);

  const updateStatus = useCallback((id: string, statusValue: Prescription['status']) => {
    setPrescriptions((prev) => prev.map((item) => (item.id === id ? { ...item, status: statusValue } : item)));
  }, []);

  const totalValue = useMemo(
    () =>
      prescriptions.reduce((sum, item) => sum + item.items.reduce((sub, row) => sub + row.drug.price, 0), 0),
    [prescriptions],
  );
  const activeCount = prescriptions.filter((item) => item.status === 'active').length;
  const expiredCount = prescriptions.filter((item) => item.status === 'expired').length;
  const dispensedCount = prescriptions.filter((item) => item.status === 'dispensed').length;

  return (
    <ScrollView style={{ padding: spacing.md }}>
      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Engine Configuration</Text>

        <KISButton title={enabled ? 'Disable Engine' : 'Enable Engine'} onPress={() => setEnabled((prev) => !prev)} variant="outline" />
        <TextInput
          placeholder="Default Validity (days)"
          keyboardType="numeric"
          value={defaultValidity}
          onChangeText={setDefaultValidity}
          style={input(palette, spacing)}
        />
        <TextInput
          placeholder="Max Refills Allowed"
          keyboardType="numeric"
          value={maxRefills}
          onChangeText={setMaxRefills}
          style={input(palette, spacing)}
        />
        <KISButton
          title={allowControlled ? 'Disable Controlled Drugs' : 'Enable Controlled Drugs'}
          onPress={() => setAllowControlled((prev) => !prev)}
          variant="outline"
        />
      </View>

      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Drug Catalog</Text>

        {drugsLoading ? (
          <View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={palette.primary} />
            <Text style={{ marginTop: spacing.xs, color: palette.subtext }}>Loading drug catalog...</Text>
          </View>
        ) : null}

        <TextInput placeholder="Drug Name" value={drugName} onChangeText={setDrugName} style={input(palette, spacing)} />
        <TextInput placeholder="Strength (e.g 500mg)" value={strength} onChangeText={setStrength} style={input(palette, spacing)} />
        <TextInput placeholder="Form (Tablet/Syrup)" value={form} onChangeText={setForm} style={input(palette, spacing)} />
        <TextInput placeholder="Default Dosage" value={defaultDosage} onChangeText={setDefaultDosage} style={input(palette, spacing)} />
        <TextInput placeholder="Drug Price (KISC)" keyboardType="numeric" value={drugPrice} onChangeText={setDrugPrice} style={input(palette, spacing)} />

        <KISButton
          title={controlled ? 'Controlled: YES' : 'Controlled: NO'}
          onPress={() => setControlled((prev) => !prev)}
          variant="outline"
        />

        <View style={{ gap: spacing.xs }}>
          <KISButton
            title={drugsSaving ? 'Saving...' : editingDrugId ? 'Update Drug' : 'Add Drug'}
            onPress={() => {
              saveDrug().catch(() => undefined);
            }}
            disabled={drugsSaving}
          />
          {editingDrugId ? (
            <KISButton title="Cancel Edit" variant="outline" onPress={resetDrugForm} disabled={drugsSaving} />
          ) : null}
        </View>

        {drugs.map((drug) => (
          <View key={drug.id} style={{ marginTop: spacing.sm }}>
            <Text style={{ color: palette.text }}>
              {drug.name} • {drug.strength || 'N/A'} • {drug.form || 'N/A'} • {toKiscLabel(drug.price)} KISC
            </Text>
            <View style={{ marginTop: spacing.xs, gap: spacing.xs }}>
              <KISButton title="Edit" onPress={() => editDrug(drug)} variant="outline" />
              <KISButton title="Delete" onPress={() => removeDrug(drug.id)} variant="outline" />
            </View>
          </View>
        ))}
      </View>

      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Create Prescription</Text>

        <TextInput placeholder="Patient Name" value={patientName} onChangeText={setPatientName} style={input(palette, spacing)} />

        {drugs.map((drug) => (
          <TouchableOpacity key={drug.id} onPress={() => setSelectedDrug(drug)} style={{ marginVertical: 4 }}>
            <Text style={{ color: palette.text }}>{drug.name}</Text>
          </TouchableOpacity>
        ))}

        {selectedDrug ? (
          <>
            <Text style={{ color: palette.text }}>Selected: {selectedDrug.name}</Text>
            <TextInput placeholder="Dosage" value={dosage} onChangeText={setDosage} style={input(palette, spacing)} />
            <TextInput placeholder="Frequency (e.g 2x daily)" value={frequency} onChangeText={setFrequency} style={input(palette, spacing)} />
            <TextInput placeholder="Duration (e.g 7 days)" value={duration} onChangeText={setDuration} style={input(palette, spacing)} />
            <TextInput placeholder="Refills" keyboardType="numeric" value={refills} onChangeText={setRefills} style={input(palette, spacing)} />
            <KISButton title="Add To Prescription" onPress={addItem} />
          </>
        ) : null}

        <KISButton title="Generate Prescription" onPress={generatePrescription} />
      </View>

      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Prescriptions</Text>

        {prescriptions.map((row) => (
          <View key={row.id} style={{ marginVertical: spacing.sm }}>
            <TouchableOpacity onPress={() => toggleExpand(row.id)}>
              <Text style={{ color: palette.text }}>
                {row.patient} • {row.status.toUpperCase()}
              </Text>
            </TouchableOpacity>

            {row.expanded
              ? row.items.map((item, index) => (
                  <Text key={`${row.id}-item-${index}`} style={{ color: palette.subtext }}>
                    {item.drug.name} • {item.dosage} • {item.frequency}
                  </Text>
                ))
              : null}

            <KISButton title="Mark Dispensed" onPress={() => updateStatus(row.id, 'dispensed')} variant="outline" />
            <KISButton title="Mark Expired" onPress={() => updateStatus(row.id, 'expired')} variant="outline" />
          </View>
        ))}
      </View>

      <View style={card(palette, spacing)}>
        <Text style={{ ...typography.h2, color: palette.text }}>Analytics</Text>
        <Text style={{ color: palette.text }}>Total Prescriptions: {prescriptions.length}</Text>
        <Text style={{ color: palette.text }}>Active: {activeCount}</Text>
        <Text style={{ color: palette.text }}>Dispensed: {dispensedCount}</Text>
        <Text style={{ color: palette.text }}>Expired: {expiredCount}</Text>
        <Text style={{ color: palette.text }}>Total Drug Value: {toKiscLabel(totalValue)} KISC</Text>
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
