import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import { KISIcon } from '@/constants/kisIcons';
import KISButton from '@/constants/KISButton';

type Props = NativeStackScreenProps<RootStackParamList, 'WhistleblowerReport'>;

const CATEGORIES = [
  'Corruption',
  'Fraud',
  'Human Rights',
  'Environmental',
  'Workplace Abuse',
  'Other',
];

export default function WhistleblowerScreen(_props: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const gutter = layout.pageGutter;

  const [activeSection, setActiveSection] = useState<'submit' | 'check'>(
    'submit',
  );

  // Submit form
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Other');
  const [submitting, setSubmitting] = useState(false);
  const [caseRef, setCaseRef] = useState<string | null>(null);

  // Check status
  const [checkRef, setCheckRef] = useState('');
  const [checking, setChecking] = useState(false);
  const [caseStatus, setCaseStatus] = useState<string | null>(null);

  async function handleSubmit() {
    if (!content.trim()) {
      Alert.alert('Required', 'Please enter your report content.');
      return;
    }
    setSubmitting(true);
    try {
      const result = (await postRequest(
        ROUTES.government.whistleblowerSubmit,
        { content: content.trim(), category },
      )) as { case_ref: string };
      setCaseRef(result.case_ref);
      setContent('');
    } catch {
      Alert.alert('Error', 'Could not submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCheckStatus() {
    if (!checkRef.trim()) {
      Alert.alert('Required', 'Please enter your case reference.');
      return;
    }
    setChecking(true);
    setCaseStatus(null);
    try {
      const result = (await getRequest(
        `${ROUTES.government.whistleblowerStatus}?case_ref=${encodeURIComponent(checkRef.trim())}`,
      )) as { status: string; message?: string };
      setCaseStatus(result.status ?? 'Unknown');
    } catch {
      Alert.alert('Not Found', 'No case found with that reference.');
    } finally {
      setChecking(false);
    }
  }

  const inputStyle = [
    styles.input,
    {
      backgroundColor: palette.surface,
      borderColor: palette.divider,
      color: palette.text,
    },
  ];

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: gutter,
            paddingTop: 16,
            paddingBottom: 80,
          }}
        >
          {/* Privacy Note */}
          <View
            style={[
              styles.privacyNote,
              {
                backgroundColor: palette.primarySoft,
                borderColor: palette.primary,
              },
            ]}
          >
            <KISIcon
              name="shield-checkmark-outline"
              size={20}
              color={palette.primary}
            />
            <Text style={[styles.privacyNoteText, { color: palette.text }]}>
              Your identity is not stored. Only your message and a case
              reference are saved.
            </Text>
          </View>

          {/* Section Tabs */}
          <View
            style={[
              styles.tabRow,
              { borderColor: palette.divider, marginTop: 20 },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.75}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[
                styles.tabBtn,
                activeSection === 'submit' && {
                  backgroundColor: palette.primary,
                  borderColor: palette.primary,
                },
                activeSection !== 'submit' && {
                  backgroundColor: palette.surface,
                  borderColor: palette.divider,
                },
              ]}
              onPress={() => {
                setActiveSection('submit');
                setCaseRef(null);
              }}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  {
                    color:
                      activeSection === 'submit'
                        ? palette.ivory
                        : palette.subtext,
                  },
                ]}
              >
                Submit Report
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.75}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[
                styles.tabBtn,
                activeSection === 'check' && {
                  backgroundColor: palette.primary,
                  borderColor: palette.primary,
                },
                activeSection !== 'check' && {
                  backgroundColor: palette.surface,
                  borderColor: palette.divider,
                },
              ]}
              onPress={() => {
                setActiveSection('check');
                setCaseStatus(null);
              }}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  {
                    color:
                      activeSection === 'check'
                        ? palette.ivory
                        : palette.subtext,
                  },
                ]}
              >
                Check Status
              </Text>
            </TouchableOpacity>
          </View>

          {activeSection === 'submit' ? (
            <>
              {/* Case Ref Result */}
              {caseRef ? (
                <View
                  style={[
                    styles.caseRefBox,
                    {
                      backgroundColor: palette.gold + '22',
                      borderColor: palette.gold,
                    },
                  ]}
                >
                  <KISIcon
                    name="ticket-outline"
                    size={20}
                    color={palette.gold}
                  />
                  <View style={styles.caseRefContent}>
                    <Text
                      style={[styles.caseRefLabel, { color: palette.subtext }]}
                    >
                      Your Case Reference
                    </Text>
                    <Text style={[styles.caseRefValue, { color: palette.text }]}>
                      {caseRef}
                    </Text>
                    <Text
                      style={[
                        styles.caseRefHint,
                        { color: palette.subtext },
                      ]}
                    >
                      Save this reference — you'll need it to check your report
                      status.
                    </Text>
                  </View>
                </View>
              ) : (
                <>
                  <Text style={[styles.label, { color: palette.text }]}>
                    Report Content *
                  </Text>
                  <TextInput
                    style={[inputStyle, styles.textarea]}
                    value={content}
                    onChangeText={setContent}
                    placeholder="Describe what you witnessed in detail…"
                    placeholderTextColor={palette.subtext}
                    multiline
                    textAlignVertical="top"
                  />

                  <Text style={[styles.label, { color: palette.text }]}>
                    Category
                  </Text>
                  <View style={styles.chipRow}>
                    {CATEGORIES.map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        activeOpacity={0.75}
                        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                        style={[
                          styles.chip,
                          {
                            backgroundColor:
                              category === cat
                                ? palette.primary
                                : palette.surface,
                            borderColor:
                              category === cat
                                ? palette.primary
                                : palette.divider,
                          },
                        ]}
                        onPress={() => setCategory(cat)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            {
                              color:
                                category === cat
                                  ? palette.ivory
                                  : palette.subtext,
                            },
                          ]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <KISButton
                    title={submitting ? 'Submitting…' : 'Submit Report'}
                    onPress={handleSubmit}
                    disabled={submitting}
                    style={{ marginTop: 20 }}
                  />
                </>
              )}
            </>
          ) : (
            <>
              <Text style={[styles.label, { color: palette.text }]}>
                Case Reference *
              </Text>
              <TextInput
                style={inputStyle}
                value={checkRef}
                onChangeText={setCheckRef}
                placeholder="e.g. WB-2026-XXXXX"
                placeholderTextColor={palette.subtext}
                autoCapitalize="characters"
              />

              <KISButton
                title={checking ? 'Checking…' : 'Check Status'}
                onPress={handleCheckStatus}
                disabled={checking}
                style={{ marginTop: 16 }}
              />

              {caseStatus && (
                <View
                  style={[
                    styles.statusResult,
                    {
                      backgroundColor: palette.card,
                      borderColor: palette.divider,
                    },
                  ]}
                >
                  <Text style={[styles.statusResultLabel, { color: palette.subtext }]}>
                    Case Status
                  </Text>
                  <Text style={[styles.statusResultValue, { color: palette.primary }]}>
                    {caseStatus}
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  privacyNoteText: {
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  tabRow: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    gap: 0,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderWidth: 0,
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    minHeight: 44,
  },
  textarea: {
    minHeight: 140,
    paddingTop: 11,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  caseRefBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 16,
    marginTop: 16,
  },
  caseRefContent: {
    flex: 1,
    gap: 4,
  },
  caseRefLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  caseRefValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
  },
  caseRefHint: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  statusResult: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginTop: 16,
    alignItems: 'center',
    gap: 6,
  },
  statusResultLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusResultValue: {
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
});
