import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DocumentPicker from 'react-native-document-picker';
import KISButton from '@/constants/KISButton';
import { styles as profileStyles } from '@/screens/tabs/profile/profile.styles';
import { KISIcon } from '@/constants/kisIcons';
import { institutionSchemaMap, allInstitutionTypes, InstitutionSchema, FieldDefinition } from '@/schema/institutionOnboarding';
import KISTextInput from '@/constants/KISTextInput';
import ROUTES from '@/network';
import { postRequest } from '@/network/post';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';

const STEP_ORDER = ['identity', 'location', 'contact', 'media', 'compliance'];

const renderField = (
  field: FieldDefinition,
  value: any,
  onChange: (key: string, val: any) => void,
  disabled?: boolean,
  styles?: any,
  palette?: any,
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
    case 'file': {
      const fileCount = Array.isArray(value) ? value.length : 0;
      return (
        <TouchableOpacity
          key={field.key}
          style={styles.fileUpload}
          onPress={async () => {
            if (disabled) return;
            try {
              const results = await DocumentPicker.pick({
                type: [DocumentPicker.types.allFiles],
                allowMultiSelection: !!field.multiple,
              });
              onChange(field.key, results);
            } catch (error: any) {
              if (DocumentPicker.isCancel?.(error)) return;
              Alert.alert('Upload failed', error?.message ?? 'Could not select file.');
            }
          }}
          disabled={disabled}
        >
          <KISIcon name="cloud" size={18} color={palette.ivory} />
          <Text style={styles.fileLabel}>
            {fileCount > 0 ? `${fileCount} file${fileCount > 1 ? 's' : ''} selected` : field.label}
          </Text>
          <Text style={styles.helperText}>{field.required ? 'Required' : 'Optional'}</Text>
        </TouchableOpacity>
      );
    }
    case 'map':
      return (
        <View key={field.key} style={styles.mapPreview}>
          <Text style={styles.fieldLabel}>{field.label}</Text>
          <TouchableOpacity
            style={styles.mapBox}
            disabled={disabled}
            onPress={() => {
              try {
                const Geolocation = require('react-native-geolocation-service').default;
                Geolocation.getCurrentPosition(
                  (pos: { coords: { latitude: number; longitude: number } }) => {
                    onChange(field.key, { lat: pos.coords.latitude, lng: pos.coords.longitude });
                  },
                  () => {
                    Alert.alert(
                      'Enter Coordinates',
                      'Could not detect location. Enter lat,lng manually (e.g. 6.5244,3.3792):',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'OK',
                          onPress: (text?: string) => {
                            const parts = (text ?? '').split(',').map(s => parseFloat(s.trim()));
                            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                              onChange(field.key, { lat: parts[0], lng: parts[1] });
                            }
                          },
                        },
                      ],
                      // @ts-ignore — Alert.prompt on iOS only
                      'plain-text',
                    );
                  },
                  { enableHighAccuracy: true, timeout: 10000 },
                );
              } catch {
                Alert.alert('Location unavailable', 'Enter the address in the text fields above.');
              }
            }}
          >
            <Text style={styles.mapText}>{value ? `${value.lat?.toFixed(5)}, ${value.lng?.toFixed(5)}` : 'Tap to use current location'}</Text>
          </TouchableOpacity>
        </View>
      );
    default:
      return null;
  }
};

