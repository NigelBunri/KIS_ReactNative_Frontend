import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useKISTheme } from '@/theme/useTheme';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import useEducationDiscovery from '@/screens/broadcast/education/hooks/useEducationDiscovery';

type Props = {
  managementData?: Record<string, any>;
  tierLabel?: string;
};

const STUDENT_SAMPLE = [
  { id: 's1', name: 'Anika Paul', progress: 0.76, lastLesson: 'Lesson 4: Storytelling' },
  { id: 's2', name: 'Marc Reyes', progress: 0.48, lastLesson: 'Lesson 2: Strategy' },
  { id: 's3', name: 'Lena Ortiz', progress: 0.92, lastLesson: 'Lesson 8: Leadership' },
];

export default function EducationCreatorConsole({ managementData, tierLabel }: Props) {
  const { palette } = useKISTheme();
  const { data } = useEducationDiscovery({ initialSearch: '' });
  const continueLearningList = data?.continueLearning ?? [];
  const totalCourses = useMemo(
    () =>
      (data?.sections ?? [])
        .map((section) => (section.type === 'course' ? section.items.length : 0))
        .reduce((sum, next) => sum + next, 0),
    [data?.sections],
  );
  const managementCourses = managementData?.courses?.length ?? totalCourses;
  const moduleCount = managementData?.modules?.length ?? 0;
  const totalEnrollments = continueLearningList.length * 8;
  const completed = continueLearningList.filter((item: any) => Number(item.progressPercent || 0) >= 80).length;
  const completionRate = continueLearningList.length
    ? Math.round((completed / continueLearningList.length) * 100)
    : 0;
  const revenue = (continueLearningList.length * 15).toFixed(2);

  const [courseForm, setCourseForm] = useState({
    title: '',
    summary: '',
    price: '0',
    coupon: '',
    isFree: true,
  });
  const [collaborator, setCollaborator] = useState('');
  const [coCreators, setCoCreators] = useState(['Aisha Mwangi', 'Noah Bennett']);

  const handlePublishCourse = () => {
    if (!courseForm.title.trim()) {
      Alert.alert('Course builder', 'Add a title before publishing.');
      return;
    }
    Alert.alert('Course builder', `${courseForm.title} is ready to broadcast.`);
    setCourseForm({ title: '', summary: '', price: '0', coupon: '', isFree: true });
  };

  const addCollaborator = () => {
    const trimmed = collaborator.trim();
    if (!trimmed) return;
    setCoCreators((prev) => [...prev, trimmed]);
    setCollaborator('');
  };

  const stats = [
    { label: 'Enrollments', value: totalEnrollments.toString() },
    { label: 'Completion', value: `${completionRate}%` },
    { label: 'Revenue', value: `$${revenue}` },
    { label: 'Courses', value: managementCourses.toString() },
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 16 }}>
      <View
        style={{
          borderWidth: 2,
          borderColor: palette.divider,
          borderRadius: 18,
          padding: 16,
          backgroundColor: palette.surface,
        }}
      >
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 18 }}>Creator console</Text>
        <Text style={{ color: palette.subtext, marginTop: 4 }}>
          {tierLabel ? `${tierLabel} tier · Partner analytics enabled` : 'Upgrade to unlock premium tools'}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 8 }}>
          {stats.map((item) => (
            <View
              key={item.label}
              style={{
                borderWidth: 1,
                borderColor: palette.divider,
                borderRadius: 16,
                padding: 10,
                minWidth: 90,
                backgroundColor: palette.bg,
              }}
            >
              <Text style={{ color: palette.subtext, fontSize: 12 }}>{item.label}</Text>
              <Text style={{ color: palette.text, fontWeight: '800' }}>{item.value}</Text>
            </View>
          ))}
        </View>
        <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 10 }}>
          Modules & workshops: {moduleCount}
        </Text>
      </View>

      <View
        style={{
          borderWidth: 2,
          borderColor: palette.divider,
          borderRadius: 18,
          padding: 16,
          backgroundColor: palette.surface,
        }}
      >
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Create or update a course</Text>
        <KISTextInput
          label="Course title"
          value={courseForm.title}
          onChangeText={(value) => setCourseForm((prev) => ({ ...prev, title: value }))}
        />
        <KISTextInput
          label="Summary"
          value={courseForm.summary}
          onChangeText={(value) => setCourseForm((prev) => ({ ...prev, summary: value }))}
          multiline
          style={{ minHeight: 70 }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <KISTextInput
            label="Price"
            value={courseForm.price}
            onChangeText={(value) => setCourseForm((prev) => ({ ...prev, price: value }))}
            keyboardType="numeric"
            style={{ flex: 1 }}
          />
          <KISButton
            title={courseForm.isFree ? 'Switch to paid' : 'Mark as free'}
            size="xs"
            variant="outline"
            onPress={() => setCourseForm((prev) => ({ ...prev, isFree: !prev.isFree }))}
          />
        </View>
        <KISTextInput
          label="Coupon (optional)"
          value={courseForm.coupon}
          onChangeText={(value) => setCourseForm((prev) => ({ ...prev, coupon: value }))}
        />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <KISButton title="Publish" onPress={handlePublishCourse} />
          <KISButton
            title="Reset"
            variant="outline"
            onPress={() =>
              setCourseForm({ title: '', summary: '', price: '0', coupon: '', isFree: true })
            }
          />
        </View>
      </View>

      <View
        style={{
          borderWidth: 2,
          borderColor: palette.divider,
          borderRadius: 18,
          padding: 16,
          backgroundColor: palette.surface,
        }}
      >
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Co-creators & roles</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginVertical: 10 }}>
          <KISTextInput
            placeholder="Add collaborator"
            value={collaborator}
            onChangeText={setCollaborator}
            style={{ flex: 1 }}
          />
          <KISButton title="Add" size="sm" onPress={addCollaborator} />
        </View>
        <View style={{ gap: 6 }}>
          {coCreators.map((creator) => (
            <View
              key={creator}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 6,
              }}
            >
              <Text style={{ color: palette.text }}>{creator}</Text>
              <Text style={{ color: palette.primaryStrong, fontSize: 12 }}>Editor</Text>
            </View>
          ))}
        </View>
      </View>

      <View
        style={{
          borderWidth: 2,
          borderColor: palette.divider,
          borderRadius: 18,
          padding: 16,
          backgroundColor: palette.surface,
        }}
      >
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Student management</Text>
        <View style={{ gap: 12, marginTop: 8 }}>
          {STUDENT_SAMPLE.map((item) => (
            <View
              key={item.id}
              style={{
                borderBottomWidth: 1,
                borderBottomColor: palette.divider,
                paddingBottom: 10,
              }}
            >
              <Text style={{ color: palette.text, fontWeight: '700' }}>{item.name}</Text>
              <Text style={{ color: palette.subtext, fontSize: 12 }}>{item.lastLesson}</Text>
              <Text style={{ color: palette.subtext, fontSize: 12 }}>
                Progress: {Math.round(item.progress * 100)}%
              </Text>
              <KISButton
                title="Message"
                size="xs"
                variant="outline"
                onPress={() => Alert.alert('Message', `Opening chat with ${item.name}.`)}
              />
            </View>
          ))}
        </View>
      </View>

      <View
        style={{
          borderWidth: 2,
          borderColor: palette.divider,
          borderRadius: 18,
          padding: 16,
          backgroundColor: palette.surface,
        }}
      >
        <Text style={{ color: palette.text, fontWeight: '900', fontSize: 16 }}>Moderation & visibility</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <KISButton title="Flag content" size="sm" variant="outline" onPress={() => Alert.alert('Moderation', 'Content flagged.')} />
          <KISButton title="Schedule review" size="sm" onPress={() => Alert.alert('Moderation', 'Review scheduled.')} />
        </View>
      </View>
    </ScrollView>
  );
}
