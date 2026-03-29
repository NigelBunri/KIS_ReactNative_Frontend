import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import KISButton from '@/constants/KISButton';
import { styles as profileStyles } from '@/screens/tabs/profile/profile.styles';
import { KISIcon } from '@/constants/kisIcons';
import { institutionSchemaMap, allInstitutionTypes, InstitutionSchema, FieldDefinition } from '@/schema/institutionOnboarding';
import KISTextInput from '@/constants/KISTextInput';

const STEP_ORDER = ['identity', 'location', 'contact', 'media', 'compliance'];

const renderField = (
  field: FieldDefinition,
  value: any,
  onChange: (key: string, val: any) => void,
  disabled?: boolean,
) => {
  switch (field.type) {
    case 'textarea':
    case 'text':
    case 'number':
    case 'email':
    case 'phone':
    case 'url':
      return (
        <KISTextInput
          key={field.key}
          label={field.label}
          value={value ?? ''}
          onChangeText={(text) => onChange(field.key, text)}
          placeholder={field.placeholder}
          keyboardType={field.type === 'number' ? 'numeric' : 'default'}
          multiline={field.type === 'textarea'}
          editable={!disabled}
        />
      );
    case 'select':
      return (
        <View key={field.key} style={styles.selectWrapper}>
          <Text style={styles.fieldLabel}>{field.label}</Text>
          {field.options?.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.selectOption, value === opt.value && styles.selectOptionActive]}
              onPress={() => onChange(field.key, opt.value)}
              disabled={disabled}
            >
              <Text style={styles.selectLabel}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    case 'radio':
      return (
        <View key={field.key} style={styles.radioRow}>
          <Text style={styles.fieldLabel}>{field.label}</Text>
          <View style={styles.radioChoices}>
            {field.options?.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.radioOption, value === opt.value && styles.radioOptionActive]}
                onPress={() => onChange(field.key, opt.value)}
                disabled={disabled}
              >
                <Text style={styles.radioLabel}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    case 'file':
      return (
        <TouchableOpacity
          key={field.key}
          style={styles.fileUpload}
          onPress={() => onChange(field.key, value ? [...value] : [])}
          disabled={disabled}
        >
          <KISIcon name="cloud" size={18} color="#fff" />
          <Text style={styles.fileLabel}>{field.label}</Text>
          <Text style={styles.helperText}>{field.required ? 'Required' : 'Optional'}</Text>
        </TouchableOpacity>
      );
    case 'map':
      return (
        <View key={field.key} style={styles.mapPreview}>
          <Text style={styles.fieldLabel}>{field.label}</Text>
          <View style={styles.mapBox}>
            <Text style={styles.mapText}>{value ? `${value.lat}, ${value.lng}` : 'Tap to pick location'}</Text>
          </View>
        </View>
      );
    default:
      return null;
  }
};

export default function InstitutionOnboardingScreen() {
  const [selectedType, _setSelectedType] = useState(allInstitutionTypes[0]);
  const [currentStep, setCurrentStep] = useState(0);
  const schema = useMemo<InstitutionSchema>(() => institutionSchemaMap[selectedType], [selectedType]);
  const [formState, setFormState] = useState<Record<string, any>>({ type: selectedType });

  const sections = schema.sections;
  const activeSection = sections[currentStep];
  const progressPct = Math.round(((currentStep + 1) / sections.length) * 100);

  const handleFieldChange = (key: string, value: any) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const handleNext = () => {
    if (currentStep + 1 < sections.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = () => {
    Alert.alert('Onboarding saved', 'Draft settings are persisted.');
  };

  return (
    <View style={styles.container}>
      <View style={[styles.banner, profileStyles.card]}> 
        <Text style={styles.bannerTitle}>{schema.banner.title}</Text>
        <Text style={styles.bannerText}>{schema.banner.description}</Text>
        <View style={styles.bannerRow}>
          <Text style={styles.bannerLabel}>Regulatory Notes</Text>
          <Text style={styles.bannerDetail}>{schema.banner.regulatoryNotes.join(' · ')}</Text>
        </View>
        <View style={styles.bannerRow}>
          <Text style={styles.bannerLabel}>Required Documents</Text>
          <Text style={styles.bannerDetail}>{schema.banner.requiredDocuments.join(', ')}</Text>
        </View>
      </View>

      <ScrollView style={styles.stepper} contentContainerStyle={styles.stepperContent}>
        <View style={styles.stepperHeader}>
          {STEP_ORDER.map((stepId, index) => (
            <View key={stepId} style={styles.stepperItem}>
              <Text style={styles.stepLabel}>{sections[index]?.title ?? 'Section'}</Text>
              <View style={[styles.stepDot, currentStep === index && styles.stepDotActive]} />
            </View>
          ))}
        </View>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${progressPct}%` }]} />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{activeSection.title}</Text>
          {activeSection.description ? <Text style={styles.sectionHelper}>{activeSection.description}</Text> : null}
          {activeSection.fields.map((field) => renderField(field, formState[field.key], handleFieldChange))}
        </View>
      </ScrollView>

      <View style={styles.footerRow}>
        <KISButton title="Previous" variant="outline" onPress={handlePrev} disabled={currentStep === 0} />
        <KISButton title={currentStep + 1 === sections.length ? 'Submit' : 'Next'} onPress={currentStep + 1 === sections.length ? handleSubmit : handleNext} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0e0f22',
    padding: 16,
  },
  banner: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    backgroundColor: '#1c1d33',
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  bannerText: {
    color: '#aeb0ce',
    marginTop: 4,
  },
  bannerRow: {
    marginTop: 8,
  },
  bannerLabel: {
    color: '#6fb5ff',
    fontWeight: '600',
  },
  bannerDetail: {
    color: '#d3d5ec',
  },
  stepper: {
    flex: 1,
    marginBottom: 16,
  },
  stepperContent: {
    paddingBottom: 80,
  },
  stepperHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  stepperItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepLabel: {
    color: '#98a0c5',
    fontSize: 12,
    textAlign: 'center',
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2c2f4a',
    marginTop: 6,
  },
  stepDotActive: {
    backgroundColor: '#f59f3f',
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#1c1f35',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#f59f3f',
  },
  sectionCard: {
    backgroundColor: '#161837',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  sectionHelper: {
    color: '#9da4c7',
    marginBottom: 10,
  },
  fieldLabel: {
    color: '#9da4c7',
    marginBottom: 6,
  },
  selectWrapper: {
    marginBottom: 16,
  },
  selectOption: {
    borderWidth: 1,
    borderColor: '#2b2e4a',
    borderRadius: 12,
    padding: 10,
    marginVertical: 4,
  },
  selectOptionActive: {
    borderColor: '#f59f3f',
  },
  selectLabel: {
    color: '#fff',
  },
  radioRow: {
    marginBottom: 16,
  },
  radioChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  radioOption: {
    borderWidth: 1,
    borderColor: '#2b2e4a',
    borderRadius: 999,
    padding: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  radioOptionActive: {
    borderColor: '#f59f3f',
  },
  radioLabel: {
    color: '#fff',
  },
  fileUpload: {
    borderWidth: 1,
    borderColor: '#2b2e4a',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    backgroundColor: '#1c1f35',
  },
  fileLabel: {
    color: '#fff',
    fontWeight: '600',
  },
  helperText: {
    color: '#9da4c7',
    fontSize: 10,
  },
  mapPreview: {
    marginBottom: 16,
  },
  mapBox: {
    height: 120,
    borderWidth: 1,
    borderColor: '#2b2e4a',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f1325',
  },
  mapText: {
    color: '#fff',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
