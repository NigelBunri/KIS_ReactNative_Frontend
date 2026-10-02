// src/screens/education/provider/ProgramFormScreen.tsx
//
// Full Program creation/edit form — replaces the name-only "Add Program"
// flow. A Program is a major educational entity (DVM, BSc, MBA, PhD,
// Diploma, Certificate, a church's discipleship track, a vocational
// institute's trade certificate...) and needs real structured detail,
// but every field below is optional: a Sunday School program and a
// university's PhD track need completely different subsets of this.
// Same visual/interaction philosophy as CourseBuilderScreen's Details
// tab — plain sections, KISTextInput, pill pickers, Save/Cancel, no
// wizard steps.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { launchImageLibrary } from 'react-native-image-picker';
import { SafeAreaView } from '@/components/common/SafeAreaViewWithTopPadding';
import { useKISTheme } from '@/theme/useTheme';
import { useResponsiveLayout } from '@/theme/responsive';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import PermanentRemoteImage from '@/components/media/PermanentRemoteImage';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { patchRequest } from '@/network/patch';
import { uploadEducationMedia } from '@/services/uploadEducationMedia';
import type { RootStackParamList } from '@/navigation/types';
import { EducationScreenScaffold } from '@/screens/education/shared/components';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route_ = RouteProp<RootStackParamList, 'EducationProgramForm'>;

function FieldLabel({ children }: { children: React.ReactNode }) {
  const { palette } = useKISTheme();
  return <Text style={{ fontSize: 12, fontWeight: '700', color: palette.subtext, marginBottom: 4 }}>{children}</Text>;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  const { palette } = useKISTheme();
  return <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text, marginTop: 6 }}>{children}</Text>;
}