export default function InstitutionOnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { palette } = useKISTheme();
  const { bodyFontSize, labelFontSize, headerTitleSize, minTouchTarget, pageGutter, cardGap } = useResponsiveLayout();
  const [selectedType, setSelectedType] = useState(allInstitutionTypes[0]);
  const [currentStep, setCurrentStep] = useState(0);
  const schema = useMemo<InstitutionSchema>(() => institutionSchemaMap[selectedType], [selectedType]);
  const [formState, setFormState] = useState<Record<string, any>>({ type: selectedType });
  const [submitting, setSubmitting] = useState(false);

  const handleSelectType = (type: string) => {
    setSelectedType(type);
    setCurrentStep(0);
    setFormState({ type });
  };

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

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await postRequest(ROUTES.healthOps.institutions, formState);
      if (res?.success === false) {
        throw new Error(res?.message || 'Could not submit onboarding. Please try again.');
      }
      Alert.alert(
        'Submitted',
        'Institution onboarding submitted successfully. You can now add another institution or close this screen.',
        [
          {
            text: 'Add Another',
            onPress: () => {
              setCurrentStep(0);
              setFormState({ type: selectedType });
            },
          },
          { text: 'Done', style: 'default' },
        ],
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not submit onboarding. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.royalInk,
      padding: pageGutter,
    },
    typeSelectorRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: cardGap,
      gap: 8,
    },
    typeChip: {
      borderWidth: 1,
      borderColor: palette.divider,
      borderRadius: 999,
      paddingHorizontal: 14,
      minHeight: minTouchTarget,
      justifyContent: 'center',
      backgroundColor: palette.surface,
    },
    typeChipActive: {
      borderColor: palette.gold,
      backgroundColor: palette.surfaceElevated,
    },
    typeChipLabel: {
      color: palette.text,
      fontSize: labelFontSize,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    banner: {
      padding: pageGutter,
      borderRadius: pageGutter,
      marginBottom: cardGap,
      backgroundColor: palette.surface,
    },
    bannerTitle: {
      fontSize: headerTitleSize * 0.7,
      fontWeight: '700',
      color: palette.ivory,
    },
    bannerText: {
      color: palette.subtext,
      fontSize: bodyFontSize,
      marginTop: 4,
    },
    bannerRow: {
      marginTop: 8,
    },
    bannerLabel: {
      color: palette.primary,
      fontSize: labelFontSize,
      fontWeight: '600',
    },
    bannerDetail: {
      color: palette.text,
      fontSize: bodyFontSize,
    },
    stepper: {
      flex: 1,
      marginBottom: pageGutter,
    },
    stepperContent: {
      paddingBottom: minTouchTarget * 2,
    },
    stepperHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: cardGap,
    },
    stepperItem: {
      alignItems: 'center',
      flex: 1,
    },
    stepLabel: {
      color: palette.subtext,
      fontSize: labelFontSize,
      textAlign: 'center',
    },
    stepDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: palette.surface,
      marginTop: 6,
    },
    stepDotActive: {
      backgroundColor: palette.gold,
    },
    progressBarContainer: {
      height: 4,
      backgroundColor: palette.surface,
      borderRadius: 2,
      overflow: 'hidden',
      marginBottom: cardGap,
    },
    progressBar: {
      height: '100%',
      backgroundColor: palette.gold,
    },
    sectionCard: {
      backgroundColor: palette.surfaceElevated,
      borderRadius: 18,
      padding: pageGutter,
      marginBottom: cardGap,
    },
    sectionTitle: {
      color: palette.ivory,
      fontSize: headerTitleSize * 0.65,
      fontWeight: '700',
    },
    sectionHelper: {
      color: palette.subtext,
      fontSize: bodyFontSize,
      marginBottom: cardGap,
    },
    fieldLabel: {
      color: palette.subtext,
      fontSize: labelFontSize,
      marginBottom: 6,
    },
    selectWrapper: {
      marginBottom: pageGutter,
    },
    selectOption: {
      borderWidth: 1,
      borderColor: palette.divider,
      borderRadius: 12,
      padding: cardGap,
      minHeight: minTouchTarget,
      justifyContent: 'center',
      marginVertical: 4,
    },
    selectOptionActive: {
      borderColor: palette.gold,
    },
    selectLabel: {
      color: palette.text,
      fontSize: bodyFontSize,
    },
    radioRow: {
      marginBottom: pageGutter,
    },
    radioChoices: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    radioOption: {
      borderWidth: 1,
      borderColor: palette.divider,
      borderRadius: 999,
      paddingHorizontal: 12,
      minHeight: minTouchTarget,
      justifyContent: 'center',
      marginRight: 8,
      marginBottom: 8,
    },
    radioOptionActive: {
      borderColor: palette.gold,
    },
    radioLabel: {
      color: palette.text,
      fontSize: bodyFontSize,
    },
    fileUpload: {
      borderWidth: 1,
      borderColor: palette.divider,
      borderRadius: 12,
      padding: cardGap,
      minHeight: minTouchTarget,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: cardGap,
      backgroundColor: palette.surface,
    },
    fileLabel: {
      color: palette.ivory,
      fontSize: bodyFontSize,
      fontWeight: '600',
    },
    helperText: {
      color: palette.subtext,
      fontSize: labelFontSize,
    },
    mapPreview: {
      marginBottom: pageGutter,
    },
    mapBox: {
      height: 120,
      borderWidth: 1,
      borderColor: palette.divider,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: palette.bg, marginTop: 25,
    },
    mapText: {
      color: palette.text,
      fontSize: bodyFontSize,
    },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
  }), [palette, pageGutter, cardGap, minTouchTarget, headerTitleSize, bodyFontSize, labelFontSize]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 12) }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
        <View style={styles.typeSelectorRow}>
          {allInstitutionTypes.map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.typeChip, selectedType === type && styles.typeChipActive]}
              onPress={() => handleSelectType(type)}
              accessibilityRole="button"
              accessibilityLabel={`Select institution type ${type}`}
            >
              <Text style={styles.typeChipLabel}>{type.replace(/_/g, ' ')}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

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
          {activeSection.fields.map((field) => renderField(field, formState[field.key], handleFieldChange, false, styles, palette))}
        </View>
      </ScrollView>

      <View style={styles.footerRow}>
        <KISButton title="Previous" variant="outline" onPress={handlePrev} disabled={currentStep === 0} />
        <KISButton
          title={currentStep + 1 === sections.length ? (submitting ? 'Submitting…' : 'Submit') : 'Next'}
          onPress={currentStep + 1 === sections.length ? handleSubmit : handleNext}
          disabled={submitting}
        />
      </View>
    </View>
  );
}
