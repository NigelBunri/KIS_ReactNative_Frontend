// src/screens/education/provider/ClassFormScreen.tsx
//
// Full Class creation/edit form. A Class is a flexible educational
// grouping — "DVM Class of 2029", "BSc Computer Science -> Level 100",
// "MBA Executive Cohort 2027", "January 2027 Cohort" — never assumed to
// mean "academic year". Program is always optional here: reached with a
// programId preset (from a Program Dashboard's "+ Add Class") it stays
// program-nested; reached from the main Classes tab with no program
// selected, it's a standalone Class.
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
type Route_ = RouteProp<RootStackParamList, 'EducationClassForm'>;

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
              paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1,
              borderColor: value === preset ? palette.primary : palette.border,
              backgroundColor: value === preset ? palette.primarySoft : 'transparent',
              fontSize: 12, fontWeight: '700', color: value === preset ? palette.primaryStrong : palette.subtext,
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

const CLASS_TYPE_PRESETS = ['Cohort', 'Level', 'Stage', 'Section', 'Term'];

export default function ClassFormScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route_>();
  const { institutionId, institutionName, classId, programId: presetProgramId } = route.params;
  const { palette } = useKISTheme();
  const responsive = useResponsiveLayout();

  const [loading, setLoading] = useState(!!classId);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [classType, setClassType] = useState('');
  const [level, setLevel] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [term, setTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [seatLimit, setSeatLimit] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverImageAsset, setCoverImageAsset] = useState<{ uri: string; name: string; type: string; size?: number } | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [programId, setProgramId] = useState<string | null>(presetProgramId ?? null);
  const [programs, setPrograms] = useState<any[]>([]);
  const programLocked = !!presetProgramId && !classId;

  useEffect(() => {
    getRequest(ROUTES.broadcasts.educationInstitutionPrograms(institutionId), { forceNetwork: true }).then(response => {
      setPrograms(response?.data?.programs ?? []);
    });
  }, [institutionId]);

  useEffect(() => {
    if (!classId) return;
    setLoading(true);
    getRequest(ROUTES.broadcasts.educationInstitutionClassDetail(institutionId, classId), { forceNetwork: true })
      .then(response => {
        const cls = response?.data?.class;
        if (!cls) return;
        setName(cls.name ?? '');
        setCode(cls.code ?? '');
        setDescription(cls.description ?? '');
        setClassType(cls.class_type ?? '');
        setLevel(cls.level ?? '');
        setAcademicYear(cls.academic_year ?? '');
        setTerm(cls.term ?? '');
        setStartDate(cls.start_date ?? '');
        setEndDate(cls.end_date ?? '');
        setSeatLimit(cls.seat_limit != null ? String(cls.seat_limit) : '');
        setVisibility(cls.visibility === 'private' ? 'private' : 'public');
        setStatus(cls.status === 'published' ? 'published' : 'draft');
        setCoverImageUrl(cls.cover_image_url ?? cls.coverUrl ?? '');
        setProgramId(cls.program_id ?? null);
      })
      .finally(() => setLoading(false));
  }, [institutionId, classId]);

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
        name: asset.fileName || `class-cover-${Date.now()}.jpg`,
        type: asset.type || 'image/jpeg',
        size: asset.fileSize ?? undefined,
      });
      setCoverImageUrl(asset.uri);
    } catch (error: any) {
      Alert.alert('Cover image', error?.message || 'Unable to pick image.');
    }
  }, []);

  const save = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Class', 'Class name is required.');
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
          Alert.alert('Cover image', uploadErr?.message || 'Unable to upload cover image — the rest of the class was still saved.');
        } finally {
          setUploadingCover(false);
        }
      }
      const body = {
        name: name.trim(),
        code: code.trim(),
        description: description.trim(),
        class_type: classType.trim(),
        level: level.trim(),
        academic_year: academicYear.trim(),
        term: term.trim(),
        start_date: startDate.trim() || null,
        end_date: endDate.trim() || null,
        seat_limit: seatLimit.trim() ? Number(seatLimit) : null,
        visibility,
        status,
        program_id: programId || null,
        cover_image_attachment: coverImageAttachment,
      };
      const response = classId
        ? await patchRequest(ROUTES.broadcasts.educationInstitutionClassDetail(institutionId, classId), body, { errorMessage: 'Unable to save class.' })
        : await postRequest(ROUTES.broadcasts.educationInstitutionClasses(institutionId), body, { errorMessage: 'Unable to create class.' });
      if (!response?.success) {
        Alert.alert('Class', response?.message || 'Unable to save class.');
        return;
      }
      const saved = response.data?.class;
      Alert.alert('Class', 'Saved.');
      if (saved?.id) {
        navigation.replace('EducationClassDashboard', { institutionId, institutionName, classId: saved.id, className: saved.name });
      } else {
        navigation.goBack();
      }
    } finally {
      setSaving(false);
    }
  }, [name, code, description, classType, level, academicYear, term, startDate, endDate, seatLimit, visibility, status, programId, coverImageAsset, classId, institutionId, institutionName, navigation]);

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
        title={classId ? 'Edit Class' : 'Add Class'}
        onBack={() => navigation.goBack()}
        scrollable={false}
        contentContainerStyle={{ flex: 1, padding: 0 }}
      >
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: responsive.pageGutter, gap: 14, paddingBottom: 60 }}>
          <SectionHeading>Basic Information</SectionHeading>
          <View>
            <FieldLabel>Class Name</FieldLabel>
            <KISTextInput placeholder="e.g. DVM Class of 2029" value={name} onChangeText={setName} />
          </View>
          <View>
            <FieldLabel>Class Code</FieldLabel>
            <KISTextInput placeholder="Optional" value={code} onChangeText={setCode} />
          </View>
          <View>
            <FieldLabel>Description</FieldLabel>
            <KISTextInput placeholder="Optional" value={description} onChangeText={setDescription} multiline numberOfLines={3} />
          </View>
          <View>
            <FieldLabel>Class Type</FieldLabel>
            <PresetPicker value={classType} onChange={setClassType} presets={CLASS_TYPE_PRESETS} placeholder="Custom type" />
          </View>

          <SectionHeading>Program (optional)</SectionHeading>
          {programLocked ? (
            <Text style={{ color: palette.subtext, fontSize: 13 }}>
              Adding this class to {programs.find(p => p.id === programId)?.title || 'this program'}.
            </Text>
          ) : (
            <View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                <Text
                  onPress={() => setProgramId(null)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1,
                    borderColor: !programId ? palette.primary : palette.border,
                    backgroundColor: !programId ? palette.primarySoft : 'transparent',
                    fontSize: 12, fontWeight: '700', color: !programId ? palette.primaryStrong : palette.subtext,
                  }}
                >
                  None — Standalone Class
                </Text>
                {programs.map(program => (
                  <Text
                    key={program.id}
                    onPress={() => setProgramId(program.id)}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1,
                      borderColor: programId === program.id ? palette.primary : palette.border,
                      backgroundColor: programId === program.id ? palette.primarySoft : 'transparent',
                      fontSize: 12, fontWeight: '700', color: programId === program.id ? palette.primaryStrong : palette.subtext,
                    }}
                  >
                    {program.title}
                  </Text>
                ))}
              </ScrollView>
            </View>
          )}

          <SectionHeading>Academic / Cohort Information (optional)</SectionHeading>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <FieldLabel>Level</FieldLabel>
              <KISTextInput placeholder="e.g. Level 100" value={level} onChangeText={setLevel} />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel>Academic Year</FieldLabel>
              <KISTextInput placeholder="e.g. 2027/2028" value={academicYear} onChangeText={setAcademicYear} />
            </View>
          </View>
          <View>
            <FieldLabel>Term / Semester / Cohort Label</FieldLabel>
            <KISTextInput placeholder="e.g. Term 2, Cohort 2027" value={term} onChangeText={setTerm} />
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

          <SectionHeading>Capacity</SectionHeading>
          <View>
            <FieldLabel>Maximum Learners / Seats</FieldLabel>
            <KISTextInput placeholder="Unlimited" value={seatLimit} onChangeText={setSeatLimit} keyboardType="number-pad" />
          </View>

          <SectionHeading>Publication / Status</SectionHeading>
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
