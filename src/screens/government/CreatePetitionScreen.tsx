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
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';
import KISButton from '@/constants/KISButton';

type Props = NativeStackScreenProps<RootStackParamList, 'CreatePetition'>;

const CATEGORIES = ['Civic', 'Faith', 'Business', 'Education', 'Health'];

export default function CreatePetitionScreen({ navigation }: Props) {
  const { palette } = useKISTheme();
  const layout = useResponsiveLayout();
  const gutter = layout.pageGutter;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [target, setTarget] = useState('');
  const [targetCount, setTargetCount] = useState('');
  const [category, setCategory] = useState('Civic');
  const [country, setCountry] = useState('');
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!title.trim() || !description.trim() || !target.trim()) {
      Alert.alert('Missing Fields', 'Title, description, and target are required.');
      return;
    }
    const count = parseInt(targetCount, 10);
    if (isNaN(count) || count < 1) {
      Alert.alert('Invalid', 'Please enter a valid target signature count.');
      return;
    }

    setSaving(true);
    try {
      await postRequest(ROUTES.government.petitions, {
        title: title.trim(),
        description: description.trim(),
        target: target.trim(),
        target_count: count,
        category,
        country: country.trim(),
        deadline: deadline.trim() || undefined,
      });
      Alert.alert('Petition Created', 'Your petition has been submitted.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Error', 'Could not create petition. Please try again.');
    } finally {
      setSaving(false);
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

  const labelStyle = [styles.label, { color: palette.text }];

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg, marginTop: 25 }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: gutter,
            paddingTop: 20,
            paddingBottom: 80,
          }}
        >
          <Text style={[styles.screenTitle, { color: palette.text }]}>
            Create Petition
          </Text>

          {/* Title */}
          <Text style={labelStyle}>Title *</Text>
          <TextInput
            style={inputStyle}
            value={title}
            onChangeText={setTitle}
            placeholder="Petition title"
            placeholderTextColor={palette.subtext}
            maxLength={200}
          />

          {/* Description */}
          <Text style={labelStyle}>Description *</Text>
          <TextInput
            style={[inputStyle, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe what you're asking for and why…"
            placeholderTextColor={palette.subtext}
            multiline
            textAlignVertical="top"
          />

          {/* Target Entity */}
          <Text style={labelStyle}>Target Entity *</Text>
          <TextInput
            style={inputStyle}
            value={target}
            onChangeText={setTarget}
            placeholder="e.g. Ministry of Health, City Council"
            placeholderTextColor={palette.subtext}
          />

          {/* Target Count */}
          <Text style={labelStyle}>Target Signature Count *</Text>
          <TextInput
            style={inputStyle}
            value={targetCount}
            onChangeText={setTargetCount}
            placeholder="e.g. 1000"
            placeholderTextColor={palette.subtext}
            keyboardType="numeric"
          />

          {/* Category Picker */}
          <Text style={labelStyle}>Category</Text>
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
                      category === cat ? palette.primary : palette.surface,
                    borderColor:
                      category === cat ? palette.primary : palette.divider,
                  },
                ]}
                onPress={() => setCategory(cat)}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color:
                        category === cat ? palette.ivory : palette.subtext,
                    },
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Country */}
          <Text style={labelStyle}>Country</Text>
          <TextInput
            style={inputStyle}
            value={country}
            onChangeText={setCountry}
            placeholder="e.g. Nigeria, Ghana, UK"
            placeholderTextColor={palette.subtext}
          />

          {/* Deadline */}
          <Text style={labelStyle}>Deadline (YYYY-MM-DD)</Text>
          <TextInput
            style={inputStyle}
            value={deadline}
            onChangeText={setDeadline}
            placeholder="e.g. 2026-12-31"
            placeholderTextColor={palette.subtext}
            keyboardType="numbers-and-punctuation"
          />

          <KISButton
            title={saving ? 'Creating…' : 'Create Petition'}
            onPress={handleSubmit}
            disabled={saving}
            style={{ marginTop: 24 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 14,
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
    minHeight: 110,
    paddingTop: 11,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
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
});