function PresetPicker({
  value,
  onChange,
  presets,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  presets: string[];
  placeholder: string;
}) {
  const { palette } = useKISTheme();
  return (
    <View style={{ gap: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {presets.map(preset => (
          <Text
            key={preset}
            onPress={() => onChange(preset)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: value === preset ? palette.primary : palette.border,
              backgroundColor: value === preset ? palette.primarySoft : 'transparent',
              fontSize: 12,
              fontWeight: '700',
              color: value === preset ? palette.primaryStrong : palette.subtext,
              overflow: 'hidden',
            }}
          >
            {preset}
          </Text>
        ))}
      </ScrollView>
      <KISTextInput placeholder={placeholder} value={value} onChangeText={onChange} />
    </View>
  );
}

const PROGRAM_TYPE_PRESETS = ['Degree', 'Diploma', 'Certificate', 'Professional', 'Vocational', 'Short Program', 'Continuing Education'];
const PROGRAM_LEVEL_PRESETS = ['Undergraduate', 'Graduate', 'Postgraduate', 'Professional', 'Vocational', 'Continuing Education'];
const DURATION_UNIT_PRESETS = ['Years', 'Months', 'Semesters', 'Weeks'];

export default function ProgramFormScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route_>();
  const { institutionId, institutionName, programId } = route.params;
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();

  const [loading, setLoading] = useState(!!programId);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [programType, setProgramType] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState('');
  const [durationValue, setDurationValue] = useState('');
  const [durationUnit, setDurationUnit] = useState('');
  const [department, setDepartment] = useState('');
  const [faculty, setFaculty] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [entryRequirements, setEntryRequirements] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [learningOutcomesText, setLearningOutcomesText] = useState('');
  const [seatLimit, setSeatLimit] = useState('');
  const [priceAmount, setPriceAmount] = useState('0');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverImageAsset, setCoverImageAsset] = useState<{ uri: string; name: string; type: string; size?: number } | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    if (!programId) return;
    setLoading(true);
    getRequest(ROUTES.broadcasts.educationInstitutionProgramDetail(institutionId, programId), { forceNetwork: true })
      .then(response => {
        const program = response?.data?.program;
        if (!program) return;
        setTitle(program.title ?? '');
        setCode(program.code ?? '');
        setProgramType(program.program_type ?? '');
        setSummary(program.summary ?? '');
        setDescription(program.description ?? '');
        setLevel(program.level ?? '');
        setDurationValue(program.duration_value != null ? String(program.duration_value) : '');
        setDurationUnit(program.duration_unit ?? '');
        setDepartment(program.department ?? '');
        setFaculty(program.faculty ?? '');
        setStartDate(program.start_date ?? '');
        setEndDate(program.end_date ?? '');
        setEntryRequirements(program.entry_requirements ?? '');
        setTargetAudience(program.target_audience ?? '');
        setLearningOutcomesText(Array.isArray(program.learning_outcomes) ? program.learning_outcomes.join('\n') : '');
        setSeatLimit(program.seat_limit != null ? String(program.seat_limit) : '');
        setPriceAmount(String(program.price_amount ?? 0));
        setVisibility(program.visibility === 'private' ? 'private' : 'public');
        setStatus(program.status === 'published' ? 'published' : 'draft');
        setCoverImageUrl(program.cover_image_url ?? program.coverUrl ?? '');
      })
      .finally(() => setLoading(false));
  }, [institutionId, programId]);

  const pickCoverImage = useCallback(async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 1, selectionLimit: 1 });
      if (result.didCancel) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert('Cover image', 'Please pick a valid image.');
        return;
      }
      setCoverImageAsset({
        uri: asset.uri,
        name: asset.fileName || `program-cover-${Date.now()}.jpg`,
        type: asset.type || 'image/jpeg',
        size: asset.fileSize ?? undefined,
      });
      setCoverImageUrl(asset.uri);
    } catch (error: any) {
      Alert.alert('Cover image', error?.message || 'Unable to pick image.');
    }
  }, []);

  const save = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert('Program', 'Program name is required.');
      return;
    }
    setSaving(true);
    try {
      let coverImageAttachment: { media_id: string } | undefined;
      if (coverImageAsset) {
        setUploadingCover(true);
        try {
          const uploaded = await uploadEducationMedia({
            context: 'education_module_cover_image',
            file: coverImageAsset,
            institutionId,
          });
          coverImageAttachment = { media_id: uploaded.mediaId };
        } catch (uploadErr: any) {
          Alert.alert('Cover image', uploadErr?.message || 'Unable to upload cover image — the rest of the program was still saved.');
        } finally {
          setUploadingCover(false);
        }
      }
      const body = {
        title: title.trim(),
        code: code.trim(),
        program_type: programType.trim(),
        summary: summary.trim(),
        description: description.trim(),
        level: level.trim(),
        duration_value: durationValue.trim() ? Number(durationValue) : null,
        duration_unit: durationUnit.trim(),
        department: department.trim(),
        faculty: faculty.trim(),
        start_date: startDate.trim() || null,
        end_date: endDate.trim() || null,
        entry_requirements: entryRequirements.trim(),
        target_audience: targetAudience.trim(),
        learning_outcomes: learningOutcomesText.split('\n').map(line => line.trim()).filter(Boolean),
        seat_limit: seatLimit.trim() ? Number(seatLimit) : null,
        price_amount: Number(priceAmount) || 0,
        visibility,
        status,
        cover_image_attachment: coverImageAttachment,
      };
      const response = programId
        ? await patchRequest(ROUTES.broadcasts.educationInstitutionProgramDetail(institutionId, programId), body, { errorMessage: 'Unable to save program.' })
        : await postRequest(ROUTES.broadcasts.educationInstitutionPrograms(institutionId), body, { errorMessage: 'Unable to create program.' });
      if (!response?.success) {
        Alert.alert('Program', response?.message || 'Unable to save program.');
        return;
      }
      const saved = response.data?.program;
      Alert.alert('Program', 'Saved.');
      if (saved?.id) {
        navigation.replace('EducationProgramDashboard', { institutionId, institutionName, programId: saved.id, programTitle: saved.title });
      } else {
        navigation.goBack();
      }
    } finally {
      setSaving(false);
    }
  }, [title, code, programType, summary, description, level, durationValue, durationUnit, department, faculty, startDate, endDate, entryRequirements, targetAudience, learningOutcomesText, seatLimit, priceAmount, visibility, status, coverImageAsset, programId, institutionId, institutionName, navigation]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <EducationScreenScaffold
        palette={palette}
        breadcrumb={institutionName}
        title={programId ? 'Edit Program' : 'Add Program'}
        onBack={() => navigation.goBack()}
        scrollable={false}
        contentContainerStyle={{ flex: 1, padding: 0 }}
      >
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: responsive.pageGutter, gap: 14, paddingBottom: 60 }}>
          <SectionHeading>Basic Information</SectionHeading>
          <View>
            <FieldLabel>Program Name</FieldLabel>
            <KISTextInput placeholder="e.g. Doctor of Veterinary Medicine" value={title} onChangeText={setTitle} />
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <FieldLabel>Program Code</FieldLabel>
              <KISTextInput placeholder="e.g. DVM" value={code} onChangeText={setCode} />
            </View>
          </View>
          <View>
            <FieldLabel>Program Type</FieldLabel>
            <PresetPicker value={programType} onChange={setProgramType} presets={PROGRAM_TYPE_PRESETS} placeholder="Custom type" />
          </View>
          <View>
            <FieldLabel>Short Description</FieldLabel>
            <KISTextInput placeholder="One line summary" value={summary} onChangeText={setSummary} />
          </View>
          <View>
            <FieldLabel>Description</FieldLabel>
            <KISTextInput placeholder="Full description" value={description} onChangeText={setDescription} multiline numberOfLines={4} />
          </View>
          <View>
            <FieldLabel>Program Level</FieldLabel>
            <PresetPicker value={level} onChange={setLevel} presets={PROGRAM_LEVEL_PRESETS} placeholder="Custom level" />
          </View>

          <SectionHeading>Duration</SectionHeading>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <FieldLabel>Duration</FieldLabel>
              <KISTextInput placeholder="e.g. 5" value={durationValue} onChangeText={setDurationValue} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 2 }}>
              <FieldLabel>Duration Unit</FieldLabel>
              <PresetPicker value={durationUnit} onChange={setDurationUnit} presets={DURATION_UNIT_PRESETS} placeholder="Custom unit" />
            </View>
          </View>

          <SectionHeading>Academic / Organizational (optional)</SectionHeading>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <FieldLabel>Department</FieldLabel>
              <KISTextInput placeholder="Optional" value={department} onChangeText={setDepartment} />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel>Faculty / School</FieldLabel>
              <KISTextInput placeholder="Optional" value={faculty} onChangeText={setFaculty} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <FieldLabel>Start Date</FieldLabel>
              <KISTextInput placeholder="YYYY-MM-DD" value={startDate} onChangeText={setStartDate} />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel>End Date</FieldLabel>
              <KISTextInput placeholder="YYYY-MM-DD" value={endDate} onChangeText={setEndDate} />
            </View>
          </View>

          <SectionHeading>Admission / Learner Information (optional)</SectionHeading>
          <View>
            <FieldLabel>Entry Requirements</FieldLabel>
            <KISTextInput placeholder="Optional" value={entryRequirements} onChangeText={setEntryRequirements} multiline numberOfLines={3} />
          </View>
          <View>
            <FieldLabel>Target Audience</FieldLabel>
            <KISTextInput placeholder="Optional" value={targetAudience} onChangeText={setTargetAudience} multiline numberOfLines={2} />
          </View>
          <View>
            <FieldLabel>Learning Outcomes (one per line)</FieldLabel>
            <KISTextInput placeholder="Optional" value={learningOutcomesText} onChangeText={setLearningOutcomesText} multiline numberOfLines={3} />
          </View>
          <View>
            <FieldLabel>Capacity / Seats</FieldLabel>
            <KISTextInput placeholder="Unlimited" value={seatLimit} onChangeText={setSeatLimit} keyboardType="number-pad" />
          </View>

          <SectionHeading>Commercial Information</SectionHeading>
          <View>
            <FieldLabel>Price / Tuition (0 = free)</FieldLabel>
            <KISTextInput placeholder="0" value={priceAmount} onChangeText={setPriceAmount} keyboardType="decimal-pad" />
          </View>

          <SectionHeading>Visual / Publication</SectionHeading>
          <View>
            <FieldLabel>Cover Image</FieldLabel>
            <Text
              onPress={() => void pickCoverImage()}
              style={{
                height: 140, borderRadius: 14, borderWidth: 1, borderColor: palette.border,
                alignItems: 'center', justifyContent: 'center', overflow: 'hidden', textAlign: 'center',
                color: palette.subtext, fontSize: 12, paddingTop: 60,
              }}
            >
              {coverImageUrl ? '' : 'Tap to choose a cover image'}
            </Text>
            {coverImageUrl ? (
              <PermanentRemoteImage uri={coverImageUrl} domain="Education" style={{ width: '100%', height: 140, borderRadius: 14, marginTop: -140 }} />
            ) : null}
            {uploadingCover ? <Text style={{ fontSize: 11, color: palette.subtext, marginTop: 4 }}>Uploading…</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <FieldLabel>Visibility</FieldLabel>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {(['public', 'private'] as const).map(v => (
                  <Text
                    key={v}
                    onPress={() => setVisibility(v)}
                    style={{
                      flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, textAlign: 'center', textTransform: 'capitalize',
                      borderColor: visibility === v ? palette.primary : palette.border,
                      backgroundColor: visibility === v ? palette.primarySoft : 'transparent',
                      color: visibility === v ? palette.primaryStrong : palette.subtext, fontSize: 12, fontWeight: '700',
                    }}
                  >
                    {v}
                  </Text>
                ))}
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel>Status</FieldLabel>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {(['draft', 'published'] as const).map(s => (
                  <Text
                    key={s}
                    onPress={() => setStatus(s)}
                    style={{
                      flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, textAlign: 'center', textTransform: 'capitalize',
                      borderColor: status === s ? palette.primary : palette.border,
                      backgroundColor: status === s ? palette.primarySoft : 'transparent',
                      color: status === s ? palette.primaryStrong : palette.subtext, fontSize: 12, fontWeight: '700',
                    }}
                  >
                    {s}
                  </Text>
                ))}
              </View>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <View style={{ flex: 1 }}>
              <KISButton title="Cancel" variant="secondary" onPress={() => navigation.goBack()} />
            </View>
            <View style={{ flex: 1 }}>
              <KISButton title={saving ? 'Saving…' : 'Save'} disabled={saving} onPress={() => void save()} />
            </View>
          </View>
        </ScrollView>
      </EducationScreenScaffold>
    </SafeAreaView>
  );
}
